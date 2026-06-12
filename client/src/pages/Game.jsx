import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core';
import { useGame } from '../hooks/useGame.jsx';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { playTrack, getDevices } from '../lib/spotify.js';
import NowPlaying from '../components/NowPlaying.jsx';
import Timeline from '../components/Timeline.jsx';
import PlayerList from '../components/PlayerList.jsx';
import RevealResult from '../components/RevealResult.jsx';

export default function Game() {
  useParams();
  const {
    gameState,
    mySocketId,
    myPlayer,
    isMyTurn,
    isHost,
    revealData,
    gameOver,
    error,
    placeCard,
    reveal,
    nextTurn,
  } = useGame();
  const { getToken } = useSpotify();
  const navigate = useNavigate();

  const [countdown, setCountdown] = useState(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const phase = gameState?.phase;
  const trackId = gameState?.currentCard?.trackId;

  // Auto-play the mystery track on this client's own Spotify device each new card
  useEffect(() => {
    const uri = gameState?.currentCard?.uri;
    if (!uri || phase === 'revealing') return;
    (async () => {
      try {
        const token = await getToken();
        const devices = await getDevices(token);
        const active = devices.find((d) => d.is_active) || devices[0];
        if (active) await playTrack(uri, token, active.id);
      } catch {}
    })();
  }, [trackId]);

  // After a reveal, auto-advance to the next turn with a 3..2..1 countdown.
  // The host fires the actual advance so it only happens once.
  useEffect(() => {
    if (phase !== 'revealing') {
      setCountdown(null);
      return;
    }
    setCountdown(3);
    const tick = setInterval(() => {
      setCountdown((c) => (c > 1 ? c - 1 : 0));
    }, 1000);
    const advance = isHost ? setTimeout(() => nextTurn(), 3000) : null;
    return () => {
      clearInterval(tick);
      if (advance) clearTimeout(advance);
    };
  }, [phase, trackId, isHost]);

  const handleDragEnd = ({ over }) => {
    if (over && typeof over.id === 'string' && over.id.startsWith('slot-')) {
      placeCard(parseInt(over.id.slice(5), 10));
    }
  };

  if (gameOver) {
    const winner = gameState?.players.find((p) => p.id === gameOver.id) || gameOver;
    const isWinner = gameOver.id === mySocketId;
    return (
      <div className="min-h-screen bg-hitster-dark flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="text-6xl">{isWinner ? '🏆' : '🎵'}</div>
        <div>
          <p className="text-hitster-yellow font-black text-3xl">
            {isWinner ? 'You won!' : `${winner.name} wins!`}
          </p>
          <p className="text-white/50 mt-2">{winner.timeline?.length} songs on their timeline</p>
        </div>
        <div className="space-y-2 w-full max-w-xs">
          {gameState?.players
            .slice()
            .sort((a, b) => b.timeline.length - a.timeline.length)
            .map((p) => (
              <div key={p.id} className="flex justify-between bg-white/5 rounded-xl px-4 py-3">
                <span>{p.name}</span>
                <span className="text-hitster-yellow font-bold">{p.timeline.length} cards</span>
              </div>
            ))}
        </div>
        <button
          onClick={() => navigate('/')}
          className="bg-hitster-yellow text-black font-bold py-4 px-8 rounded-2xl text-lg"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-hitster-dark">
        <div className="w-10 h-10 border-4 border-hitster-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { currentCard, currentPlayerId, activePlayerPlacement, players } = gameState;
  const activePlayer = players.find((p) => p.id === currentPlayerId);
  const myTimeline = myPlayer?.timeline || [];
  const isRevealing = phase === 'revealing';
  const isPlaced = phase === 'placed';

  return (
    <div className="min-h-screen bg-hitster-dark flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {error && (
          <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}

        {/* Players row */}
        <PlayerList players={players} currentPlayerId={currentPlayerId} myId={mySocketId} />

        {/* Mystery song now playing */}
        {currentCard && !isRevealing && <NowPlaying card={currentCard} />}

        {/* Reveal result */}
        {isRevealing && revealData && (
          <RevealResult revealData={revealData} playerName={activePlayer?.name} isMe={isMyTurn} />
        )}

        {/* ACTIVE PLAYER: drag the song onto your own timeline */}
        {isMyTurn && !isRevealing && (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
              <p className="text-white/50 text-xs uppercase tracking-wider">
                {isPlaced ? 'Locked in — tap Reveal Year when ready' : 'Drag the song into your timeline (or tap a slot)'}
              </p>
              {!isPlaced && <DraggableSong />}
              <Timeline
                timeline={myTimeline}
                placing={!isPlaced}
                onPlace={placeCard}
                selectedPosition={isPlaced ? activePlayerPlacement : null}
              />
            </div>
          </DndContext>
        )}

        {/* OTHER PLAYERS: watch the active player's timeline */}
        {!isMyTurn && !isRevealing && activePlayer && (
          <div className="space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-wider">
              {activePlayer.name}'s timeline
            </p>
            <Timeline
              timeline={activePlayer.timeline}
              selectedPosition={isPlaced ? activePlayerPlacement : null}
            />
          </div>
        )}

        {/* Your own timeline (shown below when it's not your turn) */}
        {!isMyTurn && !isRevealing && myTimeline.length > 0 && (
          <div className="space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-wider">Your timeline</p>
            <Timeline timeline={myTimeline} />
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-hitster-dark border-t border-white/10 p-4 safe-bottom">
        {isMyTurn && isPlaced && !isRevealing && (
          <button
            onClick={reveal}
            className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg active:opacity-80"
          >
            Reveal Year
          </button>
        )}

        {isRevealing && (
          <p className="text-center text-white/60 text-sm py-3">
            Next round in <span className="text-hitster-yellow font-bold text-lg">{countdown ?? 3}</span>…
          </p>
        )}

        {isMyTurn && phase === 'playing' && (
          <p className="text-center text-white/40 text-sm py-3">
            Drag the song onto your timeline
          </p>
        )}

        {!isMyTurn && !isRevealing && (
          <p className="text-center text-white/40 text-sm py-3">{activePlayer?.name}'s turn</p>
        )}
      </div>
    </div>
  );
}

function DraggableSong() {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'mystery-song',
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`w-28 h-28 mx-auto rounded-xl border-2 border-hitster-yellow bg-hitster-yellow/15 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'opacity-80 shadow-2xl' : ''
      }`}
    >
      <span className="text-4xl text-hitster-yellow font-black leading-none">?</span>
      <span className="text-hitster-yellow text-[11px] mt-1 font-semibold">Drag me</span>
    </div>
  );
}
