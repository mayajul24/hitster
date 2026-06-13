import { useState } from 'react';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { playTrack, pausePlayback, getDevices } from '../lib/spotify.js';

// The hidden mystery song as a small card. When drag props are passed
// (active player's turn) the card itself is the draggable element; the
// replay button below it is a separate control.
export default function NowPlaying({
  card,
  compact = false,
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
    <div className="flex flex-col items-center gap-2">
      {!compact && (
        <div
          ref={dragRef}
          style={dragStyle}
          {...dragListeners}
          {...dragAttributes}
          className={`w-24 h-28 rounded-xl border-2 flex flex-col items-center justify-center gap-1 select-none ${
            draggable
              ? 'border-hitster-yellow bg-hitster-yellow/15 cursor-grab active:cursor-grabbing touch-none'
              : 'border-white/15 bg-hitster-card'
          } ${isDragging ? 'opacity-80 shadow-2xl' : ''}`}
        >
          <span className="text-4xl text-hitster-yellow font-black leading-none">?</span>
          <span className="text-white/50 text-[10px] font-semibold">
            {draggable ? 'Drag me' : 'Mystery'}
          </span>
        </div>
      )}

      <button
        onClick={playing ? handlePause : handlePlay}
        disabled={loading}
        className="px-4 py-1.5 rounded-full bg-[#1DB954] text-black text-xs font-bold flex items-center gap-1.5 active:opacity-80 disabled:opacity-50"
      >
        {loading ? (
          <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="text-sm leading-none">{playing ? '⏸' : '▶'}</span>
        )}
        {playing ? 'Pause' : 'Replay'}
      </button>

      {deviceError && (
        <p className="text-hitster-accent text-[11px] text-center max-w-[12rem]">
          Open the Spotify app on your device first, then tap ▶.
        </p>
      )}
    </div>
  );
}
