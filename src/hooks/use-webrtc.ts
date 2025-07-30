
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
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');


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


    useEffect(() => {
        if (!localStream || !currentUserId || !opponentId) return;

        const pc = new RTCPeerConnection(servers);
        setPeerConnection(pc);

        // Add local stream tracks to the peer connection
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });

        // Handle remote stream
        pc.ontrack = event => {
            setRemoteStream(event.streams[0]);
        };

        // Handle ICE candidates
        pc.onicecandidate = event => {
            if (event.candidate) {
                addIceCandidate(callId, currentUserId, event.candidate.toJSON());
            }
        };

        pc.onconnectionstatechange = () => {
             setConnectionStatus(pc.connectionState as any);
             if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed' || pc.connectionState === 'failed') {
                hangUp();
             }
        };

        // Listen for ICE candidates from the other peer
        const unsubscribeIce = onIceCandidateAdded(callId, opponentId, (candidate) => {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        // Signaling logic
        const callDocRef = doc(db, 'calls', callId);

        const unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
            const data = snapshot.data();
            if (!data) return;

            // Initiator creates offer
            if (isInitiator && !data.offer) {
                const offerDescription = await pc.createOffer();
                await pc.setLocalDescription(offerDescription);
                await updateCallData(callId, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });
            }

            // Callee answers
            if (!isInitiator && data.offer && !data.answer) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answerDescription = await pc.createAnswer();
                await pc.setLocalDescription(answerDescription);
                await updateCallData(callId, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });
            }

            // Initiator sets remote description with answer
            if (isInitiator && data.answer && pc.remoteDescription?.type !== 'answer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });

        return () => {
            unsubscribeIce();
            unsubscribeCall();
            pc.close();
            localStream.getTracks().forEach(track => track.stop());
        };

    }, [localStream, callId, isInitiator, currentUserId, opponentId]);

    const hangUp = async () => {
        if (peerConnection) {
            peerConnection.close();
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        await hangUpCall(callId);
    };

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

    return { peerConnection, localStream, remoteStream, hangUp, isMuted, toggleMute, isVideoOff, toggleVideo, connectionStatus };
}
