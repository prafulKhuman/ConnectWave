'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ChatList } from '@/components/chat/chat-list';
import { ConversationView } from '@/components/chat/conversation-view';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Chat } from '@/lib/data';
import { chats as initialChats } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const [chats] = React.useState<Chat[]>(initialChats);
  const [selectedChat, setSelectedChat] = React.useState<Chat | null>(chats[0] || null);
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        </div>
    );
  }
  
  if (!user) {
    return null;
  }

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
