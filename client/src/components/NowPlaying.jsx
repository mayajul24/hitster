import { useState } from 'react';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { playTrack, pausePlayback, getDevices } from '../lib/spotify.js';

export default function NowPlaying({ card, isMyTurn }) {
  const { getToken } = useSpotify();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceError, setDeviceError] = useState(false);

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
      if (e.message?.includes('No active device') || e.message?.includes('404')) {
        setDeviceError(true);
      }
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
    <div className="bg-white/5 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        {card?.albumArt && (
          <img src={card.albumArt} className="w-14 h-14 rounded-xl object-cover" alt="" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{card?.trackName}</p>
          <p className="text-white/50 text-xs truncate">{card?.artist}</p>
          <p className="text-white/30 text-xs mt-0.5">Year hidden until reveal</p>
        </div>
      </div>

      {deviceError && (
        <p className="text-hitster-accent text-xs">
          Open the Spotify app on your device first, then try again.
        </p>
      )}

      <button
        onClick={playing ? handlePause : handlePlay}
        disabled={loading}
        className="w-full bg-[#1DB954] text-black font-bold py-3 rounded-xl text-sm active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : playing ? (
          <>
            <span className="text-lg">⏸</span> Pause
          </>
        ) : (
          <>
            <span className="text-lg">▶</span> Play on Spotify
          </>
        )}
      </button>
    </div>
  );
}
