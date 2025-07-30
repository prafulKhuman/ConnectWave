
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db, addIceCandidate, onIceCandidateAdded, hangUpCall, updateCallData } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export function useWebRTC(callId: string, isInitiator: boolean, callType: 'audio' | 'video', currentUserId?: string, opponentId?: string) {
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
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
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if(remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            setRemoteStream(null);
        }

        await hangUpCall(callId);
    }, [callId, localStream, remoteStream]);

    const processIceCandidateBuffer = useCallback(() => {
        if (peerConnectionRef.current) {
            iceCandidateBuffer.current.forEach(candidate => {
                peerConnectionRef.current!.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered ICE candidate", e));
            });
            iceCandidateBuffer.current = [];
        }
    }, []);


    useEffect(() => {
        let isCancelled = false;
        let unsubscribeCall: () => void = () => {};
        let unsubscribeIce: () => void = () => {};

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
                 pc.onsignalingstatechange = () => {
                    if(pc.signalingState) {
                        // console.log("Signaling state:", pc.signalingState);
                    }
                };
                
                const callDocRef = doc(db, 'calls', callId);

                unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
                    const data = snapshot.data();
                    if (!data || !peerConnectionRef.current || isCancelled) return;

                    const currentPc = peerConnectionRef.current;
                    
                    if (data.offer && !isInitiator && !currentPc.remoteDescription) {
                        try {
                            await currentPc.setRemoteDescription(new RTCSessionDescription(data.offer));
                            const answerDescription = await currentPc.createAnswer();
                            await currentPc.setLocalDescription(answerDescription);
                            await updateCallData(callId, { answer: { sdp: answerDescription.sdp, type: answerDescription.type } });
                            processIceCandidateBuffer();
                        } catch (error) {
                            console.error("Error setting remote offer and creating answer:", error);
                        }
                    }


                    if (data.answer && isInitiator && !currentPc.remoteDescription) {
                        try {
                            const answerDescription = new RTCSessionDescription(data.answer);
                            await currentPc.setRemoteDescription(answerDescription);
                            processIceCandidateBuffer();
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callId, isInitiator, callType, currentUserId, opponentId]);


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

    return { localStream, remoteStream, hangUp, isMuted, toggleMute, isVideoOff, toggleVideo, connectionStatus };
}
