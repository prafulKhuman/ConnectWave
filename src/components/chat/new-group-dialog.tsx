
'use client';

import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getContacts, createNewGroupInFirestore } from '@/lib/firebase';
import { UserAvatar } from './user-avatar';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@/lib/data';

type NewGroupDialogProps = {
  currentUser: Contact | null;
  isTriggerInDialog?: boolean;
};

export function NewGroupDialog({ currentUser, isTriggerInDialog = false }: NewGroupDialogProps) {
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && currentUser) {
      // Use getContacts to only show users who have been added to the contact list
      const unsubscribe = getContacts(currentUser.id, setAvailableContacts);
      return () => unsubscribe();
    }
  }, [isOpen, currentUser]);

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleCreateGroup = async () => {
    if (groupName.trim() && selectedContacts.length > 0 && currentUser) {
      setLoading(true);
      try {
        const participantIds = [...selectedContacts, currentUser.id];
        await createNewGroupInFirestore(groupName, participantIds, `https://placehold.co/100x100.png`);
        toast({
          title: 'Group Created',
          description: `Group "${groupName}" created with ${selectedContacts.length + 1} members.`,
        });
        setIsOpen(false);
        setGroupName('');
        setSelectedContacts([]);
      } catch (error) {
        console.error("Error creating group: ", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to create group. Please try again.',
        });
      } finally {
        setLoading(false);
      }
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a group name and select at least one member.',
      });
    }
  };

  const TriggerButton = isTriggerInDialog ? (
    <Button className="w-full">
      <MessageSquarePlus className="mr-2 h-4 w-4" /> Create New Group
    </Button>
  ) : (
    <Button variant="ghost" size="icon">
      <MessageSquarePlus className="h-5 w-5" />
      <span className="sr-only">New Group</span>
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {TriggerButton}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Select members from your contact list and give your group a name.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="group-name" className="text-right">
              Group Name
            </Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Project Team"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
              {availableContacts.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground p-4">You have no contacts to add. Please add contacts from the 'Contacts' settings tab first.</p>
              ) : (
                <div className="space-y-2">
                  {availableContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center space-x-3 rounded-md p-2 hover:bg-muted"
                    >
                      <Checkbox
                        id={`contact-${contact.id}`}
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => handleSelectContact(contact.id)}
                        disabled={loading}
                      />
                      <label
                        htmlFor={`contact-${contact.id}`}
                        className="flex flex-1 cursor-pointer items-center space-x-3"
                      >
                        <UserAvatar user={contact} className="h-8 w-8" />
                        <span className="font-medium">{contact.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleCreateGroup} disabled={loading || availableContacts.length === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Creating...' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
