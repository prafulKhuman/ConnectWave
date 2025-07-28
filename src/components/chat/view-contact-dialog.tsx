
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserAvatar } from './user-avatar';
import type { Contact } from '@/lib/data';
import { Mail, Phone, User } from 'lucide-react';

type ViewContactDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  contact: Contact | undefined;
};

export function ViewContactDialog({ isOpen, setIsOpen, contact }: ViewContactDialogProps) {
  if (!contact) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <UserAvatar user={contact} className="h-24 w-24 mb-4" />
          <DialogTitle className="text-2xl">{contact.name}</DialogTitle>
          <DialogDescription>
            {contact.online ? 'Online' : `Last seen ${contact.lastSeen || 'recently'}`}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{contact.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
            <Phone className="h-5 w-5 text-muted-foreground" />
             <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{contact.phone || 'Not available'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
            <User className="h-5 w-5 text-muted-foreground" />
             <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">{contact.name}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
