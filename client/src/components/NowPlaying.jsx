import { useState } from 'react';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { playTrack, pausePlayback, getDevices } from '../lib/spotify.js';

// Slim now-playing bar for the hidden mystery song.
// When drag props are passed (active player's turn) the whole bar becomes the
// draggable element; the play button stays a normal click (it stops the drag).
export default function NowPlaying({
  card,
  dragRef,
  dragListeners,
  dragAttributes,
  dragStyle,
  isDragging,
}) {
  const { getToken } = useSpotify();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceError, setDeviceError] = useState(false);
  const draggable = !!dragRef;

  const handlePlay = async () => {
    if (!card?.uri) return;
    setLoading(true);
    setDeviceError(false);
    try {
      const token = await getToken();
      const devices = await getDevices(token);
      const active = devices.find((d) => d.is_active) || devices[0];
      if (!active) {
        setDeviceError(true);
        return;
      }
      await playTrack(card.uri, token, active.id);
      setPlaying(true);
    } catch (e) {
      if (e.message?.includes('No active device') || e.status === 404) setDeviceError(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      const token = await getToken();
      await pausePlayback(token);
      setPlaying(false);
    } catch {}
  };

  return (
    <div className="space-y-1">
      <div
        ref={dragRef}
        style={dragStyle}
        {...dragListeners}
        {...dragAttributes}
        className={`flex items-center gap-3 rounded-full pl-2 pr-4 py-2 border ${
          draggable
            ? 'bg-hitster-yellow/15 border-hitster-yellow cursor-grab active:cursor-grabbing touch-none select-none'
            : 'bg-white/5 border-white/10'
        } ${isDragging ? 'opacity-80 shadow-2xl' : ''}`}
      >
        <button
          onClick={playing ? handlePause : handlePlay}
          onPointerDown={(e) => e.stopPropagation()}
          disabled={loading}
          aria-label={playing ? 'Pause' : 'Play'}
          className="w-10 h-10 rounded-full bg-[#1DB954] text-black flex items-center justify-center flex-shrink-0 active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-lg leading-none">{playing ? '⏸' : '▶'}</span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Mystery song</p>
          <p className="text-white/40 text-xs leading-tight">
            {draggable ? 'Drag me onto your timeline' : 'Listen & place it — tap to replay'}
          </p>
        </div>
        {draggable && <span className="text-hitster-yellow text-xl flex-shrink-0 leading-none">⤢</span>}
      </div>
      {deviceError && (
        <p className="text-hitster-accent text-xs px-3">
          Open the Spotify app on your device first, then tap play.
        </p>
      )}
    </div>
  );
}
