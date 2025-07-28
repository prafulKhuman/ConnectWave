
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { auth, onAuthUserChanged, getCurrentUser, getChatsForUser, manageUserPresence, compareValue } from '@/lib/firebase';
import { User } from 'firebase/auth';
import { ChatList } from '@/components/chat/chat-list';
import { ConversationView } from '@/components/chat/conversation-view';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { Chat, Contact } from '@/lib/data';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KeyRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = React.useState<Chat | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [currentUser, setCurrentUser] = React.useState<Contact | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [isPinModalOpen, setIsPinModalOpen] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [pinLoading, setPinLoading] = React.useState(false);

  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    const unsubscribeAuth = onAuthUserChanged(async (user) => {
      if (user) {
        setUser(user);
        manageUserPresence(user.uid);
        
        const userProfile = await getCurrentUser(user.uid);
        setCurrentUser(userProfile);
        
        if (userProfile) {
          // Check for App Lock PIN
          if (userProfile.pin) {
            setIsPinModalOpen(true);
          }

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

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.pin) return;
    setPinLoading(true);
    const isPinValid = await compareValue(pin, currentUser.pin);
    if (isPinValid) {
        toast({ title: "Access Granted", description: "Welcome back!" });
        setIsPinModalOpen(false);
    } else {
        toast({ variant: 'destructive', title: "Invalid PIN", description: "The PIN you entered is incorrect." });
    }
    setPin('');
    setPinLoading(false);
  }


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
      <Dialog open={isPinModalOpen} onOpenChange={setIsPinModalOpen}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} hideCloseButton>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Enter App Lock PIN</DialogTitle>
              <DialogDescription className="text-center">
                Enter your 4-digit PIN to unlock the application.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePinSubmit} className="space-y-4">
                <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="****"
                        className="pl-10 text-center tracking-[0.5em]"
                        maxLength={4}
                        required
                        disabled={pinLoading}
                    />
                </div>
                <Button type="submit" className="w-full" disabled={pinLoading}>
                    {pinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Unlock
                </Button>
            </form>
        </DialogContent>
      </Dialog>
    
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
