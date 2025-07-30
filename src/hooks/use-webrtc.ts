
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, addIceCandidate, onIceCandidateAdded, hangUpCall, updateCallData } from '@/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';

export function useWebRTC(callId: string, isInitiator: boolean, callType: 'audio' | 'video', currentUserId?: string, opponentId?: string) {
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const remoteStreamRef = useRef<MediaStream | null>(null);

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
    const [connectionStatus, setConnectionStatus] = useState<'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'>('new');
    
    const iceCandidateBuffer = useRef<RTCIceCandidateInit[]>([]);

     const hangUp = useCallback(async () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }
        if (remoteStreamRef.current) {
            remoteStreamRef.current.getTracks().forEach(track => track.stop());
            remoteStreamRef.current = null;
            setRemoteStream(null);
        }

        // Check if call document still exists before trying to update it
        const callDocRef = doc(db, 'calls', callId);
        if ((await getDoc(callDocRef)).exists()) {
            await hangUpCall(callId);
        }
    }, [callId]);


    useEffect(() => {
        let isCancelled = false;
        let unsubscribeCall: (() => void) | undefined;
        let unsubscribeIce: (() => void) | undefined;

        const setupWebRTC = async () => {
            if (!currentUserId || !opponentId || isCancelled) return;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: callType === 'video',
                    audio: true,
                });

                if (isCancelled) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                localStreamRef.current = stream;
                setLocalStream(stream);

                const response = await fetch('/api/turn');
                if (!response.ok) {
                    throw new Error('Failed to fetch TURN credentials');
                }
                const iceServers = await response.json();
                
                const pc = new RTCPeerConnection({ iceServers });
                peerConnectionRef.current = pc;

                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });

                pc.ontrack = event => {
                    if (!isCancelled) {
                        remoteStreamRef.current = event.streams[0];
                        setRemoteStream(event.streams[0]);
                    }
                };

                pc.onicecandidate = event => {
                    if (event.candidate && currentUserId) {
                        addIceCandidate(callId, currentUserId, event.candidate.toJSON());
                    }
                };

                pc.onconnectionstatechange = () => {
                    if (pc.connectionState && !isCancelled) {
                        setConnectionStatus(pc.connectionState);
                        if (['disconnected', 'closed', 'failed'].includes(pc.connectionState)) {
                             hangUp();
                        }
                    }
                };
                
                const callDocRef = doc(db, 'calls', callId);

                unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
                    const data = snapshot.data();
                    if (!data || !peerConnectionRef.current || isCancelled) return;

                    const currentPc = peerConnectionRef.current;
                    const isRemoteDescSet = !!currentPc.remoteDescription;

                    if (data.offer && !isInitiator && !isRemoteDescSet) {
                        try {
                            await currentPc.setRemoteDescription(new RTCSessionDescription(data.offer));
                            const answerDescription = await currentPc.createAnswer();
                            await currentPc.setLocalDescription(answerDescription);
                            await updateCallData(callId, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });
                            
                            iceCandidateBuffer.current.forEach(candidate => {
                                currentPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered ICE candidate", e));
                            });
                            iceCandidateBuffer.current = [];

                        } catch (error) {
                            console.error("Error setting remote offer and creating answer:", error);
                        }
                    }

                    if (data.answer && isInitiator && !isRemoteDescSet) {
                        try {
                            await currentPc.setRemoteDescription(new RTCSessionDescription(data.answer));
                             iceCandidateBuffer.current.forEach(candidate => {
                                currentPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered ICE candidate", e));
                            });
                            iceCandidateBuffer.current = [];
                        } catch(error) {
                            console.error("Error setting remote answer:", error);
                        }
                    }
                });
                
                if (isInitiator) {
                     const offerDescription = await pc.createOffer();
                     await pc.setLocalDescription(offerDescription);
                     await updateCallData(callId, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });
                }

                unsubscribeIce = onIceCandidateAdded(callId, opponentId, (candidate) => {
                    if (peerConnectionRef.current?.remoteDescription) {
                        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding ICE candidate", e));
                    } else {
                        iceCandidateBuffer.current.push(candidate);
                    }
                });

            } catch (error) {
                console.error("Error setting up WebRTC:", error);
                hangUp();
            }
        };

        setupWebRTC();

        return () => {
            isCancelled = true;
            if (unsubscribeCall) unsubscribeCall();
            if (unsubscribeIce) unsubscribeIce();
            hangUp();
        };
    }, [callId, isInitiator, callType, currentUserId, opponentId, hangUp]);


    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(prev => !prev);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current && callType === 'video') {
            localStreamRef.current.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(prev => !prev);
        }
    };

    return { localStream, remoteStream, hangUp, isMuted, toggleMute, isVideoOff, toggleVideo, connectionStatus };
}
