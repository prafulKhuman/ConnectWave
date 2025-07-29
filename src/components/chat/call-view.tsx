
'use client';

import { useState, useEffect } from 'react';
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from './user-avatar';
import { cn } from '@/lib/utils';
import Image from 'next/image';

type CallViewProps = {
  callType: 'audio' | 'video';
  caller: {
    name: string;
    avatar: string;
  };
  onEndCall: () => void;
};

export function CallView({ callType, caller, onEndCall }: CallViewProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected'>('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callStatus === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleAcceptCall = () => {
    setCallStatus('connected');
  };

  const handleDeclineCall = () => {
    onEndCall();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        <div className={cn(
            "relative h-full w-full bg-cover bg-center transition-all duration-300",
            (callType === 'video' && callStatus === 'connected' && !isVideoOff) ? '' : 'p-6'
        )}>
            {/* Background Image/Video */}
            {callType === 'video' && callStatus === 'connected' && !isVideoOff ? (
                <>
                    <Image 
                        src="https://placehold.co/400x600.png"
                        alt="Remote video feed"
                        data-ai-hint="video call remote person"
                        layout="fill"
                        objectFit="cover"
                        className="transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-black/30" />
                    <Image
                        src="https://placehold.co/100x150.png"
                        alt="Local video feed"
                        data-ai-hint="video call local person"
                        width={100}
                        height={150}
                        className="absolute bottom-4 right-4 rounded-lg border-2 border-white/50 shadow-lg"
                    />
                     <Button variant="ghost" size="icon" onClick={onEndCall} className="absolute top-4 left-4 text-white hover:bg-white/20">
                        <ArrowLeft />
                    </Button>
                </>
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
            )}

            <CardContent className="relative z-10 flex flex-col items-center justify-between h-full text-center text-foreground pt-6">
                <div className="flex flex-col items-center space-y-4">
                    <UserAvatar user={caller} className="h-32 w-32 border-4 border-background shadow-lg" />
                    <h2 className="text-3xl font-bold">{caller.name}</h2>
                    <p className="text-lg text-muted-foreground">
                        {callStatus === 'ringing'
                        ? callType === 'video' ? 'Incoming video call...' : 'Incoming audio call...'
                        : formatDuration(callDuration)}
                    </p>
                </div>

                <div className="w-full mt-16 space-y-6">
                    {callStatus === 'ringing' ? (
                        <div className="flex justify-around">
                            <div className="flex flex-col items-center space-y-2">
                                <Button size="lg" className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600" onClick={handleDeclineCall}>
                                    <PhoneOff className="h-7 w-7" />
                                </Button>
                                <span className="text-sm">Decline</span>
                            </div>
                            <div className="flex flex-col items-center space-y-2">
                                <Button size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600" onClick={handleAcceptCall}>
                                    <Phone className="h-7 w-7" />
                                </Button>
                                <span className="text-sm">Accept</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center space-y-8">
                            <div className="flex justify-center gap-6">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className={cn("rounded-full w-16 h-16 bg-background/30 backdrop-blur-sm", isMuted && "bg-primary text-primary-foreground")}
                                    onClick={() => setIsMuted(!isMuted)}
                                >
                                    {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                                </Button>

                                {callType === 'video' && (
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className={cn("rounded-full w-16 h-16 bg-background/30 backdrop-blur-sm", isVideoOff && "bg-primary text-primary-foreground")}
                                        onClick={() => setIsVideoOff(!isVideoOff)}
                                    >
                                        {isVideoOff ? <VideoOff className="h-7 w-7" /> : <Video className="h-7 w-7" />}
                                    </Button>
                                )}

                                <Button
                                    size="lg"
                                    className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600"
                                    onClick={onEndCall}
                                >
                                    <PhoneOff className="h-7 w-7" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </div>
      </Card>
    </div>
  );
}

    