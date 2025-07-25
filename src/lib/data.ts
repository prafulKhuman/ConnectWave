export type Contact = {
  id: string;
  name: string;
  avatar: string;
  online?: boolean;
  lastSeen?: string;
  phone?: string;
};

export type Message = {
  id: string;
  sender: Contact;
  content: string;
  timestamp: string;
};

export type Chat = {
  id: string;
  type: 'direct' | 'group';
  participants: Contact[];
  messages: Message[];
  name?: string; // For group chats
  avatar?: string; // For group chats
};

export const contacts: Contact[] = [
  { id: 'user1', name: 'You', avatar: `https://placehold.co/100x100.png`, online: true, phone: '+1234567890' },
  { id: 'user2', name: 'Alice', avatar: `https://placehold.co/100x100.png`, online: true, phone: '+1234567891' },
  { id: 'user3', name: 'Bob', avatar: `https://placehold.co/100x100.png`, lastSeen: '5m ago', phone: '+1234567892' },
  { id: 'user4', name: 'Charlie', avatar: `https://placehold.co/100x100.png`, lastSeen: '1h ago', phone: '+1234567893' },
  { id: 'user5', name: 'Diana', avatar: `https://placehold.co/100x100.png`, online: true, phone: '+1234567894' },
  { id: 'user6', name: 'Ethan', avatar: `https://placehold.co/100x100.png`, lastSeen: 'yesterday', phone: '+1234567895' },
];

const [you, alice, bob, charlie, diana, ethan] = contacts;

export const chats: Chat[] = [
  {
    id: 'chat1',
    type: 'direct',
    participants: [you, alice],
    messages: [
      { id: 'msg1', sender: alice, content: 'Hey, how are you?', timestamp: '10:30 AM' },
      { id: 'msg2', sender: you, content: 'I am good, thanks! How about you?', timestamp: '10:31 AM' },
      { id: 'msg3', sender: alice, content: 'Doing great! Working on the new project.', timestamp: '10:32 AM' },
    ],
  },
  {
    id: 'chat2',
    type: 'group',
    name: 'Project Team',
    avatar: 'https://placehold.co/100x100.png',
    participants: [you, alice, bob, charlie],
    messages: [
      { id: 'msg4', sender: bob, content: 'Team, let\'s sync up at 3 PM.', timestamp: '11:00 AM' },
      { id: 'msg5', sender: you, content: 'Sounds good to me!', timestamp: '11:01 AM' },
      { id: 'msg6', sender: alice, content: 'I have another meeting then, can we do 4 PM?', timestamp: '11:02 AM' },
      { id: 'msg7', sender: charlie, content: '4 PM works for me.', timestamp: '11:03 AM' },
    ],
  },
  {
    id: 'chat3',
    type: 'direct',
    participants: [you, bob],
    messages: [
      { id: 'msg8', sender: bob, content: 'Can you review my PR?', timestamp: '9:15 AM' },
      { id: 'msg9', sender: you, content: 'Sure, I will take a look this morning.', timestamp: '9:16 AM' },
    ],
  },
  {
    id: 'chat4',
    type: 'direct',
    participants: [you, diana],
    messages: [
      { id: 'msg10', sender: diana, content: 'Lunch today?', timestamp: 'Yesterday' },
      { id: 'msg11', sender: you, content: 'Absolutely! The usual spot?', timestamp: 'Yesterday' },
    ],
  },
    {
    id: 'chat5',
    type: 'group',
    name: 'Weekend Plans',
    avatar: 'https://placehold.co/100x100.png',
    participants: [you, diana, ethan],
    messages: [
      { id: 'msg12', sender: ethan, content: 'Anyone up for a hike this weekend?', timestamp: 'Yesterday' },
      { id: 'msg13', sender: diana, content: 'I am in!', timestamp: 'Yesterday' },
      { id: 'msg14', sender: you, content: 'Me too! What time?', timestamp: 'Yesterday' },
    ],
  },
];

export const currentUser = you;
