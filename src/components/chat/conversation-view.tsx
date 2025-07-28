
'use client';

import * as React from 'react';
import { Phone, Video, MoreVertical, Paperclip, Send, Smile, WifiOff, MessageSquareHeart, Loader2, Trash2, Ban, Eye, UserX } from 'lucide-react';
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
  DropdownMenuSeparator,
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
} from '@/components/ui/alert-dialog';
import { getMessagesForChat, sendMessageInChat, clearChatHistory, updateBlockStatus } from '@/lib/firebase';
import { ViewContactDialog } from './view-contact-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

type ConversationViewProps = {
  selectedChat: Chat | null;
  currentUser: Contact;
};

export function ConversationView({ selectedChat, currentUser }: ConversationViewProps) {
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isClearChatAlertOpen, setIsClearChatAlertOpen] = React.useState(false);
  const [isBlockUserAlertOpen, setIsBlockUserAlertOpen] = React.useState(false);
  const [isViewContactDialogOpen, setIsViewContactDialogOpen] = React.useState(false);
  const [clearChatLoading, setClearChatLoading] = React.useState(false);
  const [blockUserLoading, setBlockUserLoading] = React.useState(false);

  const { toast } = useToast();

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
    if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() && selectedChat) {
      setLoading(true);
      try {
        await sendMessageInChat(selectedChat.id, currentUser.id, newMessage.trim());
        setNewMessage('');
      } catch (error) {
        console.error("Error sending message: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to send message."});
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClearChat = async () => {
    if (!selectedChat) return;
    setClearChatLoading(true);
    try {
      await clearChatHistory(selectedChat.id);
      toast({ title: "Chat Cleared", description: "Your message history has been cleared." });
      setIsClearChatAlertOpen(false);
    } catch (error) {
      console.error("Error clearing chat: ", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to clear chat." });
    } finally {
      setClearChatLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedChat) return;
    setBlockUserLoading(true);
    const isCurrentlyBlocked = selectedChat.blocked?.isBlocked;
    try {
      await updateBlockStatus(selectedChat.id, !isCurrentlyBlocked, currentUser.id);
      toast({ 
        title: isCurrentlyBlocked ? "User Unblocked" : "User Blocked", 
        description: `You have ${isCurrentlyBlocked ? 'unblocked' : 'blocked'} ${otherParticipant?.name}.`
      });
      setIsBlockUserAlertOpen(false);
    } catch (error) {
      console.error("Error blocking user: ", error);
      toast({ variant: "destructive", title: "Error", description: `Failed to ${isCurrentlyBlocked ? 'unblock' : 'block'} user.` });
    } finally {
      setBlockUserLoading(false);
    }
  };
  
  if (!selectedChat) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="m-auto flex flex-col items-center gap-2">
            <MessageSquareHeart className="w-24 h-24 text-primary/20 mb-4" strokeWidth={1} />
            <h2 className="text-2xl font-semibold text-foreground">Welcome to ConnectWave</h2>
            <p className="max-w-sm text-muted-foreground">Select a chat to start messaging or create a new group to connect with friends.</p>
            <div className="mt-6 border-t pt-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <WifiOff className="h-4 w-4" /> Your personal messages are end-to-end encrypted.
                </p>
            </div>
        </div>
      </div>
    );
  }

  const otherParticipant = selectedChat.participants.find((p) => p.id !== currentUser.id);

  const getStatus = (contact: Contact | undefined): string => {
    if (!contact) return '';
    if (contact.online) return 'Online';
    if (contact.lastSeen) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      if (contact.lastSeen > fiveMinutesAgo) {
        return 'Online';
      }
      return `Last seen ${formatDistanceToNow(contact.lastSeen, { addSuffix: true })}`;
    }
    return 'Offline';
  };
  
  const chatDetails = {
    name: selectedChat.type === 'group' ? selectedChat.name : otherParticipant?.name,
    avatar: selectedChat.type === 'group' ? selectedChat.avatar : otherParticipant?.avatar,
    status: selectedChat.type === 'direct' ? getStatus(otherParticipant) : `${selectedChat.participants.length} members`,
  };
  
  const isChatBlocked = selectedChat.blocked?.isBlocked;
  const amIBlocked = isChatBlocked && selectedChat.blocked?.by !== currentUser.id;
  const didIBlock = isChatBlocked && selectedChat.blocked?.by === currentUser.id;

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex-shrink-0 flex items-center justify-between border-b bg-card p-3">
        <div className="flex items-center gap-4">
          <UserAvatar
            user={{
              id: selectedChat.id,
              name: chatDetails.name || 'Unknown',
              avatar: chatDetails.avatar,
              online: chatDetails.status === 'Online'
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
              <DropdownMenuItem onSelect={() => setIsViewContactDialogOpen(true)}>
                <Eye className="mr-2 h-4 w-4" /> View Contact
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsClearChatAlertOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Clear Chat
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsBlockUserAlertOpen(true)} className={didIBlock ? "" : (amIBlocked ? "hidden" : "")}>
                {didIBlock ? <UserX className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                {didIBlock ? 'Unblock' : 'Block'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <ScrollArea
          className="h-full"
          viewportRef={scrollViewportRef}
        >
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
      </div>

      <footer className="flex-shrink-0 border-t bg-card p-3">
        {isChatBlocked ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
             <Ban className="mr-2 h-4 w-4" />
             {didIBlock ? `You blocked ${otherParticipant?.name}.` : `You are blocked by ${otherParticipant?.name}.`}
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Button variant="ghost" size="icon" type="button" disabled={loading}><Smile /></Button>
            <Button variant="ghost" size="icon" type="button" disabled={loading}><Paperclip /></Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1"
              autoComplete="off"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !newMessage.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send />}
            </Button>
          </form>
        )}
      </footer>

      {/* Dialogs */}
      <ViewContactDialog
        isOpen={isViewContactDialogOpen}
        setIsOpen={setIsViewContactDialogOpen}
        contact={otherParticipant}
      />

      <AlertDialog open={isClearChatAlertOpen} onOpenChange={setIsClearChatAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages in this chat. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={clearChatLoading}>
              {clearChatLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBlockUserAlertOpen} onOpenChange={setIsBlockUserAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
                {didIBlock ? 'Unblock User' : 'Block User'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {didIBlock 
                ? `If you unblock ${otherParticipant?.name}, you will be able to send messages again.`
                : `Blocking ${otherParticipant?.name} will prevent them from sending you messages in this chat.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} className={didIBlock ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"} disabled={blockUserLoading}>
              {blockUserLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {didIBlock ? 'Unblock' : 'Block'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
