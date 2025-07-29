
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, User, Lock, UserPlus, Users, Upload, Loader2, Contact, MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contact as ContactType } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import { NewGroupDialog } from './new-group-dialog';
import { updateUserProfile, uploadAvatar, findUserByEmail, createChatWithUser, hashValue, compareValue } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';


type SettingsDialogProps = {
  currentUser: ContactType;
};

export function SettingsDialog({ currentUser }: SettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');
  
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar);
  const [quickChatEmail, setQuickChatEmail] = useState('');
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  const [isFeatureUnavailableDialogOpen, setIsFeatureUnavailableDialogOpen] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Reset state when dialog is closed or user changes
    if (!isOpen) {
      setName(currentUser?.name || '');
      setAvatarPreview(currentUser?.avatar);
      setAvatarFile(null);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    }
  }, [isOpen, currentUser]);


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };
  
  const handleProfileUpdate = async () => {
    if (!currentUser) return;
    setProfileLoading(true);
    let newAvatarUrl = currentUser.avatar;
    if (avatarFile) {
        try {
            newAvatarUrl = await uploadAvatar(currentUser.id, avatarFile);
        } catch (error) {
            toast({ variant: 'destructive', title: "Upload Failed", description: "Could not upload new profile picture." });
            setProfileLoading(false);
            return;
        }
    }

    try {
      await updateUserProfile(currentUser.id, { name, avatar: newAvatarUrl });
      toast({ title: "Profile Updated", description: "Your profile has been successfully updated." });
    } catch (error) {
      toast({ variant: 'destructive', title: "Error", description: "Failed to update profile." });
    } finally {
        setProfileLoading(false);
    }
  };
  
  const handlePinChange = async () => {
    if (!currentUser) return;
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'New PIN must be exactly 4 digits.' });
        return;
    }
    if (newPin !== confirmPin) {
      toast({ variant: 'destructive', title: 'PINs do not match', description: 'Please ensure the new PINs are the same.' });
      return;
    }
    
    setPinLoading(true);

    // If user already has a PIN, verify the old one first.
    if (currentUser.pin) {
        const isOldPinValid = await compareValue(oldPin, currentUser.pin);
        if (!isOldPinValid) {
            toast({ variant: 'destructive', title: 'Incorrect Old PIN', description: 'The old PIN you entered is incorrect.' });
            setPinLoading(false);
            return;
        }
    }

    try {
      const hashedPin = await hashValue(newPin);
      await updateUserProfile(currentUser.id, { pin: hashedPin });
      toast({ title: "PIN Changed", description: "Your App Lock PIN has been updated successfully." });
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      // Manually refetch user data or update local state if needed. A page reload might be simplest.
      window.location.reload();
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Failed to change PIN." });
    } finally {
        setPinLoading(false);
    }
  };

  const handleQuickChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!quickChatEmail.trim()) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please enter an email address.' });
        return;
    }
    setQuickChatLoading(true);
    try {
        const foundUser = await findUserByEmail(quickChatEmail);
        if (!foundUser) {
            toast({ variant: 'destructive', title: 'User Not Found', description: 'No user found with that email address.' });
            return;
        }
        if (foundUser.id === currentUser.id) {
            toast({ variant: 'destructive', title: 'Error', description: 'You cannot start a chat with yourself.' });
            return;
        }
        await createChatWithUser(currentUser.id, foundUser.id);
        toast({ title: 'Chat Started', description: `A new chat with ${foundUser.name} has been started.` });
        setQuickChatEmail('');
        setIsOpen(false);
        router.push('/'); // Navigate to chat list
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to start chat.' });
    } finally {
        setQuickChatLoading(false);
    }
  };

  const navigateToContacts = () => {
    router.push('/contacts');
    setIsOpen(false);
  }

  const ComingSoonDialog = (
    <AlertDialogContent>
        <AlertDialogHeader>
            <DialogTitle>Feature Not Available</DialogTitle>
            <AlertDialogDescription>
                This feature is currently under development and will be available soon. We appreciate your patience and encourage you to explore other available features in the meantime. Thank you for your understanding!
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
            <AlertDialogAction onClick={() => setIsFeatureUnavailableDialogOpen(false)}>OK</AlertDialogAction>
        </AlertDialogFooter>
    </AlertDialogContent>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
         <AlertDialog open={isFeatureUnavailableDialogOpen} onOpenChange={setIsFeatureUnavailableDialogOpen}>
            {ComingSoonDialog}
         </AlertDialog>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your profile, security, and contacts.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile"><User className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="security"><Lock className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="contacts"><Contact className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="group"><Users className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="quick-chat"><MessageSquarePlus className="h-4 w-4" /></TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="py-4 space-y-4">
            <div className="flex flex-col items-center space-y-2">
                <div className="relative">
                    <UserAvatar user={{ ...currentUser, avatar: avatarPreview }} className="h-24 w-24" />
                      <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-secondary p-1.5 rounded-full cursor-pointer hover:bg-muted" onClick={() => setIsFeatureUnavailableDialogOpen(true)}>
                          <Upload className="h-4 w-4" />
                      </Label>
                    <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={profileLoading}/>
            </div>
            <Button onClick={handleProfileUpdate} className="w-full" disabled={profileLoading}>
                {profileLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {profileLoading ? "Saving..." : "Save Changes"}
            </Button>
          </TabsContent>
          
          <TabsContent value="security" className="py-4 space-y-4">
             <h3 className="font-semibold">{currentUser?.pin ? 'Update App Lock PIN' : 'Set App Lock PIN'}</h3>
             
             {currentUser?.pin && (
                <div className="space-y-2">
                    <Label htmlFor="old-pin">Old PIN</Label>
                    <Input id="old-pin" type="password" value={oldPin} onChange={(e) => setOldPin(e.target.value)} maxLength={4} disabled={pinLoading} />
                </div>
             )}

             <div className="space-y-2">
              <Label htmlFor="pin">New 4-Digit PIN</Label>
              <Input id="pin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} maxLength={4} disabled={pinLoading} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirm New PIN</Label>
              <Input id="confirm-pin" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} maxLength={4} disabled={pinLoading} />
            </div>
            <Button onClick={handlePinChange} className="w-full" disabled={pinLoading}>
                {pinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pinLoading ? "Saving..." : (currentUser?.pin ? 'Update PIN' : 'Set New PIN')}
            </Button>
          </TabsContent>
          
          <TabsContent value="contacts" className="py-4 space-y-4">
            <h3 className="font-semibold">Manage Contacts</h3>
            <p className="text-sm text-muted-foreground pb-2">Add, remove, or view your contacts on the contacts page.</p>
            <Button onClick={navigateToContacts} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Go to Contacts
            </Button>
          </TabsContent>
          
          <TabsContent value="group" className="py-4">
            <h3 className="font-semibold">Create a Group</h3>
            <p className="text-sm text-muted-foreground pb-4">Start a new group chat with your contacts.</p>
            <NewGroupDialog currentUser={currentUser} isTriggerInDialog={true}/>
          </TabsContent>

          <TabsContent value="quick-chat" className="py-4">
             <h3 className="font-semibold">Quick Chat</h3>
             <p className="text-sm text-muted-foreground pb-4">Enter a user's email to start a chat without adding them as a contact.</p>
             <form onSubmit={handleQuickChat} className="space-y-2">
                <Label htmlFor="quick-chat-email">User Email</Label>
                <Input
                    id="quick-chat-email"
                    type="email"
                    value={quickChatEmail}
                    onChange={(e) => setQuickChatEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={quickChatLoading}
                    required
                />
                <Button type="submit" className="w-full" disabled={quickChatLoading}>
                    {quickChatLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {quickChatLoading ? 'Starting...' : 'Start Chat'}
                </Button>
             </form>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

    