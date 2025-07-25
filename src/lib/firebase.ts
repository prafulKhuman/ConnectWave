
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
    serverTimestamp
} from "firebase/firestore";
import type { Contact, Chat, Message } from './data';

const firebaseConfig = {
  projectId: "connectwave-6mfth",
  appId: "1:833165766531:web:2435082a79fd6f098c50b6",
  storageBucket: "connectwave-6mfth.firebasestorage.app",
  apiKey: "AIzaSyBPcxs52oOTHm42VGbagazgQUKgVCzKV08",
  authDomain: "connectwave-6mfth.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "833165766531"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// This will ensure that the user's session is persisted.
setPersistence(auth, browserLocalPersistence);

const setupRecaptcha = (phone: string) => {
    const recaptchaContainer = document.getElementById('recaptcha-container');
    if (!recaptchaContainer) {
      const newContainer = document.createElement('div');
      newContainer.id = 'recaptcha-container';
      document.body.appendChild(newContainer);
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
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as Contact;
    }
    return null;
};

const getChatsForUser = (userId: string, callback: (chats: Chat[]) => void) => {
    const q = query(collection(db, "chats"), where("participantIds", "array-contains", userId));
    
    return onSnapshot(q, async (querySnapshot) => {
        const chats: Chat[] = [];
        for (const doc of querySnapshot.docs) {
            const chatData = doc.data();
            
            const participants = await Promise.all(
                chatData.participantIds.map(async (id: string) => {
                    const user = await getCurrentUser(id);
                    return user || {} as Contact;
                })
            );

            // Fetch messages for each chat
            const messagesQuery = query(collection(db, "chats", doc.id, "messages"), orderBy("timestamp", "asc"));
            const messagesSnapshot = await getDocs(messagesQuery);
            const messages = messagesSnapshot.docs.map(msgDoc => {
                const msgData = msgDoc.data();
                const sender = participants.find(p => p.id === msgData.senderId);
                return { 
                    id: msgDoc.id,
                    content: msgData.content,
                    timestamp: msgData.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || 'N/A',
                    sender: sender!
                } as Message;
            });


            chats.push({
                id: doc.id,
                ...chatData,
                participants,
                messages
            } as Chat);
        }
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
                timestamp: data.timestamp?.toDate().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true }) || 'N/A',
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
    return chatRef.id;
}

const getAvailableContacts = (currentUserId: string, callback: (contacts: Contact[]) => void) => {
    const q = query(collection(db, "users"), where("id", "!=", currentUserId));
    return onSnapshot(q, (querySnapshot) => {
        const contacts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
        callback(contacts);
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
    getContactByPhone,
    addUserToFirestore,
    getCurrentUser,
    getChatsForUser,
    getMessagesForChat,
    sendMessageInChat,
    createNewGroupInFirestore,
    getAvailableContacts
};
