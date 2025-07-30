
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useWebRTC } from '@/hooks/use-webrtc';
import { getCurrentUser, onAuthUserChanged } from '@/lib/firebase';
import type { Contact } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/chat/user-avatar';


export default function CallPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const callId = params.callId as string;
    const isInitiator = searchParams.get('initiator') === 'true';
    const callType = searchParams.get('type') as 'audio' | 'video';
    const opponentId = searchParams.get('opponent');

    const [currentUser, setCurrentUser] = useState<Contact | null>(null);
    const [opponentUser, setOpponentUser] = useState<Partial<Contact> | null>(null);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const ringtoneRef = useRef<HTMLAudioElement>(null);

    const {
        peerConnection,
        localStream,
        remoteStream,
        hangUp,
        isMuted,
        toggleMute,
        isVideoOff,
        toggleVideo,
        connectionStatus
    } = useWebRTC(callId, isInitiator, callType, currentUser?.id, opponentId);


    useEffect(() => {
        const unsubscribe = onAuthUserChanged(async (user) => {
            if (user) {
                const userProfile = await getCurrentUser(user.uid);
                setCurrentUser(userProfile);
                if (opponentId) {
                    const opponentProfile = await getCurrentUser(opponentId);
                    setOpponentUser(opponentProfile);
                }
            } else {
                router.push('/login');
            }
        });
        return () => unsubscribe();
    }, [opponentId, router]);


    useEffect(() => {
        if (localStream && localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    useEffect(() => {
        if (remoteStream && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Ringtone logic
    useEffect(() => {
        const isRinging = isInitiator && (connectionStatus === 'connecting' || connectionStatus === 'new');
        
        if (ringtoneRef.current) {
            if (isRinging) {
                ringtoneRef.current.loop = true;
                ringtoneRef.current.play().catch(e => console.error("Ringtone play error:", e));
            } else {
                ringtoneRef.current.pause();
                ringtoneRef.current.currentTime = 0;
            }
        }
    }, [isInitiator, connectionStatus]);


    const handleHangUp = async () => {
        await hangUp();
        router.push('/');
    };

    const showVideo = callType === 'video' && !isVideoOff && connectionStatus === 'connected';

    if (!currentUser || !opponentUser) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        )
    }

    const getStatusText = () => {
        if (isInitiator && (connectionStatus === 'connecting' || connectionStatus === 'new')) {
            return 'Ringing...';
        }
        return `${connectionStatus}...`;
    }

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <audio ref={ringtoneRef} src="/ringtone.mp3" preload="auto" />
            <div className="relative h-full w-full bg-cover bg-center transition-all duration-300">
                {showVideo ? (
                    <>
                        <video ref={remoteVideoRef} autoPlay playsInline className="absolute top-0 left-0 h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/30" />
                        <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-24 right-4 h-40 w-28 rounded-lg border-2 border-white/50 object-cover shadow-lg md:bottom-32 md:h-48 md:w-36" />
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
                )}

                <div className="relative z-10 flex flex-col items-center justify-between text-center text-foreground p-6 min-h-full">
                    <div className="flex-grow flex flex-col items-center justify-center space-y-4">
                        {!showVideo && (
                             <>
                                <UserAvatar user={opponentUser} className="h-32 w-32 border-4 border-background shadow-lg" />
                                <h2 className="text-3xl font-bold">{opponentUser.name}</h2>
                                <p className="text-lg text-muted-foreground capitalize">
                                    {getStatusText()}
                                </p>
                            </>
                        )}
                    </div>

                    <div className="w-full max-w-sm pb-8">
                        <div className="flex flex-col items-center space-y-8">
                            <div className="flex justify-center gap-4 sm:gap-6">
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className={cn("rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-background/30 backdrop-blur-sm", isMuted && "bg-primary text-primary-foreground", showVideo && 'text-white border-white/50 hover:bg-white/20 hover:text-white')}
                                    onClick={toggleMute}
                                >
                                    {isMuted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
                                </Button>

                                {callType === 'video' && (
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        className={cn("rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-background/30 backdrop-blur-sm", isVideoOff && "bg-primary text-primary-foreground", showVideo && 'text-white border-white/50 hover:bg-white/20 hover:text-white')}
                                        onClick={toggleVideo}
                                    >
                                        {isVideoOff ? <VideoOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Video className="h-6 w-6 sm:h-7 sm:w-7" />}
                                    </Button>
                                )}

                                <Button
                                    size="lg"
                                    className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-red-500 hover:bg-red-600"
                                    onClick={handleHangUp}
                                >
                                    <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
