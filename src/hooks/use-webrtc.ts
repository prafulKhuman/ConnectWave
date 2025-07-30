
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, addIceCandidate, onIceCandidateAdded, hangUpCall, updateCallData } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
        },
    ],
    iceCandidatePoolSize: 10,
};

export function useWebRTC(callId: string, isInitiator: boolean, callType: 'audio' | 'video', currentUserId?: string, opponentId?: string) {
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [connectionStatus, setConnectionStatus] = useState<'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'>('new');
    
    const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);

    const setupStreams = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: callType === 'video',
                audio: true,
            });
            setLocalStream(stream);
        } catch (error) {
            console.error("Error accessing media devices.", error);
        }
    }, [callType]);

    useEffect(() => {
        setupStreams();
    }, [setupStreams]);

    const handleHangUp = useCallback(async () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        setLocalStream(null);
        setRemoteStream(null);
        await hangUpCall(callId);
    }, [localStream, callId]);

    const processIceCandidateBuffer = useCallback((pc: RTCPeerConnection) => {
        iceCandidateBuffer.current.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered ICE candidate", e));
        });
        iceCandidateBuffer.current = [];
    }, []);


    useEffect(() => {
        if (!localStream || !currentUserId || !opponentId) return;

        const pc = new RTCPeerConnection(servers);
        peerConnectionRef.current = pc;

        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });

        pc.ontrack = event => {
            setRemoteStream(event.streams[0]);
        };

        pc.onicecandidate = event => {
            if (event.candidate) {
                addIceCandidate(callId, currentUserId, event.candidate.toJSON());
            }
        };

        pc.onconnectionstatechange = () => {
             if (pc.connectionState) {
                setConnectionStatus(pc.connectionState);
                if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
                    handleHangUp();
                }
             }
        };
        
        const callDocRef = doc(db, 'calls', callId);

        const unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data || !peerConnectionRef.current) return;

            const currentPc = peerConnectionRef.current;
            
            if (isInitiator && !data.offer) {
                if (currentPc.signalingState === 'stable') {
                    const offerDescription = await currentPc.createOffer();
                    await currentPc.setLocalDescription(offerDescription);
                    await updateCallData(callId, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });
                }
            }
            
            if (data.offer && currentPc.signalingState === 'stable' && !isInitiator) {
                const offerDescription = new RTCSessionDescription(data.offer);
                await currentPc.setRemoteDescription(offerDescription);
                
                const answerDescription = await currentPc.createAnswer();
                await currentPc.setLocalDescription(answerDescription);
                await updateCallData(callId, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });
                
                processIceCandidateBuffer(currentPc);
            }

            if (data.answer && currentPc.remoteDescription === null) {
                 const answerDescription = new RTCSessionDescription(data.answer);
                 await currentPc.setRemoteDescription(answerDescription);
                 processIceCandidateBuffer(currentPc);
            }
        });
        
        const unsubscribeIce = onIceCandidateAdded(callId, opponentId, (candidate) => {
            if (peerConnectionRef.current?.remoteDescription) {
                peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate", e));
            } else {
                iceCandidateBuffer.current.push(candidate);
            }
        });


        return () => {
            unsubscribeIce();
            unsubscribeCall();
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };

    }, [localStream, callId, isInitiator, currentUserId, opponentId, handleHangUp, processIceCandidateBuffer]);


    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(prev => !prev);
        }
    };

    const toggleVideo = () => {
        if (localStream && callType === 'video') {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(prev => !prev);
        }
    };

    return { peerConnection: peerConnectionRef.current, localStream, remoteStream, hangUp: handleHangUp, isMuted, toggleMute, isVideoOff, toggleVideo, connectionStatus };
}
