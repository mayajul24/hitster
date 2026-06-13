import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  pointerWithin,
} from '@dnd-kit/core';
import { useGame } from '../hooks/useGame.jsx';
import { useSpotify } from '../hooks/useSpotify.jsx';
import { playTrack, pausePlayback, getDevices } from '../lib/spotify.js';
import NowPlaying from '../components/NowPlaying.jsx';
import Timeline from '../components/Timeline.jsx';
import PlayerList from '../components/PlayerList.jsx';
import RevealResult from '../components/RevealResult.jsx';

const range = (n) => Array.from({ length: n }, (_, i) => i);

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
    lockPlacement,
    skipCard,
    placeChallenge,
    nextTurn,
  } = useGame();
  const { getToken } = useSpotify();
  const navigate = useNavigate();

  const [challengeSecs, setChallengeSecs] = useState(0);
  const [myPlacement, setMyPlacement] = useState(null); // tentative slot before locking
  const [guessName, setGuessName] = useState('');
  const [guessArtist, setGuessArtist] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const phase = gameState?.phase;
  const trackId = gameState?.currentCard?.trackId;
  const challengeDeadline = gameState?.challengeDeadline;

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

  // Reset per-card local state
  useEffect(() => {
    setMyPlacement(null);
    setGuessName('');
    setGuessArtist('');
  }, [trackId]);

  // Challenge-window countdown (display only — the server triggers the reveal)
  useEffect(() => {
    if (phase !== 'placed' || !challengeDeadline) {
      setChallengeSecs(0);
      return;
    }
    const update = () =>
      setChallengeSecs(Math.max(0, Math.ceil((challengeDeadline - Date.now()) / 1000)));
    update();
    const iv = setInterval(update, 250);
    return () => clearInterval(iv);
  }, [phase, challengeDeadline]);

  // Stop Spotify when the game ends
  useEffect(() => {
    if (!gameOver) return;
    (async () => {
      try {
        await pausePlayback(await getToken());
      } catch {}
    })();
  }, [gameOver]);

  if (gameOver) {
    const abandoned = gameOver.reason === 'abandoned';
    const winner = gameState?.players.find((p) => p.id === gameOver.id) || gameOver;
    const isWinner = !abandoned && gameOver.id === mySocketId;
    return (
      <div className="min-h-screen bg-hitster-dark flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="text-6xl">{abandoned ? '🛑' : isWinner ? '🏆' : '🎵'}</div>
        <div>
          <p className="text-hitster-yellow font-black text-3xl">
            {abandoned ? 'Game stopped' : isWinner ? 'You won!' : `${winner.name} wins!`}
          </p>
          <p className="text-white/50 mt-2">
            {abandoned
              ? 'A player left — not enough players to continue.'
              : `${winner.timeline?.length} songs on their timeline`}
          </p>
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

  const { currentCard, currentPlayerId, activePlayerPlacement, challenges = {}, players } = gameState;
  const activePlayer = players.find((p) => p.id === currentPlayerId);
  const isRevealing = phase === 'revealing';
  const isPlaced = phase === 'placed';
  const isPlaying = phase === 'playing';

  const myChallenge = challenges[mySocketId];
  const canChallenge =
    !isMyTurn && isPlaced && challengeSecs > 0 && (myPlayer?.tokens ?? 0) > 0 && !myChallenge;
  const iAmDragger = (isMyTurn && isPlaying) || canChallenge;

  const challengerMarkers = Object.entries(challenges).map(([pid, ch]) => ({
    position: ch.position,
    kind: pid === mySocketId ? 'me' : 'other',
    label: pid === mySocketId ? 'You' : players.find((p) => p.id === pid)?.name || '?',
  }));

  const handleDragEnd = ({ over }) => {
    if (!over || typeof over.id !== 'string' || !over.id.startsWith('slot-')) return;
    const pos = parseInt(over.id.slice(5), 10);
    if (isMyTurn && isPlaying) setMyPlacement(pos);
    else if (canChallenge) placeChallenge(pos);
  };

  const lockIn = () => {
    if (myPlacement == null) return;
    lockPlacement(myPlacement, { name: guessName, artist: guessArtist });
  };

  const timelineProps = (p) => {
    const isActiveP = p.id === currentPlayerId;
    if (isMyTurn && isActiveP && isPlaying) {
      return {
        onPlace: (pos) => setMyPlacement(pos),
        droppablePositions: range(p.timeline.length + 1).filter((s) => s !== myPlacement),
        markers: myPlacement != null ? [{ position: myPlacement, kind: 'mystery', label: 'Here' }] : [],
      };
    }
    if (isActiveP && isPlaced) {
      const markers = [
        { position: activePlayerPlacement, kind: 'active', label: isMyTurn ? 'You' : 'Their guess' },
        ...challengerMarkers,
      ];
      if (canChallenge) {
        return {
          onPlace: (pos) => placeChallenge(pos),
          droppablePositions: range(p.timeline.length + 1).filter((s) => s !== activePlayerPlacement),
          markers,
        };
      }
      return { markers };
    }
    return {};
  };

  const statusText = () => {
    if (isRevealing) return null;
    if (isPlaying)
      return isMyTurn
        ? 'Your turn — drag the song onto your timeline, take your time, then lock it in.'
        : `${activePlayer?.name} is placing the song…`;
    if (isPlaced) {
      if (isMyTurn) return `Locked! Others can challenge — revealing in ${challengeSecs}s`;
      if (canChallenge) return `Challenge! Drag onto a different spot — ${challengeSecs}s`;
      if (myChallenge) return `Challenge placed — revealing in ${challengeSecs}s`;
      return `${activePlayer?.name} locked their guess — revealing in ${challengeSecs}s`;
    }
    return null;
  };

  const renderBlock = (p) => {
    const isActiveP = p.id === currentPlayerId;
    const props = timelineProps(p);
    const mysteryHere =
      !isRevealing &&
      currentCard &&
      iAmDragger &&
      ((isMyTurn && isActiveP && isPlaying) || (canChallenge && isActiveP));
    return (
      <div key={p.id} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${isActiveP ? 'text-hitster-yellow' : 'text-white'}`}>
            {p.id === mySocketId ? 'You' : p.name}
          </span>
          {isActiveP && (
            <span className="text-[10px] bg-hitster-yellow text-black px-1.5 py-0.5 rounded-full font-bold">
              TURN
            </span>
          )}
          <span className="text-white/30 text-xs flex items-center gap-1">
            {p.timeline.length} cards
            <span className="w-2 h-2 rounded-full bg-hitster-yellow inline-block ml-1" />
            {p.tokens}
          </span>
        </div>
        {mysteryHere && <DraggableMystery card={currentCard} />}
        <Timeline timeline={p.timeline} {...props} />

        {isMyTurn && isActiveP && isPlaying && (
          <div className="space-y-2 pt-1">
            <p className="text-white/40 text-xs">Bonus — name the song &amp; artist for a token</p>
            <input
              value={guessName}
              onChange={(e) => setGuessName(e.target.value)}
              placeholder="Song name"
              className="w-full bg-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-hitster-yellow"
            />
            <input
              value={guessArtist}
              onChange={(e) => setGuessArtist(e.target.value)}
              placeholder="Artist"
              className="w-full bg-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/30 text-sm outline-none focus:ring-2 focus:ring-hitster-yellow"
            />
            <button
              onClick={skipCard}
              disabled={(myPlayer?.tokens ?? 0) <= 0}
              className="w-full bg-white/10 text-white/80 text-sm font-semibold py-2.5 rounded-xl active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              Skip this song
              <span className="w-2.5 h-2.5 rounded-full bg-hitster-yellow inline-block" />
              <span className="text-white/50">1 token · {myPlayer?.tokens ?? 0} left</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-hitster-dark flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {error && (
          <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}

        <PlayerList players={players} currentPlayerId={currentPlayerId} myId={mySocketId} />

        {/* Audio control for players who aren't currently dragging the mystery */}
        {currentCard && !isRevealing && !iAmDragger && <NowPlaying card={currentCard} />}

        {!isRevealing && (
          <p className="text-white/60 text-sm text-center">{statusText()}</p>
        )}

        {isRevealing && revealData && (
          <RevealResult revealData={revealData} players={players} />
        )}

        {/* All players' timelines, always visible */}
        {!isRevealing ? (
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
            <div className="space-y-4">{players.map(renderBlock)}</div>
          </DndContext>
        ) : (
          <div className="space-y-4">{players.map(renderBlock)}</div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-hitster-dark border-t border-white/10 p-4 safe-bottom">
        {isRevealing && (isMyTurn || isHost) && (
          <button
            onClick={nextTurn}
            className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg active:opacity-80"
          >
            Next Turn
          </button>
        )}

        {isRevealing && !isMyTurn && !isHost && (
          <p className="text-center text-white/40 text-sm py-3">Waiting for next turn…</p>
        )}

        {!isRevealing && isMyTurn && isPlaying && (
          <button
            onClick={lockIn}
            disabled={myPlacement == null}
            className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg active:opacity-80 disabled:opacity-40"
          >
            {myPlacement == null ? 'Place the song first' : 'Lock it in'}
          </button>
        )}

        {!isRevealing && isPlaced && (
          <p className="text-center text-white/60 text-sm py-3">
            Revealing in <span className="text-hitster-yellow font-bold text-lg">{challengeSecs}</span>s
          </p>
        )}

        {!isRevealing && !isMyTurn && isPlaying && (
          <p className="text-center text-white/40 text-sm py-3">{activePlayer?.name}'s turn</p>
        )}
      </div>
    </div>
  );
}

function DraggableMystery({ card }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'mystery-song',
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;
  return (
    <NowPlaying
      card={card}
      dragRef={setNodeRef}
      dragListeners={listeners}
      dragAttributes={attributes}
      dragStyle={style}
      isDragging={isDragging}
    />
  );
}
