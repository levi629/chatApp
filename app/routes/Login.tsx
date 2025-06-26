import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supanbase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Имэйл болон нууц үгээ оруулна уу');
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message);
      return;
    }
    navigate('/');
  };

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '5rem auto',
        padding: '2rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        borderRadius: '12px',
        backgroundColor: '#fff',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          marginBottom: '1.5rem',
          color: '#333',
          fontWeight: '700',
          fontSize: '1.8rem',
        }}
      >
        Нэвтрэх
      </h2>

      <input
        type="email"
        placeholder="Имэйл"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          marginBottom: '1rem',
          borderRadius: '8px',
          border: '1.5px solid #ddd',
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color 0.3s',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#3d5afe')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#ddd')}
      />

      <input
        type="password"
        placeholder="Нууц үг"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{
          width: '100%',
          padding: '12px 16px',
          marginBottom: '1.5rem',
          borderRadius: '8px',
          border: '1.5px solid #ddd',
          fontSize: '1rem',
          outline: 'none',
          transition: 'border-color 0.3s',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#3d5afe')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#ddd')}
      />

      <button
        onClick={handleLogin}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#3d5afe',
          color: 'white',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: 'pointer',
          transition: 'background-color 0.3s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2f43d6')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3d5afe')}
      >
        Нэвтрэх
      </button>
    </div>
  );
}
