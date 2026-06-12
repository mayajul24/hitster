import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SpotifyProvider } from './hooks/useSpotify.jsx';
import { GameProvider } from './hooks/useGame.jsx';
import Home from './pages/Home.jsx';
import Callback from './pages/Callback.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';

export default function App() {
  return (
    <SpotifyProvider>
      <GameProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/lobby/:roomCode" element={<Lobby />} />
            <Route path="/game/:roomCode" element={<Game />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </GameProvider>
    </SpotifyProvider>
  );
}
