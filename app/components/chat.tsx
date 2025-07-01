import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supanbase';
import Navbar from './navbar';

interface Message {
  chid: number;
  chtext: string;
  chdate: string;
  uid: string;
}

interface User {
  uid: string;
  uname?: string;
}

export default function Chat() {
  const { rid } = useParams();
  const [roomName, setRoomName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Доошоо автоматаар скролл хийх
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!rid) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });

    // Room-н нэр авах
    supabase.from('t_rooms').select('rname').eq('rid', rid).single().then(({ data }) => {
      if (data) setRoomName(data.rname);
    });

    // Room-д холбогдсон хэрэглэгчид авах (жишээ)
    fetchRoomUsers();

    // Мессежүүд татах
    fetchMessages();

    // Realtime subscribe
    const channel = supabase
      .channel(`room_chats_${rid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 't_chats',
          filter: `rid=eq.${rid}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rid]);

  async function fetchMessages() {
    const { data, error } = await supabase
      .from('t_chats')
      .select('*')
      .eq('rid', rid)
      .order('chdate', { ascending: true });

    if (error) console.error(error);
    if (data) setMessages(data);
  }

  // Жишээ - Room-д холбогдсон хэрэглэгчдийг авах
  async function fetchRoomUsers() {
    if (!rid) return;

    // Алхам 1: t_rooms_users-ээс uid жагсаах
    const { data: roomUsers, error } = await supabase
      .from('t_rooms_users')
      .select('uid')
      .eq('rid', rid);

    if (error) {
      console.error('Room хэрэглэгчдийг авахад алдаа:', error.message);
      return;
    }

    console.log('roomUsers:', roomUsers);

    if (roomUsers && roomUsers.length > 0) {
      const userIds = roomUsers.map((ru) => ru.uid);

      // Алхам 2: t_users-оос uname авах
      const { data: usersData, error: usersError } = await supabase
        .from('t_users')
        .select('uid, uname')
        .in('uid', userIds);

      if (usersError) {
        console.error('t_users авахад алдаа:', usersError.message);
        return;
      }

      console.log('usersData:', usersData);
      setUsers(usersData || []);
    } else {
      setUsers([]);
    }
  }


  async function sendMessage() {
    if (!newMessage.trim() || !userId || !rid) return;

    const { error } = await supabase.from('t_chats').insert([
      {
        chtext: newMessage.trim(),
        chdate: new Date().toISOString(),
        uid: userId,
        rid,
      },
    ]);

    if (error) {
      alert('Мессеж илгээхэд алдаа гарлаа: ' + error.message);
      return;
    }

    setNewMessage('');
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#f4f6fb',
      }}
    >
      {/* Тусдаа Navbar компонент дуудаж байна */}
      <Navbar
        roomName={roomName}
        roomId={rid}
        onAddUserClick={() => alert('Хүн нэмэхийг энд хэрэгжүүлнэ үү')}
        onUserClick={(uid) => alert('User clicked: ' + uid)}
        users={users}
      />

      {/* Messages */}
      <div
        style={{
          flex: 1,
          padding: '1.5rem',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          backgroundColor: '#433c3b',
        }}
      >
      {messages.map((msg) => {
        const isMine = msg.uid === userId;
        const sender = users.find((u) => u.uid === msg.uid);
        const senderName = sender?.uname || msg.uid.slice(0, 6);

        return (
          <div
            key={msg.chid}
            style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              backgroundColor: isMine ? '#3d5afe' : '#ffffff',
              color: isMine ? '#fff' : '#333',
              padding: '12px 16px',
              borderRadius: '18px',
              maxWidth: '70%',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              position: 'relative',
              wordBreak: 'break-word',
            }}
          >
            {!isMine && (
              <div
                style={{
                  fontSize: '13px',
                  color: '#888',
                  marginBottom: '4px',
                  fontWeight: 600,
                }}
              >
                {senderName}
              </div>
            )}
            <div>{msg.chtext}</div>
            <div
              style={{
                fontSize: '11px',
                color: isMine ? '#d0dfff' : '#999',
                marginTop: '6px',
                textAlign: 'right',
              }}
            >
              {new Date(msg.chdate).toLocaleTimeString()}
            </div>
          </div>
        );
      })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input box */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid #ddd',
          backgroundColor: '#2c2625',
          display: 'flex',
          gap: '10px',
        }}
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Мессеж бичих..."
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '20px',
            border: '1px solid #ccc',
            outline: 'none',
            fontSize: '15px',
            color: '#ccc',
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '12px 20px',
            backgroundColor: '#3d5afe',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Илгээх
        </button>
      </div>
    </div>
  );
}
