import React from 'react';
import { useNavigate } from 'react-router-dom';

interface NavbarProps {
  roomName: string;
  roomId: string | undefined;
  onAddUserClick: () => void;
  onUserClick: (userId: string) => void;
  users: { uid: string; uname?: string }[]; // Хэрэглэгчдийн жагсаалт
}

export default function Navbar({ roomName, roomId, onAddUserClick, onUserClick, users }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        backgroundColor: '#2c2625',
        borderBottom: '1px solid #ddd',
        color: '#fff',
        fontWeight: 600,
        fontSize: '18px',
      }}
    >
      {/* Зүүн хэсэг: Room нэр */}
      <div>💬 Room: {roomName || 'Unknown'}</div>

      {/* Дунд хэсэг: Хүн нэмэх товч */}
      <button
        onClick={onAddUserClick}
        style={{
          backgroundColor: '#3d5afe',
          border: 'none',
          borderRadius: '8px',
          color: 'white',
          padding: '8px 14px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        Хүн нэмэх
      </button>

      {/* Баруун хэсэг: Хэрэглэгчдийн нэр, дарвал тухайн хүний room/join/[roomid] руу очно */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {users.length === 0 && <div style={{ color: '#aaa' }}>Хэрэглэгч алга</div>}
        {users.map((user) => (
          <div
            key={user.uid}
            onClick={() => {
              if (roomId) navigate(`/room/join/${roomId}?user=${user.uid}`);
            }}
            style={{
              cursor: 'pointer',
              backgroundColor: '#433c3b',
              padding: '6px 10px',
              borderRadius: '12px',
              fontSize: '14px',
              color: '#d0d0ff',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
            title={user.uname || user.uid}
          >
            {user.uname || user.uid.slice(0, 6)}
          </div>
        ))}
      </div>
    </nav>
  );
}
