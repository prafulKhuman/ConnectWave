
export type Contact = {
  id: string;
  name: string;
  avatar: string;
  email: string;
  pin: string;
  password: string;
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
  id:string;
  type: 'direct' | 'group';
  participants: Contact[];
  participantIds: string[];
  messages: Message[];
  name?: string; // For group chats
  avatar?: string; // For group chats
  blocked?: {
    isBlocked: boolean;
    by: string; // userId of who initiated the block
  };
};

