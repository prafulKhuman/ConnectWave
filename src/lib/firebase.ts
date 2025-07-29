
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
    if (chatsSnapshot.empty) {
      callback([]);
      return;
    }

    const allParticipantIds = Array.from(new Set(chatsSnapshot.docs.flatMap(d => d.data().participantIds)));
    
    if (allParticipantIds.length === 0) {
      callback([]);
      return;
    }

    const participantsMap = new Map<string, Contact>();
    
    const participantChunks: string[][] = [];
    for (let i = 0; i < allParticipantIds.length; i += 30) {
        participantChunks.push(allParticipantIds.slice(i, i + 30));
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

    const chatPromises = chatsSnapshot.docs.map(async (chatDoc) => {
        const chatData = chatDoc.data();
        
        const participants = chatData.participantIds
            .map((id: string) => participantsMap.get(id))
            .filter(Boolean) as Contact[];

        // Get last message
        const messagesQuery = query(collection(db, "chats", chatDoc.id, "messages"), orderBy("timestamp", "desc"), limit(1));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        // Get unread count
        const unreadQuery = query(collection(db, "chats", chatDoc.id, "messages"), where("status", "!=", "read"), where("senderId", "!=", userId));
        const unreadSnapshot = await getDocs(unreadQuery);
        const unreadCount = unreadSnapshot.size;

        const messages = messagesSnapshot.docs.map(msgDoc => {
            const msgData = msgDoc.data();
            const sender = participantsMap.get(msgData.senderId);
            let contentPreview = msgData.content;
            
            switch (msgData.type) {
                case 'image':
                    contentPreview = `📷 ${msgData.fileName || 'Image'}`;
                    break;
                case 'video':
                    contentPreview = `📹 ${msgData.fileName || 'Video'}`;
                    break;
                case 'audio':
                    contentPreview = `🎵 ${msgData.fileName || 'Audio'}`;
                    break;
                case 'file':
                    contentPreview = `📄 ${msgData.fileName || 'File'}`;
                    break;
                default: // text
                    contentPreview = msgData.content;
            }

            return { 
                id: msgDoc.id,
                content: contentPreview,
                timestamp: msgData.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || '',
                sender: sender!,
                type: msgData.type || 'text',
                status: msgData.status || 'sent',
                edited: msgData.edited || false,
                fileName: msgData.fileName
            } as Message;
        });

        return {
            id: chatDoc.id,
            ...chatData,
            participants,
            messages,
            unreadCount,
        } as Chat;
    });
    
    const chats = (await Promise.all(chatPromises)).sort((a, b) => {
        const lastMessageA = a.messages[0];
        const lastMessageB = b.messages[0];

        // A chat without messages should be sorted last.
        if (!lastMessageA) return 1;
        if (!lastMessageB) return -1;
        
        // Convert timestamp to a comparable format.
        const timeA = lastMessageA.timestamp || '0';
        const timeB = lastMessageB.timestamp || '0';
        
        // This is a simplified comparison; for accuracy, convert to Date objects
        // However, for typical 'hh:mm AM/PM' it might not sort correctly across days.
        // A better approach would be to sort by the original server timestamp.
        // For now, let's assume this is sufficient for intra-day sorting.
        return timeB.localeCompare(timeA);
    });

    callback(chats);
  });

  return unsubscribe;
};

const getMessagesForChat = (chatId: string, callback: (messages: Message[]) => void, initialParticipants: Contact[]) => {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));
    const participantsMap = new Map(initialParticipants.map(p => [p.id, p]));

    return onSnapshot(q, (querySnapshot) => {
        const messages = querySnapshot.docs.map(doc => {
            const data = doc.data();
            const sender = participantsMap.get(data.senderId) || { id: data.senderId, name: "Unknown User", avatar: '', email: '', pin: '' } as Contact;
            
            return {
                id: doc.id,
                sender: sender,
                content: data.content,
                timestamp: data.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || '',
                type: data.type || 'text',
                status: data.status || 'sent',
                edited: data.edited || false,
                fileName: data.fileName || ''
            } as Message;
        });
        callback(messages);
    });
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

const uploadAvatar = async (userId: string, file: File): Promise<string> => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `avatars/${userId}/${fileName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
};

const uploadFileForChat = async (chatId: string, file: File, type: Message['type']): Promise<string> => {
    let folder = 'chat-files';
    if (type === 'image') folder = 'chat-images';
    if (type === 'video') folder = 'chat-videos';
    if (type === 'audio') folder = 'chat-audio';

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `${folder}/${chatId}/${fileName}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
}

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
        return;
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

        onDisconnect(userStatusDatabaseRef).set(offlineStatus).then(() => {
            const onlineStatus = {
                state: 'online',
                last_changed: rtdbServerTimestamp(),
            };
            rtdbSet(userStatusDatabaseRef, onlineStatus);
            updateDoc(userFirestoreRef, {
                online: true
            });
        });
    });

    return () => {
        unsubscribe();
        goOffline(rtdb);
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

const deleteMessage = async (chatId: string, messageId: string) => {
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    await deleteDoc(messageRef);
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
        // Optional: Add a timeout to automatically remove typing status
        // This is a failsafe in case the client disconnects abruptly
        setTimeout(() => {
            rtdbSet(typingStatusRef, null);
        }, 3000);
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
    uploadAvatar,
    getContacts,
    addContact,
    deleteContact,
    clearChatHistory,
    deleteChat,
    updateBlockStatus,
    uploadFileForChat,
    hashValue,
    compareValue,
    reauthenticateUser,
    deleteMessage,
    updateMessage,
    onUserStatusChange,
    togglePinChat,
    setUserTypingStatus,
    onTypingStatusChange
};
