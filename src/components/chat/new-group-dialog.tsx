'use client';

import { useState } from 'react';
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
import { contacts, currentUser } from '@/lib/data';
import { UserAvatar } from './user-avatar';
import { MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function NewGroupDialog() {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const availableContacts = contacts.filter((c) => c.id !== currentUser.id);

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleCreateGroup = () => {
    if (groupName.trim() && selectedContacts.length > 0) {
      toast({
        title: 'Group Created',
        description: `Group "${groupName}" created with ${selectedContacts.length} members.`,
      });
      setIsOpen(false);
      setGroupName('');
      setSelectedContacts([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter a group name and select at least one member.',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <MessageSquarePlus className="h-5 w-5" />
          <span className="sr-only">New Group</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Group</DialogTitle>
          <DialogDescription>
            Select members and give your group a name.
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
            />
          </div>
          <div className="space-y-2">
            <Label>Members</Label>
            <ScrollArea className="h-[200px] w-full rounded-md border p-2">
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
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleCreateGroup}>
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
