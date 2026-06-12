import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { useGame } from '../hooks/useGame.jsx';
import { exchangeCode } from '../lib/spotify.js';

export default function Callback() {
  const { saveTokens } = useSpotify();
  const { createRoom, joinRoom } = useGame();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam || !code) {
      navigate('/');
      return;
    }

    exchangeCode(code)
      .then((tokens) => {
        saveTokens(tokens);
        // Resume pending action if any
        const pending = sessionStorage.getItem('pending_action');
        if (pending) {
          sessionStorage.removeItem('pending_action');
          // Navigate home to handle the action with the now-logged-in state
        }
        navigate('/');
      })
      .catch(() => navigate('/'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-hitster-dark">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-hitster-yellow border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-white/70">Connecting to Spotify...</p>
      </div>
    </div>
  );
}
