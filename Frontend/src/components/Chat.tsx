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
  const [noOneHere, setNoOneHere] = useState<boolean>(true);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [showIncomingCall, setShowIncomingCall] = useState<boolean>(false);

  const socket = useRef<Socket | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.current = io('https://omeglebackend-5n8t.onrender.com', {
      withCredentials: true,
      transports: ['polling', 'websocket']
    });

    const socketEvents = [
      { event: 'joined', handler: handleRoomJoined },
      { event: 'message', handler: handleIncomingMessage },
      { event: 'userTyping', handler: handleUserTyping },
      { event: 'incomingCall', handler: handleIncomingCall },
      { event: 'callAccepted', handler: handleCallAccepted },
      { event: 'connect_error', handler: handleConnectionError },
      { event: 'disconnect', handler: handleDisconnect }
    ];

    socketEvents.forEach(({ event, handler }) => {
      socket.current?.on(event, handler);
    });

    console.log('Joining room...');
    socket.current.emit('joinroom');

    return () => {
      socketEvents.forEach(({ event, handler }) => {
        socket.current?.off(event, handler);
      });
      socket.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRoomJoined = (roomname: string) => {
    console.log('Joined room:', roomname);
    document.querySelector('.noOneHere')?.classList.add('hidden');
    setRoom(roomname);
    setNoOneHere(false);
  };

  const handleIncomingMessage = (message: string, tempId: number) => {
    console.log('Incoming message:', message);
    receiveMessage(message, tempId);
  };

  const handleIncomingCall = () => {
    console.log('Incoming call event received');
    setShowIncomingCall(true);
  };

  const handleCallAccepted = () => {
    console.log('Call accepted event received');
    window.location.href = 'https://webrtc-leg5.onrender.com';
  };

  const handleUserTyping = () => {
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 3000);
  };

  const handleConnectionError = (err: Error) => {
    console.error('Connection error:', err.message);
  };

  const handleDisconnect = (reason: string) => {
    console.log('Disconnected:', reason);
  };

  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim() && socket.current && room) {
      const tempId = Date.now();
      setMessages((prev) => [
        ...prev,
        { text: messageText, isSent: true, tempId, status: 'delivered' }
      ]);
      socket.current.emit('message', {
        room,
        message: messageText,
        tempId
      });
      setMessageText('');
    }
  };

  const receiveMessage = (message: string, receivedTempId?: number) => {
    setMessages((prev) => {
      if (receivedTempId) {
        return prev.map((msg) =>
          msg.tempId === receivedTempId ? { ...msg, status: 'delivered' } : msg
        );
      }
      return [
        ...prev,
        { text: message, isSent: false, status: 'delivered' }
      ];
    });
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (socket.current && room) {
      socket.current.emit('typing', { room });
    }
  };

  // Caller: Initiate video call request
  const startVideoCall = () => {
    if (noOneHere) {
      alert('Please wait until another user joins the chat to start a video call.');
      return;
    }
    console.log('Starting video call...');
    if (socket.current && room) {
      socket.current.emit('startVideoCall', { room });
    }
  };

  // Callee: Accept the incoming call
  const acceptCall = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('Accepting call...');
    setShowIncomingCall(false);
    if (socket.current && room) {
      socket.current.emit('acceptCall', { room });
    }
    // Delay redirection to ensure the socket event is processed
    setTimeout(() => {
      window.location.assign('https://webrtc-leg5.onrender.com');
    }, 100); // adjust delay if needed
  };
  
  
  
  // Callee: Reject the incoming call
  const rejectCall = () => {
    console.log('Rejecting call...');
    setShowIncomingCall(false);
    if (socket.current && room) {
      socket.current.emit('rejectCall', { room });
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-gray-200">
      <Header onVideoCallClick={startVideoCall} />

      {/* Incoming call modal */}
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
      <main
        className="flex-1 p-4 overflow-y-auto relative"
        ref={messageContainerRef}
      >
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
            <div
              className={`${
                msg.isSent ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'
              } py-2 px-4 rounded-lg max-w-md break-words relative`}
            >
              <p>{msg.text}</p>
              <div
                className={`text-xs mt-1 ${msg.isSent ? 'text-blue-100' : 'text-gray-500'}`}
              >
                {msg.status === 'pending'
                  ? 'Sending...'
                  : msg.isSent
                  ? 'Sent'
                  : 'Received'}
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
      <form
        id="chatform"
        className="bg-white p-4 flex shadow-md"
        onSubmit={handleSendMessage}
      >
        <input
          id="messagebox"
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
    </div>
  );
};

export default ChatPage;
