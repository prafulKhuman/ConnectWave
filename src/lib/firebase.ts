
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, setPersistence, browserLocalPersistence, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification as firebaseSendEmailVerification, sendPasswordResetEmail as firebaseSendPasswordResetEmail, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    getDoc,
    onSnapshot,
    addDoc,
    orderBy,
    serverTimestamp,
    updateDoc,
    deleteDoc,
    writeBatch,
    Timestamp,
    limit,
    documentId,
    arrayUnion,
    arrayRemove
} from "firebase/firestore";
import { getDatabase, ref as rtdbRef, set as rtdbSet, onValue, onDisconnect, serverTimestamp as rtdbServerTimestamp, goOffline, goOnline } from 'firebase/database';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import type { Contact, Chat, Message } from './data';
import bcrypt from 'bcryptjs';

const firebaseConfig = {
    apiKey: "AIzaSyBuDZPKJ2ZF88i8sf2YQsQJb9dzvT45X2w",
    authDomain: "wavync.firebaseapp.com",
    databaseURL: "https://wavync-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wavync",
    storageBucket: "wavync.firebasestorage.app",
    messagingSenderId: "1065315620505",
    appId: "1:1065315620505:web:38a9831efab588a51c4a08"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);

// This will ensure that the user's session is persisted.
setPersistence(auth, browserLocalPersistence);

const setupRecaptcha = (phone: string) => {
    let recaptchaContainer = document.getElementById('recaptcha-container');
    if (!recaptchaContainer) {
      recaptchaContainer = document.createElement('div');
      recaptchaContainer.id = 'recaptcha-container';
      document.body.appendChild(recaptchaContainer);
    }
    
    // Ensure the container is empty before creating a new verifier
    recaptchaContainer.innerHTML = '';

    const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response: any) => {
          console.log('reCAPTCHA solved, automatically submitting form now.');
        }
    });
    return recaptchaVerifier;
}

const onAuthUserChanged = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
}

const sendEmailVerification = async (user: User) => {
    return await firebaseSendEmailVerification(user);
};

const sendPasswordResetEmail = async (email: string) => {
    return await firebaseSendPasswordResetEmail(auth, email);
}

const reauthenticateUser = async (user: User, password_: string) => {
    if(!user.email) throw new Error("User has no email");
    const credential = EmailAuthProvider.credential(user.email, password_);
    return await reauthenticateWithCredential(user, credential);
}

// Hashing Functions
const hashValue = async (value: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    const hashedValue = await bcrypt.hash(value, salt);
    return hashedValue;
}

const compareValue = async (value: string, hash: string): Promise<boolean> => {
    return await bcrypt.compare(value, hash);
}


// Firestore functions
const getContactByPhone = async (phone: string): Promise<Contact | null> => {
    const q = query(collection(db, "users"), where("mobileNumber", "==", phone));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as Contact;
}

const addUserToFirestore = async (userId: string, user: Omit<Contact, 'avatar' | 'online' | 'lastSeen'| 'id' | 'pin'>) => {
    const newUser = {
        ...user,
        id: userId,
        avatar: '',
        online: false,
        lastSeen: serverTimestamp(),
    }
    await setDoc(doc(db, "users", userId), newUser);
}

const getCurrentUser = async (userId: string): Promise<Contact | null> => {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const data = userDoc.data();
        let lastSeenDate: Date | undefined = undefined;

        if (data.lastSeen instanceof Timestamp) {
            lastSeenDate = data.lastSeen.toDate();
        } else if (typeof data.lastSeen === 'number') { // Handle RTDB timestamp
            lastSeenDate = new Date(data.lastSeen);
        }

        return { 
            id: userDoc.id, 
            ...data,
            lastSeen: lastSeenDate,
        } as Contact;
    }
    return null;
};


const getChatsForUser = (userId: string, callback: (chats: Chat[]) => void) => {
    const chatsQuery = query(collection(db, "chats"), where("participantIds", "array-contains", userId));

    const unsubscribe = onSnapshot(chatsQuery, async (chatsSnapshot) => {
        const participantIds = new Set<string>();
        chatsSnapshot.docs.forEach(doc => {
            doc.data().participantIds.forEach((id: string) => participantIds.add(id));
        });

        const participantsMap = new Map<string, Contact>();
        if (participantIds.size > 0) {
            const participantChunks: string[][] = [];
             for (let i = 0; i < Array.from(participantIds).length; i += 30) {
                participantChunks.push(Array.from(participantIds).slice(i, i + 30));
            }
            await Promise.all(participantChunks.map(async chunk => {
                 if (chunk.length === 0) return;
                const usersQuery = query(collection(db, "users"), where(documentId(), "in", chunk));
                const usersSnapshot = await getDocs(usersQuery);
                usersSnapshot.forEach(userDoc => {
                    const data = userDoc.data();
                    const lastSeen = data.lastSeen instanceof Timestamp ? data.lastSeen.toDate() : undefined;
                    participantsMap.set(userDoc.id, { id: userDoc.id, ...data, lastSeen } as Contact);
                });
            }));
        }

        const chats: Chat[] = chatsSnapshot.docs.map(chatDoc => {
            const chatData = chatDoc.data();
            const participants = chatData.participantIds.map((id: string) => participantsMap.get(id)).filter(Boolean) as Contact[];
            return {
                id: chatDoc.id,
                ...chatData,
                participants,
                messages: [],
                unreadCount: 0,
            } as Chat;
        });

        // Set up listeners for last message and unread count for each chat
        const chatPromises = chats.map(chat => {
            return new Promise<Chat>((resolve) => {
                const messagesQuery = query(
                    collection(db, "chats", chat.id, "messages"),
                    orderBy("timestamp", "desc")
                );

                const messageUnsubscribe = onSnapshot(messagesQuery, (messagesSnapshot) => {
                    const allMessages = messagesSnapshot.docs;
                    const lastMessageDoc = allMessages[0];
                    let unreadCount = 0;

                    messagesSnapshot.docs.forEach(msgDoc => {
                        const msgData = msgDoc.data();
                        if (msgData.senderId !== userId && msgData.status !== 'read') {
                            unreadCount++;
                        }
                    });

                    // Update 'sent' messages to 'delivered' if recipient is online
                    const otherParticipant = chat.participants.find(p => p.id !== userId);
                    if (otherParticipant?.online) {
                        const messagesToMarkDelivered = allMessages
                            .filter(doc => doc.data().senderId !== userId && doc.data().status === 'sent')
                            .map(doc => doc.id);
                        if (messagesToMarkDelivered.length > 0) {
                            updateMessagesStatus(chat.id, messagesToMarkDelivered, 'delivered');
                        }
                    }

                    if (lastMessageDoc) {
                        const msgData = lastMessageDoc.data();
                        let contentPreview = msgData.content;
                        switch (msgData.type) {
                            case 'image': contentPreview = `📷 Image`; break;
                            case 'video': contentPreview = `📹 Video`; break;
                            case 'audio': contentPreview = `🎵 Audio`; break;
                            case 'file': contentPreview = `📄 File`; break;
                        }
                        const timestamp = msgData.timestamp?.toDate() || new Date();
                        chat.messages = [{
                            id: lastMessageDoc.id,
                            content: contentPreview,
                            timestamp: timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }),
                            timestamp_raw: timestamp.getTime(),
                            sender: participantsMap.get(msgData.senderId)!,
                            type: msgData.type || 'text',
                            status: msgData.status || 'sent',
                            edited: msgData.edited || false,
                            fileName: msgData.fileName
                        }];
                    }
                    chat.unreadCount = unreadCount;
                    
                    // Not ideal to resolve multiple times, but onSnapshot requires a live connection.
                    // This will be handled by the main callback logic.
                    const updatedChats = chats.map(c => c.id === chat.id ? {...chat} : c);
                    callback(updatedChats);
                });
                // We don't resolve the promise here because the listener is ongoing.
                // Instead, we rely on the callback inside the listener.
            });
        });
        
        callback(chats); // Initial callback with chat structure
    });

    return unsubscribe;
};

const getMessagesForChat = (chatId: string, callback: (messages: Message[]) => void) => {
    const participantsMap = new Map<string, Contact>();

    // First get participants to build the map
    const chatRef = doc(db, 'chats', chatId);
    const unsubscribeChat = onSnapshot(chatRef, async (chatDoc) => {
        const chatData = chatDoc.data();
        if (!chatData) return;

        const participantIds = chatData.participantIds;
        
        if (participantIds && participantIds.length > 0) {
            const usersQuery = query(collection(db, "users"), where(documentId(), "in", participantIds));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach(userDoc => {
                const data = userDoc.data();
                const lastSeen = data.lastSeen instanceof Timestamp ? data.lastSeen.toDate() : undefined;
                participantsMap.set(userDoc.id, { id: userDoc.id, ...data, lastSeen } as Contact);
            });
        }

        // Now listen for messages
        const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
        const unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
            const messages = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const sender = participantsMap.get(data.senderId) || { id: data.senderId, name: "Unknown User", avatar: '', email: '', pin: '' } as Contact;
                const timestamp = data.timestamp?.toDate() || new Date();
                
                return {
                    id: doc.id,
                    sender: sender,
                    content: data.content,
                    timestamp: timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }),
                    timestamp_raw: timestamp.getTime(),
                    type: data.type || 'text',
                    status: data.status || 'sent',
                    edited: data.edited || false,
                    fileName: data.fileName || '',
                    deletedFor: data.deletedFor || [],
                } as Message;
            }).filter(m => m.status !== 'sending'); // Don't show local-only messages
            callback(messages);
        });

        // This is a bit tricky, ideally we'd return both unsubscribers
        // For simplicity, we assume this is a long-lived listener
    });
    
    // This return is for the outer listener, message listener is nested
    return unsubscribeChat; 
};


const sendMessageInChat = async (chatId: string, senderId: string, content: string, type: Message['type'] = 'text', fileName?: string) => {
    const messageData: any = {
        senderId,
        content,
        type,
        status: 'sent',
        timestamp: serverTimestamp()
    };
    if (fileName) {
        messageData.fileName = fileName;
    }
    await addDoc(collection(db, "chats", chatId, "messages"), messageData);
}

const updateMessagesStatus = async (chatId: string, messageIds: string[], status: Message['status']) => {
    if (messageIds.length === 0) return;
    const batch = writeBatch(db);
    messageIds.forEach(messageId => {
        const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
        batch.update(messageRef, { status });
    });
    await batch.commit();
};

const createNewGroupInFirestore = async (groupName: string, participantIds: string[], avatar: string) => {
    const chatRef = await addDoc(collection(db, "chats"), {
        type: 'group',
        name: groupName,
        participantIds,
        avatar,
    });
    // Add an initial message to the group
    await addDoc(collection(db, "chats", chatRef.id, "messages"), {
        senderId: participantIds[participantIds.length -1], // Creator
        content: `Group "${groupName}" was created.`,
        timestamp: serverTimestamp(),
        type: 'text'
    });

    return chatRef.id;
};

const getAvailableContacts = (currentUserId: string, callback: (contacts: Contact[]) => void) => {
    // This function is now replaced by getContacts, but we keep it to avoid breaking changes if it's used elsewhere.
    // For "Create Group", we will use getContacts instead.
    const q = query(collection(db, "users"), where("id", "!=", currentUserId));
    return onSnapshot(q, (querySnapshot) => {
        const contacts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
        callback(contacts);
    });
};

const updateUserProfile = async (userId: string, data: Partial<Contact>) => {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, data);
};

const findUserByEmail = async (email: string): Promise<Contact | null> => {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as Contact;
};

const createChatWithUser = async (currentUserId: string, otherUserId: string) => {
    // Check if a direct chat already exists
    const participantIds = [currentUserId, otherUserId].sort();
    const q = query(collection(db, "chats"), where("participantIds", "==", participantIds), where("type", "==", "direct"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        // Create a new chat
        const chatRef = await addDoc(collection(db, "chats"), {
            type: 'direct',
            participantIds: participantIds,
            blocked: { isBlocked: false, by: '' }
        });
        // Optional: Add an initial message
        await addDoc(collection(db, "chats", chatRef.id, "messages"), {
            senderId: currentUserId,
            content: "Chat started.",
            timestamp: serverTimestamp(),
            type: 'text',
            status: 'sent',
        });
        return chatRef.id;
    } else {
        // Chat already exists
        return querySnapshot.docs[0].id;
    }
};

const clearChatHistory = async (chatId: string) => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const querySnapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
};

const deleteChat = async (chatId: string) => {
    // First, delete all messages in the subcollection
    await clearChatHistory(chatId);
    // Then, delete the chat document itself
    const chatRef = doc(db, 'chats', chatId);
    await deleteDoc(chatRef);
}

const updateBlockStatus = async (chatId: string, isBlocked: boolean, blockedBy: string) => {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
        'blocked.isBlocked': isBlocked,
        'blocked.by': isBlocked ? blockedBy : ''
    });
};

const manageUserPresence = (userId: string) => {
    if (typeof window === 'undefined' || !userId) {
        return () => {};
    }
    
    const userStatusDatabaseRef = rtdbRef(rtdb, '/status/' + userId);
    const userFirestoreRef = doc(db, 'users', userId);

    goOnline(rtdb);

    const con = rtdbRef(rtdb, '.info/connected');
    
    const unsubscribe = onValue(con, (snapshot) => {
        if (snapshot.val() === false) {
             updateDoc(userFirestoreRef, {
                online: false,
                lastSeen: serverTimestamp()
            });
            return;
        }

        const offlineStatus = {
            state: 'offline',
            last_changed: rtdbServerTimestamp(),
        };
        const onlineStatus = {
            state: 'online',
            last_changed: rtdbServerTimestamp(),
        };

        onDisconnect(userStatusDatabaseRef).set(offlineStatus).then(() => {
            rtdbSet(userStatusDatabaseRef, onlineStatus);
            updateDoc(userFirestoreRef, {
                online: true
            });
        });
    });

    return () => {
        goOffline(rtdb);
        unsubscribe();
    }
};

const onUserStatusChange = (userId: string, callback: (status: any) => void) => {
    const userStatusRef = rtdbRef(rtdb, '/status/' + userId);
    return onValue(userStatusRef, (snapshot) => {
        const status = snapshot.val();
        if (status) {
            callback(status);
        } else {
            // Handle case where status is null (user logs out/disconnects)
            getDoc(doc(db, 'users', userId)).then(userDoc => {
                if (userDoc.exists()) {
                    const lastSeen = userDoc.data().lastSeen;
                    callback({ state: 'offline', last_changed: lastSeen?.toMillis() || Date.now() });
                }
            });
        }
    });
};

// New Contact Management Functions

const getContacts = (userId: string, callback: (contacts: Contact[]) => void) => {
    const contactsRef = collection(db, 'users', userId, 'contacts');
    return onSnapshot(contactsRef, async (snapshot) => {
        if (snapshot.empty) {
            callback([]);
            return;
        }
        const contactIds = snapshot.docs.map(doc => doc.id);
        
        if (contactIds.length === 0) {
            callback([]);
            return;
        }

        const usersQuery = query(collection(db, "users"), where(documentId(), "in", contactIds));
        
        const usersSnapshot = await getDocs(usersQuery);
        const contacts = usersSnapshot.docs.map(doc => {
            const data = doc.data();
            const lastSeen = data.lastSeen instanceof Timestamp ? data.lastSeen.toDate() : undefined;
            return { id: doc.id, ...data, lastSeen } as Contact
        });

        callback(contacts);
    });
};

const addContact = async (userId: string, contactToAdd: Contact) => {
    const contactRef = doc(db, 'users', userId, 'contacts', contactToAdd.id);
    await setDoc(contactRef, { 
        addedAt: serverTimestamp() 
    });
};

const deleteContact = async (userId: string, contactId: string) => {
    const contactRef = doc(db, 'users', userId, 'contacts', contactId);
    await deleteDoc(contactRef);
};

const deleteMessage = async (chatId: string, message: Message) => {
    // If the message is an image or video, delete it from Cloudinary first
    if ((message.type === 'image' || message.type === 'video' || message.type === 'file' || message.type === 'audio') && message.content) {
        try {
            await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: message.content }),
            });
        } catch (error) {
            console.error("Failed to delete from Cloudinary, proceeding with Firestore deletion.", error);
        }
    }
    
    // Then delete the message from Firestore
    const messageRef = doc(db, 'chats', chatId, 'messages', message.id);
    await deleteDoc(messageRef);
};

const deleteMessageForMe = async (chatId: string, messageId: string, userId: string) => {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
        deletedFor: arrayUnion(userId)
    });
};

const updateMessage = async (chatId: string, messageId: string, newContent: string) => {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await updateDoc(messageRef, {
        content: newContent,
        edited: true,
    });
};

const togglePinChat = async (chatId: string, userId: string, isPinned: boolean) => {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
        pinnedBy: isPinned ? arrayRemove(userId) : arrayUnion(userId)
    });
};

const setUserTypingStatus = (chatId: string, userId: string, userName: string, isTyping: boolean) => {
    if (!chatId || !userId) return;
    const typingStatusRef = rtdbRef(rtdb, `typing-status/${chatId}/${userId}`);
    if (isTyping) {
        rtdbSet(typingStatusRef, { isTyping: true, name: userName });
    } else {
        rtdbSet(typingStatusRef, null); // Remove the typing indicator
    }
};

const onTypingStatusChange = (chatId: string, callback: (typingStatus: any) => void) => {
    const chatTypingRef = rtdbRef(rtdb, `typing-status/${chatId}`);
    return onValue(chatTypingRef, (snapshot) => {
        const typingStatus = snapshot.val() || {};
        callback(typingStatus);
    });
};


// Cloudinary Upload
const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) {
        const errorDetails = await res.json().catch(() => ({ error: 'File upload failed' }));
        console.error('Upload API Error:', errorDetails);
        throw new Error(errorDetails.error || 'File upload failed');
    }
    
    const data = await res.json();
    return data.secure_url;
}

const uploadAvatar = async (file: File) => {
    return await uploadFile(file);
}

const uploadFileForChat = async (chatId: string, senderId: string, file: File) => {
    const url = await uploadFile(file);

    let type: Message['type'] = 'file';
    if (file.type.startsWith('image/')) {
        type = 'image';
    } else if (file.type.startsWith('video/')) {
        type = 'video';
    } else if (file.type.startsWith('audio/')) {
        type = 'audio';
    }

    await sendMessageInChat(chatId, senderId, url, type, file.name);
}


// WebRTC Calling Functions

const initiateCall = async (callerId: string, calleeId: string, type: 'audio' | 'video'): Promise<string> => {
    const callDocRef = await addDoc(collection(db, 'calls'), {
        callerId,
        calleeId,
        type,
        status: 'ringing',
        createdAt: serverTimestamp(),
    });

    // Timeout to hang up if not answered
    setTimeout(() => {
        getDoc(callDocRef).then(doc => {
            if (doc.exists() && doc.data().status === 'ringing') {
                hangUpCall(doc.id);
            }
        });
    }, 30000); // 30 seconds

    return callDocRef.id;
};

const answerCall = async (callId: string, calleeId: string) => {
    const callDocRef = doc(db, 'calls', callId);
    if ((await getDoc(callDocRef)).exists()) {
        await updateDoc(callDocRef, { status: 'answered' });
    }
};


const listenForCall = (userId: string, callback: (call: any | null) => void) => {
    const q = query(collection(db, 'calls'), where('calleeId', '==', userId), where('status', '==', 'ringing'));
    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const callDoc = snapshot.docs[0];
            const callData = { id: callDoc.id, ...callDoc.data() };
            // Ensure we don't act on stale ringing calls
            const callTime = (callData.createdAt as Timestamp)?.toDate().getTime() || 0;
            if (Date.now() - callTime < 30000) { // Check if call is within 30s timeout
                 callback(callData);
            } else {
                 callback(null);
            }
        } else {
            callback(null);
        }
    });
};

const hangUpCall = async (callId: string) => {
    const callDocRef = doc(db, 'calls', callId);
    const callDoc = await getDoc(callDocRef);
    if(callDoc.exists()) {
        const iceCandidatesCollectionRef = collection(callDocRef, 'iceCandidates');
        const iceCandidatesSnapshot = await getDocs(iceCandidatesCollectionRef);
        const batch = writeBatch(db);
        iceCandidatesSnapshot.forEach(doc => batch.delete(doc.ref));
        batch.delete(callDocRef);
        await batch.commit();
    }
};

const updateCallData = async (callId: string, data: any) => {
    const callRef = doc(db, 'calls', callId);
    if ((await getDoc(callRef)).exists()) {
        await updateDoc(callRef, data);
    }
}

const addIceCandidate = async (callId: string, userId: string, candidate: any) => {
    const callRef = doc(db, 'calls', callId);
     if ((await getDoc(callRef)).exists()) {
        await addDoc(collection(callRef, 'iceCandidates'), {
            userId,
            candidate,
        });
    }
};

const onIceCandidateAdded = (callId: string, opponentId: string, callback: (candidate: any) => void) => {
    const q = query(collection(db, 'calls', callId, 'iceCandidates'), where('userId', '==', opponentId));
    return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                callback(change.doc.data().candidate);
            }
        });
    });
};

const listenForCallUpdates = (callId: string, callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'calls', callId), (snapshot) => {
        callback(snapshot.data());
    });
};



export { 
    app, 
    auth, 
    db,
    rtdb,
    setupRecaptcha, 
    onAuthUserChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    sendEmailVerification,
    sendPasswordResetEmail,
    getContactByPhone,
    addUserToFirestore,
    getCurrentUser,
    getChatsForUser,
    getMessagesForChat,
    sendMessageInChat,
    updateMessagesStatus,
    createNewGroupInFirestore,
    getAvailableContacts, // Kept for potential other uses, but Create Group will use getContacts
    updateUserProfile,
    manageUserPresence,
    findUserByEmail,
    createChatWithUser,
    getContacts,
    addContact,
    deleteContact,
    clearChatHistory,
    deleteChat,
    updateBlockStatus,
    hashValue,
    compareValue,
    reauthenticateUser,
    deleteMessage,
    deleteMessageForMe,
    updateMessage,
    onUserStatusChange,
    togglePinChat,
    setUserTypingStatus,
    onTypingStatusChange,
    uploadFileForChat,
    uploadAvatar,
    initiateCall,
    answerCall,
    listenForCall,
    hangUpCall,
    updateCallData,
    addIceCandidate,
    onIceCandidateAdded,
    listenForCallUpdates
};
