
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Phone, Video, MoreVertical, Paperclip, Send, Smile, WifiOff, MessageSquareHeart, Loader2, Trash2, Ban, Eye, UserX, PenSquare, MoreHorizontal, File as FileIcon, Music, VideoIcon } from 'lucide-react';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { getMessagesForChat, sendMessageInChat, clearChatHistory, updateBlockStatus, uploadFileForChat, deleteMessage, updateMessage, onUserStatusChange } from '@/lib/firebase';
import { ViewContactDialog } from './view-contact-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import type { EmojiClickData } from 'emoji-picker-react';
import { Textarea } from '@/components/ui/textarea';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/ogg',
    'audio/mpeg', 'audio/ogg', 'audio/wav',
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

type ConversationViewProps = {
  selectedChat: Chat | null;
  currentUser: Contact;
};

export function ConversationView({ selectedChat, currentUser }: ConversationViewProps) {
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messageInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isClearChatAlertOpen, setIsClearChatAlertOpen] = React.useState(false);
  const [isBlockUserAlertOpen, setIsBlockUserAlertOpen] = React.useState(false);
  const [isViewContactDialogOpen, setIsViewContactDialogOpen] = React.useState(false);
  const [clearChatLoading, setClearChatLoading] = React.useState(false);
  const [blockUserLoading, setBlockUserLoading] = React.useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = React.useState(false);

  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState('');
  const [deletingMessageId, setDeletingMessageId] = React.useState<string | null>(null);
  const [messageActionLoading, setMessageActionLoading] = React.useState(false);
  const [otherParticipant, setOtherParticipant] = React.useState<Contact | undefined>(undefined);
  const [forceFocus, setForceFocus] = React.useState(false);


  const { toast } = useToast();

  React.useEffect(() => {
    if (messageInputRef.current && forceFocus) {
      messageInputRef.current.focus();
    }
  }, [forceFocus]);

  React.useEffect(() => {
    if (selectedChat) {
      setLoading(true);
      const unsubscribe = getMessagesForChat(selectedChat.id, setMessages, selectedChat.participants);
      setLoading(false);

      const participant = selectedChat.participants.find((p) => p.id !== currentUser.id);
      setOtherParticipant(participant);

      if (participant && selectedChat.type === 'direct') {
        const unsubStatus = onUserStatusChange(participant.id, (status) => {
          setOtherParticipant(prev => {
            if (!prev) return undefined;
            return {
              ...prev,
              online: status.state === 'online',
              lastSeen: new Date(status.last_changed)
            }
          });
        });
        return () => {
          unsubscribe();
          unsubStatus();
        }
      }

      return () => unsubscribe();
    }
  }, [selectedChat, currentUser.id]);
  
  React.useEffect(() => {
    scrollToBottom();
  }, [messages, editingMessageId]);

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
        await sendMessageInChat(selectedChat.id, currentUser.id, newMessage.trim(), 'text');
        setNewMessage('');
      } catch (error) {
        console.error("Error sending message: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to send message."});
      } finally {
        setLoading(false);
        setForceFocus(f => !f);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedChat) {
      const file = e.target.files[0];

      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast({ variant: "destructive", title: "Invalid File Type", description: "This file type is not supported." });
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ variant: "destructive", title: "File Too Large", description: `File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
        return;
      }
      
      const fileType = file.type.startsWith('image/') ? 'image'
                     : file.type.startsWith('video/') ? 'video'
                     : file.type.startsWith('audio/') ? 'audio'
                     : 'file';

      setLoading(true);
      toast({ title: "Uploading...", description: `Your ${fileType} is being sent.` });
      try {
        const fileUrl = await uploadFileForChat(selectedChat.id, file, fileType);
        await sendMessageInChat(selectedChat.id, currentUser.id, fileUrl, fileType, file.name);
        toast({ title: "File Sent", description: `Your ${fileType} has been sent successfully.` });
      } catch (error) {
        console.error("Error sending file: ", error);
        toast({ variant: "destructive", title: "Error", description: "Failed to send file." });
      } finally {
        setLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
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

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage(prev => prev + emojiData.emoji);
    setIsEmojiPickerOpen(false);
    messageInputRef.current?.focus();
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  }

  const handleSaveEdit = async () => {
    if (!selectedChat || !editingMessageId || !editingContent.trim()) return;
    setMessageActionLoading(true);
    try {
        await updateMessage(selectedChat.id, editingMessageId, editingContent.trim());
        toast({ title: "Message Updated" });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update message." });
    } finally {
        setMessageActionLoading(false);
        handleCancelEdit();
    }
  }

  const handleDeleteMessage = async () => {
    if (!selectedChat || !deletingMessageId) return;
    setMessageActionLoading(true);
    try {
        await deleteMessage(selectedChat.id, deletingMessageId);
        toast({ title: "Message Deleted" });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete message." });
    } finally {
        setMessageActionLoading(false);
        setDeletingMessageId(null);
    }
  }

  const renderMessageContent = (message: Message) => {
    switch (message.type) {
        case 'image':
            return (
                <a href={message.content} target="_blank" rel="noopener noreferrer">
                    <img src={message.content} alt={message.fileName || 'Sent image'} data-ai-hint="sent image" className="rounded-lg max-w-[200px] h-auto cursor-pointer" />
                </a>
            );
        case 'video':
            return (
                <video controls src={message.content} className="rounded-lg max-w-[300px] h-auto">
                    Your browser does not support the video tag.
                </video>
            );
        case 'audio':
            return (
                 <audio controls src={message.content} className="w-full max-w-xs">
                    Your browser does not support the audio element.
                </audio>
            );
        case 'file':
            return (
                <a href={message.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-background/50 p-3 rounded-lg hover:bg-background/80">
                    <FileIcon className="h-8 w-8 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">{message.fileName}</p>
                        <p className="text-xs text-muted-foreground">Click to download</p>
                    </div>
                </a>
            );
        case 'text':
        default:
            return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    }
  }
  
  if (!selectedChat || !currentUser) {
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

  const getStatus = (contact: Contact | undefined): string => {
    if (!contact) return '';
    if (contact.online) return 'Online';
    if (contact.lastSeen) {
        try {
            return `Last seen ${formatDistanceToNow(new Date(contact.lastSeen), { addSuffix: true })}`;
        } catch (e) {
            return 'Offline';
        }
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
              avatar: chatDetails.avatar || '',
              online: otherParticipant?.online
            }}
          />
          <div>
            <h2 className="font-semibold">{chatDetails.name}</h2>
            <p className="text-sm text-muted-foreground">{chatDetails.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/call-test?type=video')}><Video className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => router.push('/call-test?type=audio')}><Phone className="h-5 w-5" /></Button>
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
              {selectedChat.type === 'direct' && (
                 <DropdownMenuItem onSelect={() => setIsBlockUserAlertOpen(true)} className={amIBlocked ? "hidden" : ""}>
                    {didIBlock ? <UserX className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                    {didIBlock ? 'Unblock' : 'Block'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto chat-background">
        <ScrollArea
          className="h-full"
          viewportRef={scrollViewportRef}
        >
          <div className="p-4 sm:p-6 space-y-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('group flex items-end gap-2 animate-in fade-in-25 slide-in-from-bottom-4 duration-300',
                  message.sender?.id === currentUser.id ? 'justify-end' : 'justify-start'
                )}
              >
                 {message.sender?.id === currentUser.id && (
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleEditMessage(message)} disabled={message.type !== 'text'}>
                                <PenSquare className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setDeletingMessageId(message.id)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 )}

                <div
                  className={cn('max-w-xs md:max-w-md lg:max-w-lg rounded-xl px-4 py-2.5',
                    message.sender?.id === currentUser.id
                      ? 'bg-primary/80 text-primary-foreground'
                      : 'bg-card',
                    message.type !== 'text' && 'p-2'
                  )}
                >
                  {selectedChat.type === 'group' && message.sender?.id !== currentUser.id && (
                    <p className="text-xs font-semibold text-primary pb-1">{message.sender.name}</p>
                  )}
                  
                  {editingMessageId === message.id ? (
                    <div className="space-y-2">
                      <Textarea 
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="bg-background/80 text-foreground"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={messageActionLoading}>
                          {messageActionLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {renderMessageContent(message)}
                      <div className="flex items-end justify-end gap-2 mt-1">
                        {message.edited && (
                            <p className="text-xs text-muted-foreground/80">edited</p>
                        )}
                        <p className="text-xs text-muted-foreground/80">
                            {message.timestamp}
                        </p>
                      </div>
                    </>
                  )}
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
             {didIBlock ? `You blocked ${otherParticipant?.name}.` : `You can't reply to this conversation.`}
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" type="button" disabled={loading}><Smile /></Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
                    <EmojiPicker onEmojiClick={onEmojiClick} />
                </PopoverContent>
            </Popover>

            <Input type="file" ref={fileInputRef} onChange={handleFileUpload} accept={ALLOWED_FILE_TYPES.join(',')} className="hidden" disabled={loading} />
            <Button variant="ghost" size="icon" type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                <Paperclip />
            </Button>

            <Input
              ref={messageInputRef}
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

       <AlertDialog open={!!deletingMessageId} onOpenChange={(open) => !open && setDeletingMessageId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently delete this message. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={messageActionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={messageActionLoading}>
              {messageActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

    

    