import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket, io } from 'socket.io-client';
import Header from './Header';



const ChatPage: React.FC = () => {
  // Message and UI State
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  
  // Call and Connection States
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [showIncomingCall, setShowIncomingCall] = useState<boolean>(false);
  const [showVideoBlock, setShowVideoBlock] = useState<boolean>(false);
  const [noOneHere, setNoOneHere] = useState<boolean>(true);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  
  // Media and Connection Refs
  const socket = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Camera and Mic State
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [isMicOn, setIsMicOn] = useState<boolean>(true);

  // WebRTC Configuration
  const rtcSettings: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ],
    iceTransportPolicy: "all"
  };

  // Socket and WebRTC Setup
  useEffect(() => {
    // Initialize Socket Connection
    socket.current = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['polling', 'websocket'] 
    });

    // Socket Event Listeners
    const socketEvents = [
      { event: "joined", handler: handleRoomJoined },
      { event: "message", handler: handleIncomingMessage },
      { event: "incomingCall", handler: handleIncomingCall },
      { event: "callAccepted", handler: handleCallAccepted },
      { event: "callRejected", handler: handleCallRejected },
      { event: "signalingMessage", handler: handleSignalingMessage },
      { event: "userTyping", handler: handleUserTyping },
      { event: "connect_error", handler: handleConnectionError },
      { event: "disconnect", handler: handleDisconnect }
    ];

    socketEvents.forEach(({ event, handler }) => {
      socket.current?.on(event, handler);
    });

    // Join Room
    socket.current.emit("joinroom");

    // Cleanup
    return () => {
      socketEvents.forEach(({ event, handler }) => {
        socket.current?.off(event, handler);
      });
      
      if (socket.current) {
        socket.current.disconnect();
      }
      hangup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Event Handlers
  const handleRoomJoined = (roomname: string) => {
    document.querySelector(".noOneHere")?.classList.add("hidden");
    setRoom(roomname);
    setNoOneHere(false);
  };

  const handleIncomingMessage = (message: string, tempId: number) => {
    receiveMessage(message, tempId);
  };

  const handleIncomingCall = () => {
    setShowIncomingCall(true);
  };

  const handleCallAccepted = () => {
    initialize();
    setShowVideoBlock(true);
  };

  const handleCallRejected = () => {
    alert("Call rejected by other user");
  };

  const handleUserTyping = () => {
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 3000);
  };

  const handleConnectionError = (err: Error) => {
    console.error("Connection error:", err.message);
  };

  const handleDisconnect = (reason: string) => {
    console.log("Disconnected:", reason);
  };

  // Message Scroll Effect
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Message Sending


  interface Message {
    text: string;
    isSent: boolean;
    tempId?: number;
    status: 'pending' | 'delivered';
  }

  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && socket.current && room) {
      const tempId = Date.now(); 
      setMessages(prev => [...prev, { 
        text: messageText, 
        isSent: true,
        tempId, 
        status: 'delivered' 
      }]);
      
      socket.current.emit("message", { 
        room: room, 
        message: messageText,
        tempId 
      });

      setMessageText('');
    }
  };

  const receiveMessage = (message: string, receivedTempId?: number) => {
    setMessages(prev => {
      if (receivedTempId) {
        return prev.map(msg => 
          msg.tempId === receivedTempId 
            ? { ...msg, status: 'delivered' } 
            : msg
        );
      }
      return [...prev, { 
        text: message, 
        isSent: false, 
        status: 'delivered' 
      }];
    });
  };

  // Video Call Methods
  const startVideoCall = () => {
    if (socket.current && room) {
      socket.current.emit("startVideoCall", { room });
    }
  };

  const acceptCall = () => {
    setShowIncomingCall(false);
    initialize();
    setShowVideoBlock(true);
    if (socket.current && room) {
      socket.current.emit("acceptCall", { room });
    }
  };

  const rejectCall = () => {
    setShowIncomingCall(false);
    if (socket.current && room) {
      socket.current.emit("rejectCall", { room });
    }
  };

  // Media and Peer Connection Setup
  const initialize = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      initiateOffer();
      setIsInCall(true);
    } catch (err) {
      console.error("Media access error", err);
      alert("Could not access media devices. Please check permissions.");
    }
  };

  const createPeerConnection = async () => {
    peerConnectionRef.current = new RTCPeerConnection(rtcSettings);
    
    remoteStreamRef.current = new MediaStream();
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.classList.add("smallFrame");
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (peerConnectionRef.current && localStreamRef.current) {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        }
      });
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
          if (remoteStreamRef.current) {
            remoteStreamRef.current.addTrack(track);
          }
        });
      };
      
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate && socket.current && room) {
          socket.current?.emit("signalingMessage", {
            room,
            message: JSON.stringify({
              type: "candidate",
              candidate: event.candidate
            })
          });
        }
      };
      
      peerConnectionRef.current.onconnectionstatechange = () => {
        console.log("Connection state change:", peerConnectionRef.current?.connectionState);
      };
    }
  };

  const initiateOffer = async () => {
    await createPeerConnection();
    
    try {
      if (peerConnectionRef.current) {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        
        if (socket.current && room) {
          socket.current?.emit("signalingMessage", {
            room,
            message: JSON.stringify({
              type: "offer",
              offer
            })
          });
        }
      }
    } catch (err) {
      console.error("Error in creating offer:", err);
    }
  };

  const handleSignalingMessage = async (message: string) => {
    const { type, offer, answer, candidate } = JSON.parse(message);
    
    if (type === "offer") handleOffer(offer);
    if (type === "answer") handleAnswer(answer);
    if (type === "candidate" && peerConnectionRef.current) {
      try { 
        await peerConnectionRef.current.addIceCandidate(candidate); 
      } catch (error) {
        console.error("ICE Candidate Error:", error);
      }
    }
    if (type === "hangup") {
      hangup();
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    await createPeerConnection();
    
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        
        if (socket.current && room) {
          socket.current?.emit("signalingMessage", { 
            room, 
            message: JSON.stringify({ type: "answer", answer }) 
          });
        }
        
        setIsInCall(true);
      }
    } catch (error) {
      console.error("Failed to handle offer:", error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current?.currentRemoteDescription) {
        console.log('Answer already set');
        return;
      }
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    } catch (error) {
      console.error("Failed to handle answer", error);
    }
  };

  // Media Controls
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      videoTrack.enabled = !isCameraOn;
      setIsCameraOn(!isCameraOn);
    }
  };

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      audioTrack.enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const hangup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      setShowVideoBlock(false);
      setIsInCall(false);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (socket.current && room) {
      socket.current.emit("typing", { room });
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-200">
      <Header onVideoCallClick={startVideoCall} />
      
      {/* Video call section */}
      {showVideoBlock && (
        <div className="fixed videoblock z-[222] w-full h-svh">
          <div id="videos" className="relative">
            <video 
              className="video-player" 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline
            />
            <video 
              className="video-player" 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline
            />
          </div>
          <div id="controls" className="absolute bottom-0 w-full flex justify-center space-x-4 pb-4">
            <div 
              className={`control-container cursor-pointer ${isCameraOn ? 'bg-white' : 'bg-red-500'}`} 
              onClick={toggleCamera}
            >
              <svg width="21" height="14" viewBox="0 0 21 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20.525 2.149C20.365 2.05 20.183 2 20 2C19.847 2 19.694 2.035 19.553 2.105L17 3.382V3C17 1.346 15.654 0 14 0H3C1.346 0 0 1.346 0 3V11C0 12.654 1.346 14 3 14H14C15.654 14 17 12.654 17 11V10.618L19.553 11.894C19.694 11.965 19.847 12 20 12C20.183 12 20.365 11.95 20.525 11.851C20.82 11.668 21 11.347 21 11V3C21 2.653 20.82 2.332 20.525 2.149ZM5 8.5C4.171 8.5 3.5 7.829 3.5 7C3.5 6.171 4.171 5.5 5 5.5C5.829 5.5 6.5 6.171 6.5 7C6.5 7.829 5.829 8.5 5 8.5Z"
                  fill={isCameraOn ? "black" : "white"} 
                />
              </svg>
            </div>

            <div 
              className="control-container cursor-pointer" 
              id="hangup" 
              onClick={hangup}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path 
                  fill="currentColor" 
                  d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9c-1.27.6-2.4 1.52-3.32 2.66A16.8 16.8 0 0 0 2 18.46c0 .28.22.5.5.5h8.07c.13 0 .26-.05.35-.15l2.39-2.39c.2-.2.2-.51 0-.71l-2.39-2.39a.5.5 0 0 0-.35-.15H4.5c.42-1.16 1.12-2.27 2.07-3.38c.94-1.1 2.14-2.05 3.47-2.79c.39-.19.66-.58.66-1.03V6.5c0-.28.22-.5.5-.5s.5.22.5.5v3.28c0 .43.27.82.66 1.03c1.33.74 2.53 1.69 3.47 2.79c.95 1.11 1.65 2.22 2.07 3.38h-2.93a.5.5 0 0 0-.35.15l-2.39 2.39a.5.5 0 0 0 0 .71l2.39 2.39c.09.09.22.15.35.15H21.5c.28 0 .5-.22.5-.5a16.8 16.8 0 0 0-1.52-2.18c-.92-1.14-2.05-2.06-3.32-2.66a.99.99 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"
                />
              </svg>
            </div>

            <div 
              className={`control-container cursor-pointer ${isMicOn ? 'bg-white' : 'bg-red-500'}`} 
              onClick={toggleMicrophone}
            >
              <svg width="20" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  fillRule="evenodd" 
                  clipRule="evenodd"
                  d="M7 12.5C8.7 12.5 10 11.2 10 9.5V3.5C10 1.8 8.7 0.5 7 0.5C5.3 0.5 4 1.8 4 3.5V9.5C4 11.2 5.3 12.5 7 12.5ZM12.3 9.5C12.3 12.5 9.8 14.6 7 14.6C4.2 14.6 1.7 12.5 1.7 9.5H0C0 12.9 2.7 15.7 6 16.2V19.5H8V16.2C11.3 15.7 14 12.9 14 9.5H12.3Z"
                  fill={isMicOn ? "black" : "white"} 
                />
              </svg>
            </div>
          </div>
        </div>
      )}
      
      {/* Incoming call dialog */}
      {showIncomingCall && (
        <div className="fixed z-[222] w-full h-dvh bg-gray-900 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white p-8 rounded-md text-center shadow-xl">
            <p className="mb-4 text-lg font-semibold">Incoming Video Call</p>
            <div className="flex justify-center space-x-4">
              <button 
                className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 transition"
                onClick={acceptCall}
              >
                Accept
              </button>
              <button 
                className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 transition"
                onClick={rejectCall}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat messages */}
      <main className="flex-1 p-4 overflow-y-auto relative" ref={messageContainerRef}>
        {noOneHere && (
          <div className="text-zinc-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 text-center">
            No one is here right now. Wait a moment, someone might join soon.
          </div>
        )}
        
        {messages.map((msg) => (
          <div 
            key={msg.tempId || msg.text} 
            className={`flex my-2 ${msg.isSent ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`${
              msg.isSent ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'
            } py-2 px-4 rounded-lg max-w-md break-words relative`}>
              <p>{msg.text}</p>
              <div className={`text-xs mt-1 ${msg.isSent ? 'text-blue-100' : 'text-gray-500'}`}>
                {msg.status === 'pending' ? 'Sending...' : (msg.isSent ? 'Sent' : 'Received')}
              </div>
            </div>
          </div>
        ))}
      </main>
      
      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-2 text-sm text-gray-500 italic">
          Someone is typing...
        </div>
      )}
      
      {/* Message input */}
      <form id="chatform" className="bg-white p-4 flex shadow-md" onSubmit={handleSendMessage}>
        <input 
          id='messagebox'
          type="text" 
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent sm:text-sm"
          placeholder="Type a message"
          value={messageText}
          onChange={handleTyping}
        />
        <button 
          type="submit"
          className="ml-2 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition"
        >
          Send
        </button>
      </form>
      
      {/* Hidden videos - needed for WebRTC setup */}
      <video ref={localVideoRef} className="hidden" autoPlay muted />
      <video ref={remoteVideoRef} className="hidden" autoPlay />
    </div>
  );
};

export default ChatPage;