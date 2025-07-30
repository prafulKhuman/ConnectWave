
'use client';

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
import { Button } from '@/components/ui/button';
import { UserAvatar } from './user-avatar';
import type { Contact } from '@/lib/data';
import { Phone, PhoneOff, Video } from 'lucide-react';

type IncomingCallDialogProps = {
  call: any | null;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallDialog({ call, onAccept, onDecline }: IncomingCallDialogProps) {
  if (!call) return null;

  return (
    <AlertDialog open={!!call}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
            <UserAvatar user={call.caller} className="h-24 w-24 mb-4" />
            <AlertDialogTitle className="text-2xl">Incoming {call.type} call</AlertDialogTitle>
            <AlertDialogDescription>
                {call.caller.name} is calling you.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-around">
            <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={onDecline}>
                <PhoneOff className="h-7 w-7" />
            </Button>
            <Button variant="default" size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600" onClick={onAccept}>
                {call.type === 'video' ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
