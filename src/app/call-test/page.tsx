
'use client';

import { useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CallView } from '@/components/chat/call-view';

export default function CallTestPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const callType = searchParams.get('type') as 'audio' | 'video' | null;

  const handleEndCall = () => {
    router.push('/');
  };

  const caller = useMemo(() => ({
    name: 'Jane Doe',
    avatar: 'https://placehold.co/100x100.png',
  }), []);

  if (!callType) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
        <h1 className="text-2xl font-bold">Call UI Test Page</h1>
        <p className="text-muted-foreground">Click a button to simulate an incoming call.</p>
        <div className="flex gap-4">
            <Button onClick={() => router.push('/call-test?type=audio')}>Simulate Audio Call</Button>
            <Button onClick={() => router.push('/call-test?type=video')}>Simulate Video Call</Button>
        </div>
      </div>
    );
  }

  return (
    <CallView
      callType={callType}
      caller={caller}
      onEndCall={handleEndCall}
    />
  );
}

    