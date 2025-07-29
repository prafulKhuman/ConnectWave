
'use client';

import * as React from 'react';
import { Search, LogOut, Settings, MoreVertical, Trash2, MessageSquareX, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Chat, Contact } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import { NewGroupDialog } from './new-group-dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth, clearChatHistory, deleteChat, onUserStatusChange } from '@/lib/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { SettingsDialog } from './settings-dialog';

type ChatListProps = {
  chats: Chat[];
  selectedChat: Chat | null;
  setSelectedChat: (chat: Chat | null) => void;
  currentUser: Contact;
};

export function ChatList({ chats, selectedChat, setSelectedChat, currentUser }: ChatListProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [dialogState, setDialogState] = React.useState<{ clearChatId?: string; deleteChatId?: string }>({});
  const [actionLoading, setActionLoading] = React.useState(false);
  const [localChats, setLocalChats] = React.useState<Chat[]>(chats);

  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    if (!currentUser) return; // Add guard clause
    setLocalChats(chats);

    const unsubscribers = chats.flatMap(chat => {
      if (chat.type === 'direct') {
        const otherParticipant = chat.participants.find(p => p.id !== currentUser.id);
        if (otherParticipant) {
          return [onUserStatusChange(otherParticipant.id, (status) => {
            setLocalChats(prevChats => {
              return prevChats.map(c => {
                if (c.id === chat.id) {
                  const updatedParticipants = c.participants.map(p => {
                    if (p.id === otherParticipant.id) {
                      return { ...p, online: status.state === 'online', lastSeen: new Date(status.last_changed) };
                    }
                    return p;
                  });
                  return { ...c, participants: updatedParticipants };
                }
                return c;
              });
            });
          })];
        }
      }
      return [];
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [chats, currentUser]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      router.push('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to log out. Please try again.',
      });
    } finally {
        setLoading(false);
    }
  };

  const handleClearChat = async (chatId: string) => {
    setActionLoading(true);
    try {
      await clearChatHistory(chatId);
      toast({ title: 'Chat Cleared', description: 'The message history for this chat has been cleared.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear chat.' });
    } finally {
      setActionLoading(false);
      setDialogState({});
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    setActionLoading(true);
    try {
      await deleteChat(chatId);
      toast({ title: 'Chat Deleted', description: 'The chat has been permanently deleted.' });
      if (selectedChat?.id === chatId) {
        setSelectedChat(null);
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete chat.' });
    } finally {
      setActionLoading(false);
      setDialogState({});
    }
  };

  const getChatDetails = (chat: Chat) => {
    if (chat.type === 'group') {
      return { name: chat.name, avatar: chat.avatar };
    }
    const otherParticipant = chat.participants.find((p) => p.id !== currentUser.id);
    return { name: otherParticipant?.name, avatar: otherParticipant?.avatar, online: otherParticipant?.online };
  };

  const filteredChats = localChats.filter((chat) => {
    const details = getChatDetails(chat);
    return details.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex flex-shrink-0 items-center justify-between border-b p-3">
        <div className="flex items-center gap-3">
          <UserAvatar user={currentUser} />
          <h1 className="text-xl font-bold">Chats</h1>
        </div>
        <div className="flex items-center gap-1">
          <NewGroupDialog currentUser={currentUser} />
           <SettingsDialog currentUser={currentUser} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be returned to the login screen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Logout
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
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
              const lastMessage = chat.messages[0];

              return (
                <li key={chat.id} className="relative group">
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
                        avatar: details.avatar,
                        online: chat.type === 'direct' ? details.online : false
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
                        {lastMessage?.content || 'No messages yet.'}
                      </p>
                    </div>
                  </button>
                   <div className="absolute top-1/2 right-2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <AlertDialog open={dialogState.clearChatId === chat.id} onOpenChange={(open) => setDialogState(prev => ({...prev, clearChatId: open ? chat.id : undefined}))}>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <MessageSquareX className="mr-2 h-4 w-4" /> Clear Chat
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Clear this chat?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently clear all messages in this conversation. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleClearChat(chat.id)} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Clear Chat
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                             <AlertDialog open={dialogState.deleteChatId === chat.id} onOpenChange={(open) => setDialogState(prev => ({...prev, deleteChatId: open ? chat.id : undefined}))}>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Chat
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the chat and all its messages for everyone. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteChat(chat.id)} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Delete Chat
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                   </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </ScrollArea>
    </div>
  );
}
