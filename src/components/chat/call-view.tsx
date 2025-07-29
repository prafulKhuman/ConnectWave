
'use client';

import { useState, useEffect, useRef } from 'react';
import { Phone, Mic, MicOff, Video, VideoOff, PhoneOff, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from './user-avatar';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@/lib/data';


type CallViewProps = {
  callType: 'audio' | 'video';
  caller: Partial<Contact>;
  onEndCall: () => void;
};

export function CallView({ callType, caller, onEndCall }: CallViewProps) {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected'>('ringing');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [callDuration, setCallDuration] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (callType === 'video') {
        const getCameraPermission = async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
            setHasCameraPermission(true);

            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
            if (remoteVideoRef.current) {
                // In a real app, this would be the remote stream
                remoteVideoRef.current.srcObject = stream;
            }
          } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Camera Access Denied',
              description: 'Please enable camera permissions in your browser settings to use this app.',
            });
          }
        };
        getCameraPermission();
    }
  }, [callType, toast]);
  

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

  const showVideo = callType === 'video' && callStatus === 'connected' && !isVideoOff;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="relative h-full w-full bg-cover bg-center transition-all duration-300">
          {/* Background Image/Video */}
          {showVideo ? (
              <>
                  <video ref={remoteVideoRef} autoPlay playsInline className="absolute top-0 left-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/30" />
                  <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-24 right-4 h-40 w-28 rounded-lg border-2 border-white/50 object-cover shadow-lg md:bottom-32 md:h-48 md:w-36" />
                  <Button variant="ghost" size="icon" onClick={onEndCall} className="absolute top-4 left-4 text-white hover:bg-white/20 md:hidden">
                      <ArrowLeft />
                  </Button>
              </>
          ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
          )}

          <div className="relative z-10 flex flex-col items-center justify-between text-center text-foreground p-6 min-h-full">
              
              <div className="flex-grow flex flex-col items-center justify-center space-y-4">
                {!showVideo && (
                    <>
                        <UserAvatar user={caller} className="h-32 w-32 border-4 border-background shadow-lg" />
                        <h2 className="text-3xl font-bold">{caller.name}</h2>
                        <p className="text-lg text-muted-foreground">
                            {callStatus === 'ringing'
                            ? callType === 'video' ? 'Incoming video call...' : 'Incoming audio call...'
                            : formatDuration(callDuration)}
                        </p>
                    </>
                )}
                
                {showVideo && !hasCameraPermission && (
                    <Alert variant="destructive" className="bg-destructive/80 text-destructive-foreground border-destructive/80">
                        <AlertTriangle className="h-4 w-4 !text-destructive-foreground" />
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                )}
              </div>


              <div className={cn("w-full max-w-sm pb-8")}>
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
                          <div className="flex justify-center gap-4 sm:gap-6">
                              <Button
                                  variant="outline"
                                  size="lg"
                                  className={cn("rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-background/30 backdrop-blur-sm", isMuted && "bg-primary text-primary-foreground", showVideo && 'text-white border-white/50 hover:bg-white/20 hover:text-white')}
                                  onClick={() => setIsMuted(!isMuted)}
                              >
                                  {isMuted ? <MicOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Mic className="h-6 w-6 sm:h-7 sm:w-7" />}
                              </Button>

                              {callType === 'video' && (
                                  <Button
                                      variant="outline"
                                      size="lg"
                                      className={cn("rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-background/30 backdrop-blur-sm", isVideoOff && "bg-primary text-primary-foreground", showVideo && 'text-white border-white/50 hover:bg-white/20 hover:text-white')}
                                      onClick={() => setIsVideoOff(!isVideoOff)}
                                  >
                                      {isVideoOff ? <VideoOff className="h-6 w-6 sm:h-7 sm:w-7" /> : <Video className="h-6 w-6 sm:h-7 sm:w-7" />}
                                  </Button>
                              )}

                              <Button
                                  size="lg"
                                  className="rounded-full w-14 h-14 sm:w-16 sm:h-16 bg-red-500 hover:bg-red-600"
                                  onClick={onEndCall}
                              >
                                  <PhoneOff className="h-6 w-6 sm:h-7 sm:w-7" />
                              </Button>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
}
