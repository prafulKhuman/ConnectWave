
'use client';

import * as React from 'react';
import { Phone, Video, MoreVertical, Paperclip, Send, Smile, WifiOff, MessageSquareHeart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Chat, Message, Contact } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Image from 'next/image';
import { getMessagesForChat, sendMessageInChat } from '@/lib/firebase';

type ConversationViewProps = {
  selectedChat: Chat | null;
  currentUser: Contact;
};

export function ConversationView({ selectedChat, currentUser }: ConversationViewProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');

  React.useEffect(() => {
    if (selectedChat) {
      const unsubscribe = getMessagesForChat(selectedChat.id, setMessages, selectedChat.participants);
      return () => unsubscribe();
    }
  }, [selectedChat]);
  
  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
        const scrollableView = scrollAreaRef.current.querySelector('div');
        if (scrollableView) {
            scrollableView.scrollTop = scrollableView.scrollHeight;
        }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      await sendMessageInChat(selectedChat.id, currentUser.id, newMessage.trim());
      setNewMessage('');
    }
  };

  if (!selectedChat) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-muted-foreground">
        <MessageSquareHeart className="w-24 h-24 text-primary/20 mb-4" strokeWidth={1} />
        <h2 className="text-2xl font-semibold text-foreground">Welcome to ConnectWave</h2>
        <p>Select a chat to start messaging.</p>
        <p className="mt-4 flex items-center gap-2 text-sm">
          <WifiOff className="h-4 w-4" /> Your messages are end-to-end encrypted.
        </p>
      </div>
    );
  }

  const otherParticipant = selectedChat.participants.find((p) => p.id !== currentUser.id);
  const chatDetails = {
    name: selectedChat.type === 'group' ? selectedChat.name : otherParticipant?.name,
    avatar: selectedChat.type === 'group' ? selectedChat.avatar : otherParticipant?.avatar,
    status: selectedChat.type === 'direct' ? (otherParticipant?.online ? 'Online' : `Last seen ${otherParticipant?.lastSeen || 'recently'}`) : `${selectedChat.participants.length} members`,
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b bg-card p-3">
        <div className="flex items-center gap-4">
          <UserAvatar
            user={{
              id: selectedChat.id,
              name: chatDetails.name || 'Unknown',
              avatar: chatDetails.avatar || `https://placehold.co/100x100.png`,
              online: selectedChat.type === 'direct' ? otherParticipant?.online : false
            }}
          />
          <div>
            <h2 className="font-semibold">{chatDetails.name}</h2>
            <p className="text-sm text-muted-foreground">{chatDetails.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>View Contact</DropdownMenuItem>
              <DropdownMenuItem>Clear Chat</DropdownMenuItem>
              <DropdownMenuItem>Block</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ScrollArea className="flex-1 bg-background/80" ref={scrollAreaRef}>
        <div className="p-4 sm:p-6 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn('flex animate-in fade-in-25 slide-in-from-bottom-4 duration-300',
                message.sender.id === currentUser.id ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn('max-w-xs md:max-w-md lg:max-w-lg rounded-xl px-4 py-2.5',
                  message.sender.id === currentUser.id
                    ? 'bg-primary/80 text-primary-foreground'
                    : 'bg-card'
                )}
              >
                {selectedChat.type === 'group' && message.sender.id !== currentUser.id && (
                  <p className="text-xs font-semibold text-primary pb-1">{message.sender.name}</p>
                )}
                <p className="text-sm">{message.content}</p>
                <p className="mt-1 text-right text-xs text-muted-foreground/80">
                  {message.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <footer className="border-t bg-card p-3">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Button variant="ghost" size="icon" type="button"><Smile /></Button>
          <Button variant="ghost" size="icon" type="button"><Paperclip /></Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon"><Send /></Button>
        </form>
      </footer>
    </div>
  );
}
