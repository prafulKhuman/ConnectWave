
'use client';

import { Suspense, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CallView } from '@/components/chat/call-view';
import { Skeleton } from '@/components/ui/skeleton';

function CallTestClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const callType = searchParams.get('type') as 'audio' | 'video' | null;

  const handleEndCall = () => {
    router.push('/call-test');
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

function LoadingFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <Skeleton className="h-24 w-24 rounded-full" />
      <div className="space-y-2">
          <Skeleton className="h-6 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
      </div>
       <div className="flex gap-4 mt-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
        </div>
    </div>
  );
}


export default function CallTestPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CallTestClient />
    </Suspense>
  )
}
