import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { useGame } from '../hooks/useGame.jsx';
import { initiateLogin } from '../lib/spotify.js';

export default function Home() {
  const { isLoggedIn, user, authError, logout } = useSpotify();
  const { createRoom, joinRoom, roomCode, error } = useGame();
  const navigate = useNavigate();

  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [joinCode, setJoinCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.display_name && !playerName) setPlayerName(user.display_name);
  }, [user]);

  useEffect(() => {
    if (roomCode) navigate(`/lobby/${roomCode}`);
  }, [roomCode]);

  const handleAction = (action) => {
    if (!isLoggedIn) {
      sessionStorage.setItem('pending_action', JSON.stringify({ action, joinCode }));
      initiateLogin();
      return;
    }
    if (!user) return;
    setLoading(true);
    const name = playerName.trim() || user?.display_name || 'Player';
    if (action === 'create') {
      createRoom(name, user.id);
    } else {
      joinRoom(joinCode.toUpperCase(), name, user.id);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-hitster-dark flex flex-col items-center justify-center p-6">
      {/* Glowing gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-hitster-accent/25 blur-3xl animate-blob" />
        <div
          className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-[#1DB954]/20 blur-3xl animate-blob"
          style={{ animationDelay: '4s' }}
        />
        <div
          className="absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-hitster-yellow/15 blur-3xl animate-blob"
          style={{ animationDelay: '8s' }}
        />
        {/* Floating notes */}
        {['♪', '♫', '♩', '♬', '♪', '♫'].map((n, i) => (
          <span
            key={i}
            className="float-note absolute text-white/10 select-none"
            style={{
              left: `${8 + i * 16}%`,
              bottom: '8%',
              fontSize: `${20 + (i % 3) * 10}px`,
              animationDuration: `${7 + i * 1.5}s`,
              animationDelay: `${i * 1.3}s`,
            }}
          >
            {n}
          </span>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-7">
        {/* Logo */}
        <div className="text-center space-y-4">
          {/* Spinning vinyl */}
          <div className="relative w-24 h-24 mx-auto">
            <div
              className="absolute inset-0 rounded-full animate-spin-slow shadow-2xl shadow-black/50 border border-white/10"
              style={{
                backgroundImage:
                  'repeating-radial-gradient(circle at center, #0a0a12 0 3px, #20203a 3px 5px)',
              }}
            >
              <div className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-hitster-yellow flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-hitster-dark" />
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-6xl font-black tracking-tight bg-gradient-to-r from-hitster-yellow via-amber-300 to-hitster-yellow bg-clip-text text-transparent">
              HITSTER
            </h1>
            {/* Equalizer */}
            <div className="flex items-end justify-center gap-1 h-6 mt-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  className="eq-bar w-1.5 h-full rounded-full bg-gradient-to-t from-hitster-accent to-hitster-yellow"
                  style={{
                    animationDelay: `${i * 0.11}s`,
                    animationDuration: `${0.7 + (i % 3) * 0.25}s`,
                  }}
                />
              ))}
            </div>
            <p className="text-white/50 mt-3 text-sm">Hear a song · guess the year · build your timeline</p>
          </div>
        </div>

        {error && (
          <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}

        {/* Controls card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-2xl shadow-black/30">
          {authError ? (
            <div className="space-y-4">
              <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-4 text-center">
                {authError}
              </div>
              <button
                onClick={() => {
                  logout();
                  initiateLogin();
                }}
                className="w-full bg-[#1DB954] text-black font-bold py-4 rounded-2xl text-lg active:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <SpotifyIcon /> Log in again
              </button>
            </div>
          ) : !isLoggedIn ? (
            <div className="space-y-4">
              <p className="text-white/70 text-center text-sm">
                Connect your Spotify Premium account to play
              </p>
              <button
                onClick={() => initiateLogin()}
                className="w-full bg-[#1DB954] text-black font-bold py-4 rounded-2xl text-lg active:opacity-80 transition-opacity flex items-center justify-center gap-2"
              >
                <SpotifyIcon /> Continue with Spotify
              </button>
            </div>
          ) : !user ? (
            <div className="text-center text-white/60 text-sm py-8">
              <div className="w-8 h-8 border-4 border-hitster-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading your Spotify profile…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3">
                {user?.images?.[0]?.url ? (
                  <img src={user.images[0].url} className="w-10 h-10 rounded-full" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-hitster-yellow/20 flex items-center justify-center text-hitster-yellow font-bold">
                    {user?.display_name?.[0]?.toUpperCase() || '♪'}
                  </div>
                )}
                <div>
                  <p className="text-xs text-white/50">Logged in as</p>
                  <p className="font-semibold">{user?.display_name}</p>
                </div>
              </div>

              <input
                className="w-full bg-white/10 rounded-2xl p-4 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-hitster-yellow"
                placeholder="Your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
              />

              {mode === null && (
                <div className="space-y-3">
                  <button
                    disabled={!playerName.trim() || loading}
                    onClick={() => handleAction('create')}
                    className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50 active:opacity-80"
                  >
                    {loading ? 'Creating…' : 'Create Room'}
                  </button>
                  <button
                    onClick={() => setMode('join')}
                    className="w-full bg-white/10 text-white font-bold py-4 rounded-2xl text-lg active:opacity-80"
                  >
                    Join Room
                  </button>
                </div>
              )}

              {mode === 'join' && (
                <div className="space-y-3">
                  <input
                    className="w-full bg-white/10 rounded-2xl p-4 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-hitster-yellow text-center text-2xl font-bold tracking-widest uppercase"
                    placeholder="ROOM CODE"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={4}
                  />
                  <button
                    disabled={joinCode.length !== 4 || !playerName.trim() || loading}
                    onClick={() => handleAction('join')}
                    className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-50 active:opacity-80"
                  >
                    {loading ? 'Joining…' : 'Join Room'}
                  </button>
                  <button onClick={() => setMode(null)} className="w-full text-white/50 py-2 text-sm">
                    Back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.33a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.36.22.47.68.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.16-2.56-11.98-1.4a.94.94 0 1 1-.55-1.8c4.37-1.33 9.8-.68 13.51 1.6.44.27.58.85.31 1.29zm.13-3.4C15.32 8.4 8.75 8.18 4.99 9.32a1.13 1.13 0 1 1-.66-2.16c4.32-1.31 11.57-1.06 16.13 1.65a1.13 1.13 0 0 1-1.16 1.94z" />
    </svg>
  );
}
