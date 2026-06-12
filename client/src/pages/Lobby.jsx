import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGame } from '../hooks/useGame.jsx';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { getUserPlaylists, getPlaylistTracks } from '../lib/spotify.js';

export default function Lobby() {
  const { roomCode } = useParams();
  const { gameState, isHost, setPlaylist, startGame, error } = useGame();
  const { getToken } = useSpotify();
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);

  useEffect(() => {
    if (gameState?.phase === 'playing') {
      navigate(`/game/${roomCode}`);
    }
  }, [gameState?.phase]);

  const loadPlaylists = async () => {
    setLoadingPlaylists(true);
    setShowPlaylists(true);
    try {
      const token = await getToken();
      const data = await getUserPlaylists(token);
      setPlaylists(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const selectPlaylist = async (pl) => {
    setShowPlaylists(false);
    setSelectedPlaylist({ id: pl.id, name: pl.name, loading: true });
    setLoadingTracks(true);
    try {
      const token = await getToken();
      const tracks = await getPlaylistTracks(pl.id, token);
      setSelectedPlaylist({ id: pl.id, name: pl.name, trackCount: tracks.length });
      setPlaylist(tracks, pl.name);
    } catch (e) {
      console.error(e);
      setSelectedPlaylist(null);
    } finally {
      setLoadingTracks(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode);
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hitster-dark">
        <div className="w-10 h-10 border-4 border-hitster-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hitster-dark p-6 flex flex-col">
      <div className="max-w-sm mx-auto w-full flex-1 flex flex-col space-y-6">
        {/* Room code */}
        <div className="text-center">
          <p className="text-white/50 text-sm mb-1">Room Code</p>
          <button onClick={copyCode} className="flex items-center gap-2 mx-auto">
            <span className="text-5xl font-black text-hitster-yellow tracking-widest">{roomCode}</span>
            <span className="text-white/30 text-xs">tap to copy</span>
          </button>
        </div>

        {error && (
          <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}

        {/* Players */}
        <div className="bg-white/5 rounded-2xl p-4 space-y-3">
          <p className="text-white/50 text-xs uppercase tracking-wider">Players ({gameState.players.length})</p>
          {gameState.players.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-hitster-yellow flex items-center justify-center text-black font-bold text-sm">
                {p.name[0]?.toUpperCase()}
              </div>
              <span className="font-medium">{p.name}</span>
              {p.id === gameState.hostId && (
                <span className="ml-auto text-xs text-hitster-yellow">HOST</span>
              )}
            </div>
          ))}
          {gameState.players.length < 2 && (
            <p className="text-white/30 text-xs">Waiting for more players to join...</p>
          )}
        </div>

        {/* Host controls */}
        {isHost && (
          <div className="space-y-3">
            {!showPlaylists ? (
              <button
                onClick={loadPlaylists}
                className="w-full bg-white/10 text-white font-semibold py-4 rounded-2xl active:opacity-80"
              >
                {selectedPlaylist
                  ? `Playlist: ${selectedPlaylist.name} (${selectedPlaylist.trackCount} songs)`
                  : 'Pick Playlist'}
              </button>
            ) : (
              <div className="bg-white/5 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                {loadingPlaylists ? (
                  <div className="p-4 text-center text-white/50">Loading playlists...</div>
                ) : (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      onClick={() => selectPlaylist(pl)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/10 active:bg-white/10 border-b border-white/5 last:border-0 text-left"
                    >
                      {pl.images?.[0]?.url && (
                        <img src={pl.images[0].url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                      )}
                      <div>
                        <p className="font-medium text-sm">{pl.name}</p>
                        <p className="text-white/40 text-xs">{pl.tracks?.total} songs</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            <button
              onClick={startGame}
              disabled={!selectedPlaylist || selectedPlaylist.loading || gameState.players.length < 2}
              className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg disabled:opacity-40 active:opacity-80"
            >
              Start Game
            </button>
          </div>
        )}

        {!isHost && (
          <div className="text-center text-white/40 text-sm">
            Waiting for the host to pick a playlist and start...
          </div>
        )}
      </div>
    </div>
  );
}
