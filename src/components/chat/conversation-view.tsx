
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Phone, Video, MoreVertical, Paperclip, Send, Smile, WifiOff, MessageSquareHeart, Loader2, Trash2, Ban, Eye, UserX, PenSquare, MoreHorizontal, File as FileIcon, Music, VideoIcon, Check, CheckCheck, X, Camera, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Chat, Message, Contact } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getMessagesForChat, sendMessageInChat, clearChatHistory, updateBlockStatus, uploadFileForChat, deleteMessage, updateMessage, updateMessagesStatus, setUserTypingStatus, onTypingStatusChange, deleteMessageForMe } from '@/lib/firebase';
import { ViewContactDialog } from './view-contact-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import type { EmojiClickData } from 'emoji-picker-react';
import { Textarea } from '@/components/ui/textarea';
import { CameraView } from './camera-view';
import { useIsMobile } from '@/hooks/use-mobile';

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
  isTabVisible: boolean;
  onBack: () => void;
};

const MessageStatus = ({ status }: { status?: Message['status'] }) => {
    if (status === 'sent') {
        return <Check className="h-4 w-4" />;
    }
    if (status === 'delivered') {
        return <CheckCheck className="h-4 w-4" />;
    }
    if (status === 'read') {
        return <CheckCheck className="h-4 w-4 text-blue-500" />;
    }
    return null;
};

export function ConversationView({ selectedChat, currentUser, isTabVisible, onBack }: ConversationViewProps) {
  const scrollViewportRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messageInputRef = React.useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [isViewContactOpen, setIsViewContactOpen] = React.useState(false);
  const [isCameraOpen, setIsCameraOpen] = React.useState(false);
  const [dialogState, setDialogState] = React.useState<{ clearChat?: boolean; blockChat?: boolean, deleteMessage?: Message, deleteType?: 'me' | 'everyone' }>({});
  const [actionLoading, setActionLoading] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  
  const [editingMessage, setEditingMessage] = React.useState<Message | null>(null);
  const [editContent, setEditContent] = React.useState('');

  const [otherParticipant, setOtherParticipant] = React.useState<Contact | undefined>(undefined);
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);
  const typingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const isMobile = useIsMobile();


  React.useEffect(() => {
    if (selectedChat) {
      const otherUser = selectedChat.participants.find(p => p.id !== currentUser.id);
      setOtherParticipant(otherUser);
      
      const unsubscribe = getMessagesForChat(selectedChat.id, (newMessages) => {
        const visibleMessages = newMessages.filter(m => !m.deletedFor?.includes(currentUser.id));
        setMessages(visibleMessages);
      });
      
      return () => unsubscribe();
    }
  }, [selectedChat, currentUser.id]);


  React.useEffect(() => {
    if (scrollViewportRef.current) {
      setTimeout(() => {
        if (scrollViewportRef.current) {
            scrollViewportRef.current.scrollTo({ top: scrollViewportRef.current.scrollHeight, behavior: 'auto' });
        }
      }, 100);
    }
  }, [messages, selectedChat]);

  React.useEffect(() => {
     if (!selectedChat || !isTabVisible || !messages.length) return;
        const incomingMessagesToUpdate = messages
            .filter(m => m.sender?.id !== currentUser.id && m.status !== 'read')
            .map(m => m.id);

        if (incomingMessagesToUpdate.length > 0) {
            updateMessagesStatus(selectedChat.id, incomingMessagesToUpdate, 'read');
        }
  }, [messages, selectedChat, currentUser.id, isTabVisible]);

  React.useEffect(() => {
    if (!selectedChat) return;
    
    const unsub = onTypingStatusChange(selectedChat.id, (typingStatus) => {
        const currentlyTyping = Object.entries(typingStatus)
            .filter(([userId, data]) => userId !== currentUser.id && data.isTyping)
            .map(([userId, data]) => data.name);
        setTypingUsers(currentlyTyping);
    });

    return () => unsub();
  }, [selectedChat, currentUser.id]);


  const getChatDetails = () => {
    if (!selectedChat) return { name: '', avatar: '', online: false, lastSeen: undefined, status: '' };
    if (selectedChat.type === 'group') {
      const onlineCount = selectedChat.participants.filter(p => p.online).length;
      let status = `${onlineCount} of ${selectedChat.participants.length} online`;
      if(typingUsers.length > 0) {
        status = `${typingUsers.join(', ')} typing...`
      }
      return { 
        name: selectedChat.name, 
        avatar: selectedChat.avatar, 
        online: false, 
        lastSeen: undefined, 
        status 
      };
    }
    const otherUser = selectedChat.participants.find((p) => p.id !== currentUser.id);
    let status = otherUser?.online ? 'Online' : (otherUser?.lastSeen ? `Last seen ${formatDistanceToNow(new Date(otherUser.lastSeen), { addSuffix: true })}` : 'Offline');
    if (typingUsers.length > 0) {
        status = 'typing...';
    }
    return { 
      name: otherUser?.name, 
      avatar: otherUser?.avatar, 
      online: otherUser?.online, 
      lastSeen: otherUser?.lastSeen, 
      status 
    };
  };

  const details = getChatDetails();

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !editingMessage) || !selectedChat) return;

    if (editingMessage) {
        setIsSending(true);
        try {
            await updateMessage(selectedChat.id, editingMessage.id, editContent);
            toast({title: "Message Edited"});
            setEditingMessage(null);
            setEditContent('');
        } catch(e) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to edit message." });
        } finally {
            setIsSending(false);
            messageInputRef.current?.focus();
        }
    } else {
        setIsSending(true);
        try {
            await sendMessageInChat(selectedChat.id, currentUser.id, newMessage, 'text');
            setNewMessage('');
            messageInputRef.current?.focus();
        } catch (error) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to send message." });
        } finally {
            setIsSending(false);
            if (selectedChat) {
                setUserTypingStatus(selectedChat.id, currentUser.id, currentUser.name, false);
            }
        }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (editingMessage) {
      setEditContent(value);
    } else {
      setNewMessage(value);
    }

    if (selectedChat) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      setUserTypingStatus(selectedChat.id, currentUser.id, currentUser.name, true);

      typingTimeoutRef.current = setTimeout(() => {
        setUserTypingStatus(selectedChat.id, currentUser.id, currentUser.name, false);
      }, 2000); // 2 seconds
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (editingMessage) {
      setEditContent(prev => prev + emojiData.emoji);
    } else {
      setNewMessage(prev => prev + emojiData.emoji);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0] && selectedChat) {
        const file = event.target.files[0];
        handleSendFile(file);
    }
  };

  const handleSendFile = async (file: File) => {
      if (!selectedChat) return;

      if (file.size > MAX_FILE_SIZE) {
          toast({ variant: 'destructive', title: 'File Too Large', description: `File size cannot exceed ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
          return;
      }
      
      let fileType: Message['type'] = 'file';
      if (file.type.startsWith('image/')) fileType = 'image';
      else if (file.type.startsWith('video/')) fileType = 'video';
      else if (file.type.startsWith('audio/')) fileType = 'audio';

      if (fileType === 'file' && !ALLOWED_FILE_TYPES.includes(file.type)) {
          toast({ variant: 'destructive', title: 'Invalid File Type', description: 'This file type is not supported.' });
          return;
      }
      
      setIsUploading(true);
      try {
          const downloadURL = await uploadFileForChat(selectedChat.id, file, fileType);
          await sendMessageInChat(selectedChat.id, currentUser.id, downloadURL, fileType, file.name);

      } catch (error) {
          toast({ variant: 'destructive', title: 'Upload Failed', description: 'Failed to upload and send file.' });
      } finally {
          setIsUploading(false);
      }
  }
  
  const handleClearChat = async () => {
    if (!selectedChat) return;
    setActionLoading(true);
    try {
      await clearChatHistory(selectedChat.id);
      toast({ title: 'Chat Cleared', description: 'The message history for this chat has been cleared.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear chat.' });
    } finally {
      setActionLoading(false);
      setDialogState({});
    }
  };

  const handleBlockChat = async () => {
    if (!selectedChat) return;
    setActionLoading(true);
    const newBlockStatus = !selectedChat.blocked?.isBlocked;
    try {
      await updateBlockStatus(selectedChat.id, newBlockStatus, currentUser.id);
      toast({ title: newBlockStatus ? 'Chat Blocked' : 'Chat Unblocked' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update block status.' });
    } finally {
      setActionLoading(false);
      setDialogState({});
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedChat || !dialogState.deleteMessage) return;
    setActionLoading(true);

    try {
        if (dialogState.deleteType === 'everyone') {
            await deleteMessage(selectedChat.id, dialogState.deleteMessage.id);
            toast({title: "Message deleted for everyone"});
        } else {
            await deleteMessageForMe(selectedChat.id, dialogState.deleteMessage.id, currentUser.id);
            toast({title: "Message deleted for you"});
        }
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Failed to delete message." });
    } finally {
        setActionLoading(false);
        setDialogState({});
    }
  }

  const handleEditMessage = (message: Message) => {
    setEditingMessage(message);
    setEditContent(message.content);
    if (messageInputRef.current) {
        messageInputRef.current.focus();
    }
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditContent('');
  };


  const isChatBlocked = selectedChat?.blocked?.isBlocked;
  const amIBlocked = isChatBlocked && selectedChat?.blocked?.by !== currentUser.id;
  const didIBlock = isChatBlocked && selectedChat?.blocked?.by === currentUser.id;


  if (!selectedChat) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background/50 text-center p-4">
        <MessageSquareHeart className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="mt-4 text-2xl font-semibold">Welcome to ConnectWave</h2>
        <p className="mt-2 text-muted-foreground">Select a chat to start messaging, or start a new one!</p>
      </div>
    );
  }

  const renderMessageContent = (message: Message) => {
    switch (message.type) {
        case 'image':
            return <img src={message.content} alt={message.fileName || 'image'} className="max-w-full sm:max-w-xs rounded-lg cursor-pointer" onClick={() => window.open(message.content, '_blank')} />;
        case 'video':
            return (
                <div className="relative group">
                    <video src={message.content} controls className="max-w-full sm:max-w-xs rounded-lg" />
                    <a href={message.content} download={message.fileName} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="secondary"><MoreHorizontal/></Button>
                    </a>
                </div>
            )
        case 'audio':
            return <audio controls src={message.content} className="w-full max-w-xs" />;
        case 'file':
            return (
                <a href={message.content} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-muted p-2 rounded-lg hover:bg-muted/80 max-w-full">
                   <FileIcon className="h-6 w-6 flex-shrink-0" />
                   <span className="truncate">{message.fileName || 'View File'}</span>
                </a>
            )
        default:
            return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }
  }

  return (
    <div className="flex h-full flex-col chat-background">
      <header className="flex flex-shrink-0 items-center justify-between border-b bg-card p-2 sm:p-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <UserAvatar user={{ name: details.name, avatar: details.avatar, online: details.online }} />
          <div className="flex-1 overflow-hidden">
            <h2 className="font-semibold truncate">{details.name}</h2>
            <p className="text-sm text-muted-foreground truncate">{details.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => router.push(`/call-test?type=audio`)}>
            <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Audio Call</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => router.push(`/call-test?type=video`)}>
            <Video className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="sr-only">Video Call</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9">
                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="sr-only">More options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsViewContactOpen(true)}>
                <Eye className="mr-2 h-4 w-4" />
                View Contact
              </DropdownMenuItem>
              <AlertDialog open={dialogState.clearChat} onOpenChange={(open) => setDialogState(prev => ({...prev, clearChat: open ? true : undefined}))}>
                <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Trash2 className="mr-2 h-4 w-4" /> Clear Chat
                    </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Clear this chat?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogDescription>This will permanently clear all messages in this conversation. This action cannot be undone.</AlertDialogDescription>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearChat} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                            {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Clear Chat
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {selectedChat.type === 'direct' && (
                <AlertDialog open={dialogState.blockChat} onOpenChange={(open) => setDialogState(prev => ({...prev, blockChat: open ? true : undefined}))}>
                    <AlertDialogTrigger asChild>
                         <DropdownMenuItem onSelect={(e) => e.preventDefault()} className={cn(didIBlock && "text-green-600")}>
                           {didIBlock ? <UserX className="mr-2 h-4 w-4" /> : <Ban className="mr-2 h-4 w-4" />}
                           {didIBlock ? 'Unblock' : 'Block'} User
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogDescription>
                            {didIBlock ? "Unblocking this user will allow them to send you messages and call you again." : "Blocking this user will prevent them from sending you messages or calling you. They won't be notified."}
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBlockChat} disabled={actionLoading} className={cn(didIBlock ? "bg-green-600 hover:bg-green-700" : "bg-destructive hover:bg-destructive/90", "text-white")}>
                                {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} {didIBlock ? 'Unblock' : 'Block'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {otherParticipant && <ViewContactDialog isOpen={isViewContactOpen} setIsOpen={setIsViewContactOpen} contact={otherParticipant} />}
        <CameraView isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onSend={handleSendFile} />
      </header>
       <div className="flex-1 flex flex-col overflow-hidden">
         <div className="flex-1 overflow-y-auto">
            <ScrollArea className="h-full" viewportRef={scrollViewportRef}>
                <div className="p-4 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex items-end gap-2 group',
                        message.sender?.id === currentUser.id ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'relative max-w-[85%] sm:max-w-md lg:max-w-lg rounded-lg px-3 py-2',
                          message.sender?.id === currentUser.id
                            ? 'bg-primary/80 text-primary-foreground'
                            : 'bg-card shadow-sm'
                        )}
                      >
                        {renderMessageContent(message)}
                        <div className="flex items-center justify-end gap-2 mt-1 text-xs text-muted-foreground/80">
                            {message.edited && <span>Edited</span>}
                            <time>{message.timestamp}</time>
                            {message.sender?.id === currentUser.id && <MessageStatus status={message.status} />}
                        </div>

                        {message.sender?.id === currentUser.id && (
                             <div className="absolute top-1/2 -translate-y-1/2 -left-12 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleEditMessage(message)}>
                                            <PenSquare className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <AlertDialog open={dialogState.deleteMessage?.id === message.id} onOpenChange={(open) => setDialogState(prev => ({...prev, deleteMessage: open ? message : undefined}))}>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Delete message?</AlertDialogTitle></AlertDialogHeader>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this message? This action cannot be undone.
                                                </AlertDialogDescription>
                                                <AlertDialogFooter className="sm:justify-between flex-col-reverse sm:flex-row gap-2">
                                                    <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                                                    <div className="flex flex-col-reverse sm:flex-row gap-2">
                                                        <AlertDialogAction onClick={() => setDialogState(prev => ({...prev, deleteType: 'me'}))} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                                            {actionLoading && dialogState.deleteType === 'me' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                                                             Delete for me
                                                        </AlertDialogAction>
                                                         <AlertDialogAction onClick={() => setDialogState(prev => ({...prev, deleteType: 'everyone'}))} disabled={actionLoading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                                            {actionLoading && dialogState.deleteType === 'everyone' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                                                            Delete for everyone
                                                        </AlertDialogAction>
                                                    </div>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                             </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </ScrollArea>
         </div>
       </div>

      <AlertDialog open={!!(dialogState.deleteMessage && dialogState.deleteType)} onOpenChange={(open) => !open && setDialogState({})}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This message will be deleted {dialogState.deleteType === 'everyone' ? 'for everyone' : 'for you'}. This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDialogState({})} disabled={actionLoading}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={actionLoading}>
                      {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Delete
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <footer className="flex-shrink-0 border-t bg-card p-2 sm:p-3">
        {isChatBlocked ? (
            <div className="flex items-center justify-center p-2 rounded-md bg-yellow-100 text-yellow-800 text-sm text-center">
                <Ban className="h-5 w-5 mr-2 flex-shrink-0" />
                {didIBlock ? 'You have blocked this user. Unblock them from the options menu to send messages.' : 'You cannot reply to this conversation because you are blocked.'}
            </div>
        ) : editingMessage ? (
             <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-muted rounded-md border border-primary/50">
                    <p className="text-sm font-semibold">Editing Message</p>
                    <p className="text-sm text-muted-foreground truncate">{editingMessage.content}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={cancelEdit}><X className="h-5 w-5"/></Button>
            </div>
        ) : (
             <div className="flex items-end gap-2">
                <div className="flex items-center gap-0.5">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9" disabled={isSending || isUploading}>
                                <Smile className="h-5 w-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto border-0 p-0 mb-2">
                            <EmojiPicker onEmojiClick={onEmojiClick} />
                        </PopoverContent>
                    </Popover>
                    
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsCameraOpen(true)} disabled={isSending || isUploading}>
                        <Camera className="h-5 w-5" />
                    </Button>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} />
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => fileInputRef.current?.click()} disabled={isSending || isUploading}>
                   {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </Button>
                <Textarea
                    ref={messageInputRef}
                    value={editingMessage ? editContent : newMessage}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 resize-none"
                    rows={1}
                    disabled={isSending || isUploading}
                />
                <Button onClick={handleSendMessage} className="h-9 w-9" size="icon" disabled={isSending || isUploading || (!newMessage.trim() && !editingMessage)}>
                    {isSending || isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
             </div>
        )}
      </footer>
    </div>
  );
}
