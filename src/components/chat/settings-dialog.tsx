
'use client';

import { useState } from 'react';
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
import { Settings, User, Lock, UserPlus, Users, Upload, Loader2, Contact } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contact as ContactType } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import { NewGroupDialog } from './new-group-dialog';
import { updateUserProfile, uploadAvatar } from '@/lib/firebase';

type SettingsDialogProps = {
  currentUser: ContactType;
};

export function SettingsDialog({ currentUser }: SettingsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar);
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };
  
  const handleProfileUpdate = async () => {
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
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        toast({ variant: 'destructive', title: 'Invalid PIN', description: 'PIN must be exactly 4 digits.' });
        return;
    }
    if (pin !== confirmPin) {
      toast({ variant: 'destructive', title: 'PINs do not match', description: 'Please ensure both PINs are the same.' });
      return;
    }
    setPinLoading(true);
    try {
      await updateUserProfile(currentUser.id, { pin });
      toast({ title: "PIN Changed", description: "Your App Lock PIN has been updated." });
      setPin('');
      setConfirmPin('');
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Failed to change PIN." });
    } finally {
        setPinLoading(false);
    }
  };

  const navigateToContacts = () => {
    router.push('/contacts');
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your profile, security, and contacts.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile"><User className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="security"><Lock className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="contacts"><Contact className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="group"><Users className="h-4 w-4" /></TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="py-4 space-y-4">
            <div className="flex flex-col items-center space-y-2">
                <div className="relative">
                    <UserAvatar user={{ ...currentUser, avatar: avatarPreview }} className="h-24 w-24" />
                    <Label htmlFor="avatar-upload" className="absolute bottom-0 right-0 bg-secondary p-1.5 rounded-full cursor-pointer hover:bg-muted">
                        <Upload className="h-4 w-4" />
                    </Label>
                    <Input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={profileLoading} />
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
             <h3 className="font-semibold">Change App Lock PIN</h3>
             <div className="space-y-2">
              <Label htmlFor="pin">New 4-Digit PIN</Label>
              <Input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={4} disabled={pinLoading} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-pin">Confirm New PIN</Label>
              <Input id="confirm-pin" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} maxLength={4} disabled={pinLoading} />
            </div>
            <Button onClick={handlePinChange} className="w-full" disabled={pinLoading}>
                {pinLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pinLoading ? "Setting..." : "Set New PIN"}
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

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
