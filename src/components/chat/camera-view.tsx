
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Camera, Video, Send, X, RefreshCw, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type CameraViewProps = {
  isOpen: boolean;
  onClose: () => void;
  onSend: (file: File, type: 'image' | 'video') => void;
};

export function CameraView({ isOpen, onClose, onSend }: CameraViewProps) {
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      // Reset state when opening
      setCapturedMedia(null);
      setMediaFile(null);
      
      const getPermissions = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          setStream(mediaStream);
          setHasPermission(true);
        } catch (err) {
          console.error('Error accessing camera:', err);
          setHasPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser.',
          });
          onClose();
        }
      };
      getPermissions();
    } else {
      // Cleanup when closing
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCapturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            setCapturedMedia(URL.createObjectURL(blob));
            setMediaFile(new File([blob], 'capture.jpg', { type: 'image/jpeg' }));
          }
        }, 'image/jpeg');
      }
    }
  };

  const handleStartRecording = () => {
    if (stream) {
      setIsRecording(true);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setCapturedMedia(URL.createObjectURL(blob));
        setMediaFile(new File([blob], 'capture.webm', { type: 'video/webm' }));
      };
      mediaRecorderRef.current.start();
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleShutterClick = () => {
    if (mode === 'photo') {
      handleCapturePhoto();
    } else {
      if (isRecording) {
        handleStopRecording();
      } else {
        handleStartRecording();
      }
    }
  };

  const handleSend = async () => {
    if (mediaFile) {
        setSending(true);
        await onSend(mediaFile, mode);
        setSending(false);
        onClose();
    }
  };

  const resetCapture = () => {
    setCapturedMedia(null);
    setMediaFile(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full p-0 gap-0" hideCloseButton>
        <DialogHeader className="sr-only">
          <DialogTitle>Camera View</DialogTitle>
        </DialogHeader>
        <div className="relative aspect-video bg-black rounded-t-lg">
          {capturedMedia ? (
            <>
              {mode === 'photo' ? (
                <img src={capturedMedia} alt="Captured" className="w-full h-full object-cover rounded-t-lg" />
              ) : (
                <video src={capturedMedia} controls autoPlay className="w-full h-full object-cover rounded-t-lg" />
              )}
            </>
          ) : hasPermission ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover rounded-t-lg" />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
           <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-white hover:bg-black/50" onClick={onClose}>
                <X />
           </Button>
        </div>
        <div className="p-4 bg-background flex flex-col items-center justify-center space-y-4">
            {capturedMedia ? (
                 <div className="flex w-full justify-around items-center">
                    <Button variant="outline" size="lg" className="rounded-full w-16 h-16" onClick={resetCapture} disabled={sending}>
                        <RefreshCw className="h-7 w-7"/>
                    </Button>
                    <Button size="lg" className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600" onClick={handleSend} disabled={sending}>
                        {sending ? <Loader2 className="h-7 w-7 animate-spin" /> : <Send className="h-7 w-7" />}
                    </Button>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-4">
                        <Button variant={mode === 'photo' ? 'secondary' : 'ghost'} onClick={() => setMode('photo')}>
                           <Camera className="mr-2 h-4 w-4"/> Photo
                        </Button>
                        <Button variant={mode === 'video' ? 'secondary' : 'ghost'} onClick={() => setMode('video')}>
                           <Video className="mr-2 h-4 w-4"/> Video
                        </Button>
                    </div>
                    <div className="flex w-full justify-around items-center">
                         <Button
                            size="lg"
                            className={cn("rounded-full w-20 h-20 border-4 border-white bg-transparent hover:bg-white/20", isRecording && 'bg-red-500 hover:bg-red-600 animate-pulse')}
                            onClick={handleShutterClick}
                            disabled={!stream}
                        >
                           <div className="w-16 h-16 rounded-full bg-primary/50" />
                        </Button>
                    </div>
                </>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
