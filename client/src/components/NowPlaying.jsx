import { useState } from 'react';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { playTrack, pausePlayback, getDevices } from '../lib/spotify.js';

// The mystery song that's currently playing — no details shown, only audio.
export default function NowPlaying({ card }) {
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
    <div className="bg-hitster-card rounded-2xl p-4 space-y-3 border border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-hitster-yellow/15 border border-hitster-yellow/40 flex items-center justify-center text-3xl text-hitster-yellow font-black">
          ?
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Mystery song</p>
          <p className="text-white/50 text-xs">Listen and guess when it came out</p>
        </div>
      </div>

      {deviceError && (
        <p className="text-hitster-accent text-xs">
          Open the Spotify app on your device first, then tap play.
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
            <span className="text-lg">▶</span> Replay song
          </>
        )}
      </button>
    </div>
  );
}
