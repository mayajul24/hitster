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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-hitster-dark">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-5xl font-black text-hitster-yellow tracking-tight">HITSTER</h1>
          <p className="text-white/50 mt-2 text-sm">Music timeline game</p>
        </div>

        {error && (
          <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}

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
              className="w-full bg-[#1DB954] text-black font-bold py-4 rounded-2xl text-lg active:opacity-80 transition-opacity"
            >
              Log in again
            </button>
          </div>
        ) : !isLoggedIn ? (
          <div className="space-y-4">
            <p className="text-white/70 text-center text-sm">
              Connect your Spotify Premium account to play
            </p>
            <button
              onClick={() => initiateLogin()}
              className="w-full bg-[#1DB954] text-black font-bold py-4 rounded-2xl text-lg active:opacity-80 transition-opacity"
            >
              Login with Spotify
            </button>
          </div>
        ) : !user ? (
          <div className="text-center text-white/60 text-sm py-8">
            <div className="w-8 h-8 border-4 border-hitster-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading your Spotify profile…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-4">
              {user?.images?.[0]?.url && (
                <img src={user.images[0].url} className="w-10 h-10 rounded-full" alt="" />
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
                  {loading ? 'Creating...' : 'Create Room'}
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
                  {loading ? 'Joining...' : 'Join Room'}
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
  );
}
