
export type Contact = {
  id: string;
  name: string;
  avatar: string;
  email: string;
  pin?: string; // Optional, as it's set after login
  online?: boolean;
  lastSeen?: Date; // Using Date object for comparisons
  mobileNumber: string;
};

export type Message = {
  id: string;
  sender: Contact;
  content: string; // URL for files, text for text messages
  timestamp: string;
  timestamp_raw: number; // for sorting
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  status: 'sent' | 'delivered' | 'read';
  edited?: boolean;
  fileName?: string; // e.g., 'document.pdf'
};

export type Chat = {
  id:string;
  type: 'direct' | 'group';
  participants: Contact[];
  participantIds: string[];
  messages: Message[];
  name?: string; // For group chats
  avatar?: string; // For group chats
  pinnedBy?: string[];
  blocked?: {
    isBlocked: boolean;
    by: string; // userId of who initiated the block
  };
  unreadCount?: number;
};
