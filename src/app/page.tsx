'use client';

import * as React from 'react';
import { ChatList } from '@/components/chat/chat-list';
import { ConversationView } from '@/components/chat/conversation-view';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Chat } from '@/lib/data';
import { chats as initialChats } from '@/lib/data';

export default function Home() {
  const [chats] = React.useState<Chat[]>(initialChats);
  const [selectedChat, setSelectedChat] = React.useState<Chat | null>(chats[0] || null);

  return (
    <main className="min-h-screen bg-background">
      <SidebarProvider>
        <div className="flex h-screen">
          <Sidebar side="left" className="w-full max-w-sm border-r" collapsible="none">
            <ChatList
              chats={chats}
              selectedChat={selectedChat}
              setSelectedChat={setSelectedChat}
            />
          </Sidebar>
          <SidebarInset className="flex-1">
            <ConversationView selectedChat={selectedChat} />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </main>
  );
}
