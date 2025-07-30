
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, addIceCandidate, onIceCandidateAdded, listenForCallUpdates, hangUpCall, updateCallData } from '@/lib/firebase';
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
    const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [connectionStatus, setConnectionStatus] = useState<'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'>('connecting');
    
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


    const processIceCandidateBuffer = (pc: RTCPeerConnection) => {
        iceCandidateBuffer.current.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
        });
        iceCandidateBuffer.current = [];
    };

    const handleHangUp = useCallback(async () => {
        if (peerConnection) {
            peerConnection.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        await hangUpCall(callId);
    }, [localStream, callId]);


    useEffect(() => {
        if (!localStream || !currentUserId || !opponentId) return;

        const pc = new RTCPeerConnection(servers);
        setPeerConnection(pc);

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
             setConnectionStatus(pc.connectionState);
             if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
                handleHangUp();
             }
        };

        const unsubscribeIce = onIceCandidateAdded(callId, opponentId, (candidate) => {
            if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                iceCandidateBuffer.current.push(candidate);
            }
        });

        const callDocRef = doc(db, 'calls', callId);

        const unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            const isOfferSet = pc.remoteDescription && pc.remoteDescription.type === 'offer';
            const isAnswerSet = pc.remoteDescription && pc.remoteDescription.type === 'answer';

            if (isInitiator && !data.offer) {
                const offerDescription = await pc.createOffer();
                await pc.setLocalDescription(offerDescription);
                await updateCallData(callId, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });
            }

            if (!isInitiator && data.offer && !isOfferSet) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                processIceCandidateBuffer(pc);
                
                const answerDescription = await pc.createAnswer();
                await pc.setLocalDescription(answerDescription);
                await updateCallData(callId, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });
            }

            if (isInitiator && data.answer && !isAnswerSet) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                processIceCandidateBuffer(pc);
            }
        });

        return () => {
            unsubscribeIce();
            unsubscribeCall();
            pc.close();
            localStream.getTracks().forEach(track => track.stop());
        };

    }, [localStream, callId, isInitiator, currentUserId, opponentId, handleHangUp]);


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

    return { peerConnection, localStream, remoteStream, hangUp: handleHangUp, isMuted, toggleMute, isVideoOff, toggleVideo, connectionStatus };
}
