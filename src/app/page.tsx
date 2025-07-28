
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { auth, onAuthUserChanged, getCurrentUser, getChatsForUser, manageUserPresence } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { ChatList } from '@/components/chat/chat-list';
import { ConversationView } from '@/components/chat/conversation-view';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Chat, Contact } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = React.useState<Chat | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [currentUser, setCurrentUser] = React.useState<Contact | null>(null);
  const [loading, setLoading] = React.useState(true);
  const router = useRouter();

  React.useEffect(() => {
    const unsubscribeAuth = onAuthUserChanged(async (user) => {
      if (user) {
        setUser(user);
        manageUserPresence(user.uid);
        
        const userProfile = await getCurrentUser(user.uid);
        setCurrentUser(userProfile);
        
        if (userProfile) {
          const unsubscribeChats = getChatsForUser(userProfile.id, (newChats) => {
            setChats(newChats);

            if (loading) {
              setLoading(false);
            }
            // Update selected chat with new data if it exists, or select the first chat.
            if (selectedChat) {
              const updatedSelectedChat = newChats.find(c => c.id === selectedChat.id);
              setSelectedChat(updatedSelectedChat || newChats[0] || null);
            } else {
              setSelectedChat(newChats[0] || null);
            }
          });
          return () => unsubscribeChats();
        } else {
            setLoading(false);
            router.push('/login');
        }

      } else {
        setLoading(false);
        router.push('/login');
      }
    });

    return () => unsubscribeAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);


  if (loading || !currentUser) {
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
    router.push('/login');
    return null; // Render nothing while redirecting
  }

  return (
    <main className="h-screen w-full bg-background">
      <SidebarProvider>
        <div className="flex h-full w-full">
          <Sidebar side="left" className=" h-auto w-full max-w-sm border-r" style={{}} collapsible="none">
            <ChatList
              chats={chats}
              selectedChat={selectedChat}
              setSelectedChat={setSelectedChat}
              currentUser={currentUser}
            />
          </Sidebar>
          <SidebarInset className="flex flex-1 flex-col">
            <ConversationView selectedChat={selectedChat} currentUser={currentUser}/>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </main>
  );
}
