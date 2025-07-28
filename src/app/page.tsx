
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
import { signOut } from 'firebase/auth';

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
             // Only stop loading when chats are loaded
            if (loading) {
              setLoading(false);
            }
            if (!selectedChat && newChats.length > 0) {
              setSelectedChat(newChats[0]);
            } else if (selectedChat) {
              const updatedSelectedChat = newChats.find(c => c.id === selectedChat.id);
              setSelectedChat(updatedSelectedChat || newChats[0] || null);
            } else {
              setSelectedChat(null);
            }
          });
          return () => {
            unsubscribeChats();
          }
        } else {
            // User exists in Auth but not in Firestore, treat as an error/logged-out state
            setLoading(false);
            router.push('/login');
        }

      } else {
        // No user is signed in.
        router.push('/login');
        setLoading(false);
      }
    });

    return () => {
        // No need to sign out here, onDisconnect handles it.
        unsubscribeAuth();
    };
  // The dependency array is crucial. We only re-run this when the router object changes.
  // We avoid including state that changes within the effect (like selectedChat or loading) to prevent loops.
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
  
  // This check is now safe because `loading` is false
  if (!user) {
    router.push('/login');
    return null; // Render nothing while redirecting
  }

  return (
    <main className="h-screen w-full bg-background">
      <SidebarProvider>
        <div className="flex h-full w-full">
          <Sidebar side="left" className="h-full w-full max-w-sm border-r" collapsible="none">
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
