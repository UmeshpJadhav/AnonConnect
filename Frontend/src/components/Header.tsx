//mport React from 'react';
interface HeaderProps {
  onVideoCallClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onVideoCallClick }) => {
  return (
    <header className="bg-white shadow p-4 flex justify-between items-center">
      <h1 className="text-xl font-bold">Chat</h1>
      <button 
        id="video-call-btn" 
        className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
        onClick={onVideoCallClick}
      >
        Video Call
      </button>
    </header>
  );
};

export default Header;