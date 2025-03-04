import React, { useState, useEffect, useRef } from 'react';
import { Socket, io } from 'socket.io-client';
import Header from './Header';

interface Message {
  text: string;
  isSent: boolean;
  tempId?: number;
  status: 'pending' | 'delivered';
}

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState<string>('');
  const [room, setRoom] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [showIncomingCall, setShowIncomingCall] = useState<boolean>(false);
  const [showVideoBlock, setShowVideoBlock] = useState<boolean>(false);
  const [noOneHere, setNoOneHere] = useState<boolean>(true);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  
  const socket = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const rtcSettings = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
  
    socket.current = io('http://localhost:3000', {
        withCredentials: true,
        transports: ['polling', 'websocket'] 
    });

    socket.current.emit("joinroom");  
    
   
    socket.current.on("joined", (roomname: string) => {
        document.querySelector(".noOneHere")?.classList.add("hidden");
        setRoom(roomname);
        setNoOneHere(false);
    });

    socket.current.on("message", (message: string, tempId: number) => {
      console.log("Received message:", message);
      receiveMessage(message, tempId);
    });
    
    socket.current.on("incomingCall", () => {
      setShowIncomingCall(true);
    });
    
    socket.current.on("callAccepted", () => {
      initialize();
      setShowVideoBlock(true);
    });
    
    socket.current.on("callRejected", () => {
      alert("Call rejected by other user");
    });
    
    socket.current.on("signalingMessage", handleSignalingMessage);
    
    socket.current.on("userTyping", () => {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 3000);
    });
    
    socket.current.on("connect_error", (err) => {
      console.log("Connection error:", err.message);
    });

    socket.current.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
    });
    
 
    return () => {
        if (socket.current) {
            socket.current.disconnect();
        }
        hangup();
    };
  }, []);

  useEffect(() => {
   
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && socket.current && room) {
      
      const tempId = Date.now(); 
      setMessages(prev => [...prev, { 
        text: messageText, 
        isSent: true,
        tempId, 
        status: 'pending' 
      }]);
      
      socket.current.emit("message", { 
        room: room, 
        message: messageText,
        tempId 
      });

      setMessageText('');
      
      
      setTimeout(() => {
        if (messageContainerRef.current) {
          messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
        }
      }, 0);
    }
  };

  const receiveMessage = (message: string, receivedTempId?: number) => {
    setMessages(prev => {
      // If we have a temp ID, replace the pending message
      if (receivedTempId) {
        return prev.map(msg => 
          msg.tempId === receivedTempId 
            ? { ...msg, status: 'delivered' } 
            : msg
        ).concat({ text: message, isSent: false });
      }
      return [...prev, { text: message, isSent: false }];
    });
  };

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
      console.log("Rejected by browser", err);
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
      console.log("Error in creating offer:", err);
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
        console.log(error);
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
      console.log("Failed to handle offer:", error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
      }
    } catch (error) {
      console.log("Failed to handle answer", error);
    }
  };

  const hangup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setShowVideoBlock(false);
      
      if (socket.current && room) {
        socket.current?.emit("signalingMessage", { 
          room, 
          message: JSON.stringify({ type: "hangup" }) 
        });
      }
      
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
          <div id="videos">
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
          <div id="controls">
            <div className="control-container" id="cameraButton">
              <svg width="21" height="14" viewBox="0 0 21 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20.525 2.149C20.365 2.05 20.183 2 20 2C19.847 2 19.694 2.035 19.553 2.105L17 3.382V3C17 1.346 15.654 0 14 0H3C1.346 0 0 1.346 0 3V11C0 12.654 1.346 14 3 14H14C15.654 14 17 12.654 17 11V10.618L19.553 11.894C19.694 11.965 19.847 12 20 12C20.183 12 20.365 11.95 20.525 11.851C20.82 11.668 21 11.347 21 11V3C21 2.653 20.82 2.332 20.525 2.149ZM5 8.5C4.171 8.5 3.5 7.829 3.5 7C3.5 6.171 4.171 5.5 5 5.5C5.829 5.5 6.5 6.171 6.5 7C6.5 7.829 5.829 8.5 5 8.5Z"
                  fill="white" 
                />
              </svg>
            </div>

            <div className="control-container" id="hangup" onClick={hangup}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="red" />
                <path
                  d="M20 15.5c-.78 0-1.55-.3-2.12-.88l-1.43-1.42a4.007 4.007 0 0 0-5.54 0l-1.43 1.42A2.983 2.983 0 0 1 4 15.5c-.78 0-1.55-.3-2.12-.88A2.983 2.983 0 0 1 1 12.5a2.983 2.983 0 0 1 .88-2.12l7-7a4.007 4.007 0 0 1 5.54 0l7 7c.58.58.88 1.34.88 2.12s-.3 1.55-.88 2.12c-.58.58-1.34.88-2.12.88z" 
                />
              </svg>
            </div>

            <div className="control-container" id="micButton">
              <svg width="20" height="20" viewBox="0 0 14 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  fillRule="evenodd" 
                  clipRule="evenodd"
                  d="M7 12.5C8.7 12.5 10 11.2 10 9.5V3.5C10 1.8 8.7 0.5 7 0.5C5.3 0.5 4 1.8 4 3.5V9.5C4 11.2 5.3 12.5 7 12.5ZM12.3 9.5C12.3 12.5 9.8 14.6 7 14.6C4.2 14.6 1.7 12.5 1.7 9.5H0C0 12.9 2.7 15.7 6 16.2V19.5H8V16.2C11.3 15.7 14 12.9 14 9.5H12.3Z"
                  fill="white" 
                />
              </svg>
            </div>
          </div>
        </div>
      )}
      
      {/* Incoming call dialog */}
      {showIncomingCall && (
        <div className="fixed z-[222] w-full h-dvh bg-gray-900 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white p-8 rounded-md text-center">
            <p className="mb-4">Incoming Call...</p>
            <button 
              className="bg-green-500 text-white py-2 px-4 rounded-md"
              onClick={acceptCall}
            >
              Accept
            </button>
            <button 
              className="bg-red-500 text-white py-2 px-4 rounded-md ml-2"
              onClick={rejectCall}
            >
              Reject
            </button>
          </div>
        </div>
      )}
      
      {/* Chat messages */}
      <main className="flex-1 p-4 overflow-y-auto relative" ref={messageContainerRef}>
         { noOneHere && (
          <div className="text-zinc-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 text-center">
            bhagwaan kasam koi nahi hai yaha, ruko shaayad koi aajaye.
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex my-2 ${msg.isSent ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`${
              msg.isSent ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'
            }  py-2 px-8  rounded-lg max-w-md break-words`}>
              <p>{msg.text}</p>
              <div className={`text-xs mt-1 ${msg.isSent ? 'text-blue-100' : 'text-gray-500'}`}>
                {msg.isSent ? 'Sent' : 'Received'}
              </div>
            </div>
          </div>
        ))}
      </main>
      
      {/* Typing indicator */}
      {isTyping && (
        <div className="px-4 py-2 text-sm text-gray-500 italic">
          typing...
        </div>
      )}
      
      {/* Message input */}
      <form id="chatform" className="bg-white p-4 flex" onSubmit={handleSendMessage}>
        <input 
          id='messagebox'
          type="text" 
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="Type a message"
          value={messageText}
          onChange={handleTyping}
        />
        <button 
          type="submit"
          className="ml-2 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700"
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


