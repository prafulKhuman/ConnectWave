
'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { UserAvatar } from './user-avatar';
import type { Contact } from '@/lib/data';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useEffect, useRef } from 'react';

type IncomingCallDialogProps = {
  call: any | null;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallDialog({ call, onAccept, onDecline }: IncomingCallDialogProps) {
  const ringtoneRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioEl = ringtoneRef.current;
    if (call && audioEl) {
        audioEl.loop = true;
        // The play() method returns a Promise which can be used to detect when playback began.
        // It may be rejected if playback fails, e.g., if the user hasn't interacted with the page yet.
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Ringtone play error:", error);
                // Autoplay was prevented. We can't do much here but it's good to know.
            });
        }
    }

    // Cleanup function: This is crucial. It runs when the component unmounts or `call` changes.
    return () => {
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
    };
  }, [call]);

  if (!call || !call.caller) return null;

  const handleDeclineWithSound = () => {
    const audioEl = ringtoneRef.current;
    if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
    }
    onDecline();
  }

  const handleAcceptWithSound = () => {
     const audioEl = ringtoneRef.current;
     if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
    }
    onAccept();
  }

  return (
    <AlertDialog open={!!call}>
      <AlertDialogContent onInteractOutside={(e) => e.preventDefault()}>
        <audio ref={ringtoneRef} src="/ringtone.mp3" preload="auto" />
        <AlertDialogHeader className="items-center text-center">
            <UserAvatar user={call.caller} className="h-24 w-24 mb-4" />
            <AlertDialogTitle className="text-2xl">Incoming {call.type} call</AlertDialogTitle>
            <AlertDialogDescription>
                {call.caller.name} is calling you.
            </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-around pt-4">
            <div className="flex flex-col items-center space-y-2">
                <Button variant="destructive" size="lg" className="rounded-full w-16 h-16" onClick={handleDeclineWithSound}>
                    <PhoneOff className="h-7 w-7" />
                </Button>
                <span className="text-sm">Decline</span>
            </div>
             <div className="flex flex-col items-center space-y-2">
                <Button variant="default" size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600" onClick={handleAcceptWithSound}>
                    {call.type === 'video' ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
                </Button>
                 <span className="text-sm">Accept</span>
            </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
