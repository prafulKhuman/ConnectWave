
export type Contact = {
  id: string;
  name: string;
  avatar: string;
  email: string;
  pin: string;
  online?: boolean;
  lastSeen?: Date; // Using Date object for comparisons
  mobileNumber?: string;
  phone?: string;
};

export type Message = {
  id: string;
  sender: Contact;
  content: string;
  timestamp: string;
  type?: 'text' | 'image';
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
