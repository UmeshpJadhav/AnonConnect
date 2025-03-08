import React, { useEffect } from 'react';

const VideoCall: React.FC = () => {
  useEffect(() => {
    window.location.href = 'https://webrtc-leg5.onrender.com';
  }, []);

  return <div>Redirecting to video call system...</div>;
};

export default VideoCall;
