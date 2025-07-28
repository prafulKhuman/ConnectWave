
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, setPersistence, browserLocalPersistence, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
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
    Timestamp
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid';
import type { Contact, Chat, Message } from './data';
import { formatDistanceToNow } from 'date-fns';


const firebaseConfig = {
  projectId: "connectwave-6mfth",
  appId: "1:833165766531:web:2435082a79fd6f098c50b6",
  storageBucket: "connectwave-6mfth.appspot.com",
  apiKey: "AIzaSyBPcxs52oOTHm42VGbagazgQUKgVCzKV08",
  authDomain: "connectwave-6mfth.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "833165766531"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// This will ensure that the user's session is persisted.
setPersistence(auth, browserLocalPersistence);

const setupRecaptcha = (phone: string) => {
    const recaptchaContainer = document.getElementById('recaptcha-container');
    if (!recaptchaContainer) {
      const newContainer = document.createElement('div');
      newContainer.id = 'recaptcha-container';
      document.body.appendChild(newContainer);
    }
    
    // Ensure the container is empty before creating a new verifier
    while (recaptchaContainer && recaptchaContainer.firstChild) {
      recaptchaContainer.removeChild(recaptchaContainer.firstChild);
    }

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

// Firestore functions
const getContactByPhone = async (phone: string): Promise<Contact | null> => {
    const q = query(collection(db, "users"), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return null;
    }
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as Contact;
}

const addUserToFirestore = async (user: Contact) => {
    await setDoc(doc(db, "users", user.id), user);
}

const getCurrentUser = async (userId: string): Promise<Contact | null> => {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
        const data = userDoc.data();
        let lastSeenFormatted = data.lastSeen;

        // Check if lastSeen is a Firestore Timestamp and format it
        if (data.lastSeen instanceof Timestamp) {
            lastSeenFormatted = formatDistanceToNow(data.lastSeen.toDate(), { addSuffix: true });
        }

        return { 
            id: userDoc.id, 
            ...data,
            lastSeen: lastSeenFormatted 
        } as Contact;
    }
    return null;
};

const getChatsForUser = (userId: string, callback: (chats: Chat[]) => void) => {
    const q = query(collection(db, "chats"), where("participantIds", "array-contains", userId));
    
    return onSnapshot(q, async (querySnapshot) => {
        const chatPromises = querySnapshot.docs.map(async (doc) => {
            const chatData = doc.data();
            
            const participants = await Promise.all(
                chatData.participantIds.map(async (id: string) => {
                    const user = await getCurrentUser(id);
                    return user;
                })
            );

            // Fetch last message for chat list display
            const messagesQuery = query(collection(db, "chats", doc.id, "messages"), orderBy("timestamp", "desc"));
            const messagesSnapshot = await getDocs(messagesQuery);
            const messages = messagesSnapshot.docs.map(msgDoc => {
                const msgData = msgDoc.data();
                const sender = participants.find(p => p?.id === msgData.senderId);
                return { 
                    id: msgDoc.id,
                    content: msgData.content,
                    timestamp: msgData.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || '',
                    sender: sender!
                } as Message;
            });

            return {
                id: doc.id,
                ...chatData,
                participants: participants.filter(Boolean) as Contact[],
                messages: messages,
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
            const sender = participants.find(p => p.id === data.senderId);
            return {
                id: doc.id,
                sender: sender!,
                content: data.content,
                timestamp: data.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || '',
            } as Message;
        });
        callback(messages);
    });
};

const sendMessageInChat = async (chatId: string, senderId: string, content: string) => {
    await addDoc(collection(db, "chats", chatId, "messages"), {
        senderId,
        content,
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
    });

    return chatRef.id;
}

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

const clearChatHistory = async (chatId: string) => {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const querySnapshot = await getDocs(messagesRef);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    await batch.commit();
};

const updateBlockStatus = async (chatId: string, isBlocked: boolean, blockedBy: string) => {
    const chatRef = doc(db, 'chats', chatId);
    await updateDoc(chatRef, {
        'blocked.isBlocked': isBlocked,
        'blocked.by': isBlocked ? blockedBy : ''
    });
};

const updateUserPresence = async (userId: string, online: boolean) => {
    if (!userId) return;
    const userDocRef = doc(db, "users", userId);
    const presenceData: { online: boolean; lastSeen?: any } = { online };
    if (!online) {
      presenceData.lastSeen = serverTimestamp();
    }
    await updateDoc(userDocRef, presenceData);
};


// New Contact Management Functions

const getContacts = (userId: string, callback: (contacts: Contact[]) => void) => {
    const contactsRef = collection(db, 'users', userId, 'contacts');
    return onSnapshot(contactsRef, async (snapshot) => {
        const contactPromises = snapshot.docs.map(async (doc) => {
            const contactData = await getCurrentUser(doc.id);
            return contactData;
        });
        const contacts = (await Promise.all(contactPromises)).filter(Boolean) as Contact[];
        callback(contacts);
    });
};

const addContact = async (userId: string, contactToAdd: Contact) => {
    const contactRef = doc(db, 'users', userId, 'contacts', contactToAdd.id);
    await setDoc(contactRef, { 
        // We can store additional info here if needed, like a nickname
        // For now, just creating the document is enough to establish the relationship
        addedAt: serverTimestamp() 
    });
};

const deleteContact = async (userId: string, contactId: string) => {
    const contactRef = doc(db, 'users', userId, 'contacts', contactId);
    await deleteDoc(contactRef);
};


export { 
    app, 
    auth, 
    db,
    setupRecaptcha, 
    onAuthUserChanged, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    getContactByPhone,
    addUserToFirestore,
    getCurrentUser,
    getChatsForUser,
    getMessagesForChat,
    sendMessageInChat,
    createNewGroupInFirestore,
    getAvailableContacts, // Kept for potential other uses, but Create Group will use getContacts
    updateUserProfile,
    updateUserPresence,
    findUserByEmail,
    createChatWithUser,
    uploadAvatar,
    getContacts,
    addContact,
    deleteContact,
    clearChatHistory,
    updateBlockStatus
};
