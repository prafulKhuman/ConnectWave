
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
    documentId
} from "firebase/firestore";
import { getDatabase, ref as rtdbRef, set as rtdbSet, onValue, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
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

    return onSnapshot(chatsQuery, async (chatsSnapshot) => {
        if (chatsSnapshot.empty) {
            callback([]);
            return;
        }
        
        const allParticipantIds = Array.from(new Set(chatsSnapshot.docs.flatMap(d => d.data().participantIds)));
        
        if (allParticipantIds.length === 0) {
            callback([]);
            return;
        }

        // Chunk participant IDs to avoid 'in' query limit of 30
        const participantChunks: string[][] = [];
        for (let i = 0; i < allParticipantIds.length; i += 30) {
            participantChunks.push(allParticipantIds.slice(i, i + 30));
        }

        const participantsMap = new Map<string, Contact>();
        
        for (const chunk of participantChunks) {
            if (chunk.length === 0) continue;
            const usersQuery = query(collection(db, "users"), where(documentId(), "in", chunk));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach(userDoc => {
                 const data = userDoc.data();
                 const lastSeen = data.lastSeen instanceof Timestamp ? data.lastSeen.toDate() : undefined;
                 participantsMap.set(userDoc.id, { id: userDoc.id, ...data, lastSeen } as Contact);
            });
        }


        // Listen to realtime status for all participants
        allParticipantIds.forEach(id => {
            const userStatusRef = rtdbRef(rtdb, '/status/' + id);
            onValue(userStatusRef, (snapshot) => {
                if(snapshot.exists()) {
                    const status = snapshot.val();
                    const user = participantsMap.get(id);
                    if(user) {
                        user.online = status.state === 'online';
                        if(status.state === 'offline') {
                            user.lastSeen = new Date(status.last_changed);
                        }
                    }
                }
            })
        });

        const chatPromises = chatsSnapshot.docs.map(async (chatDoc) => {
            const chatData = chatDoc.data();
            
            const participants = chatData.participantIds
                .map((id: string) => participantsMap.get(id))
                .filter(Boolean) as Contact[];

            const messagesQuery = query(collection(db, "chats", chatDoc.id, "messages"), orderBy("timestamp", "desc"), limit(1));
            const messagesSnapshot = await getDocs(messagesQuery);
            const messages = messagesSnapshot.docs.map(msgDoc => {
                const msgData = msgDoc.data();
                const sender = participantsMap.get(msgData.senderId);
                let content = msgData.content;
                if (msgData.type === 'image') {
                    content = '📷 Photo';
                }
                return { 
                    id: msgDoc.id,
                    content: content,
                    timestamp: msgData.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || '',
                    sender: sender!,
                    type: msgData.type || 'text',
                    edited: msgData.edited || false
                } as Message;
            });

            return {
                id: chatDoc.id,
                ...chatData,
                participants,
                messages,
            } as Chat;
        });

        const chats = await Promise.all(chatPromises);
        callback(chats);
    });
};

const getMessagesForChat = (chatId: string, callback: (messages: Message[]) => void, participants: Contact[]) => {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("timestamp", "asc"));

    return onSnapshot(q, (querySnapshot) => {
        const messages = querySnapshot.docs.map(doc => {
            const data = doc.data();
            let sender = participants.find(p => p.id === data.senderId);
            if (!sender) {
                sender = { id: data.senderId, name: "Unknown User", avatar: '', email: '', pin: '' } as Contact;
            }
            return {
                id: doc.id,
                sender: sender,
                content: data.content,
                timestamp: data.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || '',
                type: data.type || 'text',
                edited: data.edited || false,
            } as Message;
        });
        callback(messages);
    });
};

const sendMessageInChat = async (chatId: string, senderId: string, content: string, type: 'text' | 'image' = 'text') => {
    await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId,
        content,
        type,
        timestamp: serverTimestamp()
    });
}

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
            type: 'text'
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

const uploadImageForChat = async (chatId: string, file: File): Promise<string> => {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `chat-images/${chatId}/${fileName}`);
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
    
    onValue(rtdbRef(rtdb, '.info/connected'), (snapshot) => {
        if (snapshot.val() === false) {
            return;
        }

        onDisconnect(userStatusDatabaseRef).set({
            state: 'offline',
            last_changed: rtdbServerTimestamp(),
        }).then(() => {
            rtdbSet(userStatusDatabaseRef, {
                state: 'online',
                last_changed: rtdbServerTimestamp(),
            });
        });
    });

    // We no longer need to listen here as the main chat listener will handle it.
    // This reduces redundant listeners.
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


export { 
    app, 
    auth, 
    db,
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
    uploadImageForChat,
    hashValue,
    compareValue,
    reauthenticateUser,
    deleteMessage,
    updateMessage,
};

    

    