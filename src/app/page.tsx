
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { auth, onAuthUserChanged, getCurrentUser, getChatsForUser, manageUserPresence, compareValue, hashValue, reauthenticateUser, updateUserProfile, updateMessagesStatus, listenForCall, answerCall, hangUpCall } from '@/lib/firebase';
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
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KeyRound, Loader2, Lock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { rtdb } from '@/lib/firebase';
import { ref, set as rtdbSet, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { useIsMobile } from '@/hooks/use-mobile';
import { IncomingCallDialog } from '@/components/chat/incoming-call-dialog';


export default function Home() {
  const [chats, setChats] = React.useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = React.useState<Chat | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [currentUser, setCurrentUser] = React.useState<Contact | null>(null);
  const [loading, setLoading] = React.useState(true);
  
  const [isPinModalOpen, setIsPinModalOpen] = React.useState(false);
  const [pin, setPin] = React.useState('');
  const [pinLoading, setPinLoading] = React.useState(false);

  const [isForgotPinModalOpen, setIsForgotPinModalOpen] = React.useState(false);
  const [resetPassword, setResetPassword] = React.useState('');
  const [newPin, setNewPin] = React.useState('');
  const [confirmNewPin, setConfirmNewPin] = React.useState('');
  const [forgotPinLoading, setForgotPinLoading] = React.useState(false);
  const [isTabVisible, setIsTabVisible] = React.useState(true);
  const [incomingCall, setIncomingCall] = React.useState<any | null>(null);

  const isMobile = useIsMobile();


  const router = useRouter();
  const { toast } = useToast();

   React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined') {
        setIsTabVisible(document.visibilityState === 'visible');
      }
    };
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  React.useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeChats: (() => void) | undefined;
    let unsubscribePresence: (() => void) | undefined;
    let unsubscribeCalls: (() => void) | undefined;


    const cleanup = () => {
        if (unsubscribeAuth) unsubscribeAuth();
        if (unsubscribeChats) unsubscribeChats();
        if (unsubscribePresence) unsubscribePresence();
        if (unsubscribeCalls) unsubscribeCalls();
    };

    unsubscribeAuth = onAuthUserChanged(async (authUser) => {
        if (unsubscribeChats) unsubscribeChats();
        if (unsubscribePresence) unsubscribePresence();
        if (unsubscribeCalls) unsubscribeCalls();


        if (authUser) {
            setUser(authUser);
            unsubscribePresence = manageUserPresence(authUser.uid);
            const userProfile = await getCurrentUser(authUser.uid);
            
            if (!userProfile) {
                router.push('/login');
                return;
            }
            setCurrentUser(userProfile);

            unsubscribeCalls = listenForCall(userProfile.id, async (call) => {
                if (call && call.status === 'ringing') {
                    const callerProfile = await getCurrentUser(call.callerId);
                    setIncomingCall({ ...call, caller: callerProfile });
                } else {
                    setIncomingCall(null);
                }
            });


            if (userProfile?.pin) {
                setIsPinModalOpen(true);
                setLoading(false);
            } else {
                setLoading(true);
                unsubscribeChats = getChatsForUser(userProfile.id, (newChats) => {
                    setChats(newChats);
                    if (loading) setLoading(false);
                });
            }
        } else {
            setUser(null);
            setCurrentUser(null);
            setChats([]);
            setSelectedChat(null);
            setLoading(false);
            router.push('/login');
        }
    });

    return cleanup;
  }, [router]);

  // Effect to manage selected chat based on chats array
  React.useEffect(() => {
    if (!currentUser) return;

    if (selectedChat) {
        // If a chat is already selected, find its updated version in the new chats array
        const updatedSelectedChat = chats.find(c => c.id === selectedChat.id);
        if (updatedSelectedChat) {
            // Update the selected chat state with the new data, but don't change the selection
            setSelectedChat(updatedSelectedChat);
        } else {
            // The selected chat was deleted or is no longer available, so unselect it
            setSelectedChat(null);
        }
    } else if (chats.length > 0 && !isMobile) {
        // If no chat is selected and we have chats, select the one with the most recent message.
        // On mobile, we don't auto-select a chat.
        const sortedChats = [...chats].sort((a, b) => {
            const isAPinned = a.pinnedBy?.includes(currentUser.id) || false;
            const isBPinned = b.pinnedBy?.includes(currentUser.id) || false;
            if (isAPinned !== isBPinned) return isAPinned ? -1 : 1;

            const timeA = a.messages[0]?.timestamp_raw || 0;
            const timeB = b.messages[0]?.timestamp_raw || 0;
            return timeB - timeA;
        });
        setSelectedChat(sortedChats[0]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, currentUser, isMobile]);


  const isAppLocked = isPinModalOpen || isForgotPinModalOpen;

  React.useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    
    if (!currentUser || isAppLocked) {
        return;
    }

    const userStatusRef = ref(rtdb, '/status/' + currentUser.id);

    const goOffline = () => {
        rtdbSet(userStatusRef, {
            state: 'offline',
            last_changed: rtdbServerTimestamp(),
        });
    };

    const goOnline = () => {
         rtdbSet(userStatusRef, {
            state: 'online',
            last_changed: rtdbServerTimestamp(),
        });
    };

    const resetTimer = () => {
        clearTimeout(inactivityTimer);
        goOnline(); // User is active, set status to online
        inactivityTimer = setTimeout(goOffline, 2 * 60 * 1000); // 2 minutes
    };

    const handleActivity = () => {
        resetTimer();
    };
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    // Initial timer setup
    resetTimer();

    return () => {
        clearTimeout(inactivityTimer);
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keydown', handleActivity);
        window.removeEventListener('click', handleActivity);
        window.removeEventListener('scroll', handleActivity);
    };
  }, [currentUser, isAppLocked]);


  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.pin) return;
    setPinLoading(true);

    const isPinValid = await compareValue(pin, currentUser.pin);

    if (isPinValid) {
      toast({ title: "Access Granted", description: "Welcome back!" });
      setIsPinModalOpen(false);
      setLoading(true); // Will be turned off by chat listener
      getChatsForUser(currentUser.id, (newChats) => {
        setChats(newChats);
        if (loading) setLoading(false);
      });
    } else {
      toast({ variant: 'destructive', title: "Invalid PIN", description: "The PIN you entered is incorrect." });
      setPinLoading(false);
    }
    setPin('');
  }

  const handleForgotPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentUser) return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'New PIN must be exactly 4 digits.' });
        return;
    }
    if (newPin !== confirmNewPin) {
      toast({ variant: 'destructive', title: 'PINs do not match', description: 'Please ensure the new PINs are the same.' });
      return;
    }

    setForgotPinLoading(true);

    try {
        await reauthenticateUser(user, resetPassword);
        
        const hashedPin = await hashValue(newPin);
        await updateUserProfile(currentUser.id, { pin: hashedPin });
        
        const updatedUser = await getCurrentUser(currentUser.id);
        setCurrentUser(updatedUser);

        toast({ title: "PIN Reset Successful", description: "Your App Lock PIN has been changed." });
        
        setIsForgotPinModalOpen(false);
        setIsPinModalOpen(false); // Close forgot pin, and also close the main pin modal
        
        setLoading(true); // Will be turned off by chat listener
        getChatsForUser(currentUser.id, (newChats) => {
            setChats(newChats);
            if (loading) setLoading(false);
        });

    } catch (error: any) {
        let errorMessage = 'Failed to reset PIN. Please try again.';
        if(error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = 'The password you entered is incorrect.';
        }
        toast({ variant: 'destructive', title: 'Error', description: errorMessage });
    } finally {
        setResetPassword('');
        setNewPin('');
        setConfirmNewPin('');
        setForgotPinLoading(false);
    }
  }

  const handleAcceptCall = async () => {
    if (!incomingCall || !currentUser) return;
    await answerCall(incomingCall.id, currentUser.id);
    const opponentId = incomingCall.callerId;
    router.push(`/call/${incomingCall.id}?type=${incomingCall.type}&opponent=${opponentId}`);
    setIncomingCall(null);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    await hangUpCall(incomingCall.id);
    setIncomingCall(null);
  };


  if (loading && !isAppLocked) {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting...</p>
            </div>
        </div>
    );
  }
  
  return (
    <main className="h-screen w-full bg-background">
      <IncomingCallDialog 
        call={incomingCall} 
        onAccept={handleAcceptCall} 
        onDecline={handleDeclineCall} 
      />

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
            <DialogFooter className="pt-2">
                <Button variant="link" className="text-sm h-auto p-0 mx-auto" onClick={() => { setIsPinModalOpen(false); setIsForgotPinModalOpen(true);}}>
                    Forgot PIN?
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isForgotPinModalOpen} onOpenChange={setIsForgotPinModalOpen}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="text-2xl">Reset App Lock PIN</DialogTitle>
              <DialogDescription>
                Enter your account password to set a new PIN.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgotPinSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            id="password"
                            type="password"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                            placeholder="Enter your account password"
                            className="pl-10"
                            required
                            disabled={forgotPinLoading}
                        />
                    </div>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="new-pin">New 4-Digit PIN</Label>
                  <Input id="new-pin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} maxLength={4} disabled={forgotPinLoading} required />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="confirm-new-pin">Confirm New PIN</Label>
                  <Input id="confirm-new-pin" type="password" value={confirmNewPin} onChange={(e) => setConfirmNewPin(e.target.value)} maxLength={4} disabled={forgotPinLoading} required/>
                </div>
                <DialogFooter className="!flex-row !justify-between items-center pt-2">
                    <Button type="button" variant="outline" onClick={() => { setIsForgotPinModalOpen(false); setIsPinModalOpen(true); }} disabled={forgotPinLoading}>
                       <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button type="submit" className="w-fit" disabled={forgotPinLoading}>
                        {forgotPinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Set New PIN
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    
      <div className={cn('h-full w-full transition-all duration-300', (isAppLocked || !!incomingCall) && 'blur-sm pointer-events-none')}>
        <SidebarProvider>
            <div className="h-screen w-full flex">
            {currentUser && !isAppLocked && (
              <>
                <div className={cn(
                  "h-full w-full md:w-[380px] md:border-r",
                  (isMobile && selectedChat) && "hidden"
                )}>
                  <ChatList
                    chats={chats}
                    selectedChat={selectedChat}
                    setSelectedChat={setSelectedChat}
                    currentUser={currentUser}
                  />
                </div>
                <div className={cn(
                  "h-full flex-1",
                   (!selectedChat) && "hidden md:flex"
                )}>
                  <ConversationView 
                    key={selectedChat?.id} 
                    selectedChat={selectedChat} 
                    currentUser={currentUser} 
                    isTabVisible={isTabVisible} 
                    onBack={() => setSelectedChat(null)}
                  />
                </div>
              </>
            )}
            </div>
        </SidebarProvider>
      </div>
    </main>
  );
}
