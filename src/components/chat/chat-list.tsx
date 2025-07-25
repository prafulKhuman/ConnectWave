'use client';

import * as React from 'react';
import { Search, MessageSquarePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Chat } from '@/lib/data';
import { currentUser } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import { NewGroupDialog } from './new-group-dialog';

type ChatListProps = {
  chats: Chat[];
  selectedChat: Chat | null;
  setSelectedChat: (chat: Chat) => void;
};

export function ChatList({ chats, selectedChat, setSelectedChat }: ChatListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const getChatDetails = (chat: Chat) => {
    if (chat.type === 'group') {
      return { name: chat.name, avatar: chat.avatar };
    }
    const otherParticipant = chat.participants.find((p) => p.id !== currentUser.id);
    return { name: otherParticipant?.name, avatar: otherParticipant?.avatar };
  };

  const filteredChats = chats.filter((chat) => {
    const details = getChatDetails(chat);
    return details.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={currentUser} />
          <h1 className="text-xl font-bold">Chats</h1>
        </div>
        <NewGroupDialog />
      </header>

      <div className="flex-shrink-0 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-3 pt-0">
          <ul className="space-y-1">
            {filteredChats.map((chat) => {
              const details = getChatDetails(chat);
              const lastMessage = chat.messages[chat.messages.length - 1];

              return (
                <li key={chat.id}>
                  <button
                    onClick={() => setSelectedChat(chat)}
                    className={cn(
                      'flex w-full items-center gap-4 rounded-lg p-3 text-left transition-colors hover:bg-muted',
                      selectedChat?.id === chat.id && 'bg-primary/20 hover:bg-primary/20'
                    )}
                  >
                    <UserAvatar
                      user={{
                        id: chat.id,
                        name: details.name || 'Unknown',
                        avatar: details.avatar || `https://placehold.co/100x100.png`,
                        online: chat.type === 'direct' ? chat.participants.find(p => p.id !== currentUser.id)?.online : false
                      }}
                      className="h-12 w-12"
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-baseline justify-between">
                        <p className="truncate font-semibold">{details.name}</p>
                        <time className="text-xs text-muted-foreground">
                          {lastMessage?.timestamp}
                        </time>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {lastMessage?.content}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </ScrollArea>
    </div>
  );
}
