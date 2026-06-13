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
    placeCard,
    skipCard,
    placeChallenge,
    reveal,
    nextTurn,
  } = useGame();
  const { getToken } = useSpotify();
  const navigate = useNavigate();

  const [countdown, setCountdown] = useState(null);
  const [challengeSecs, setChallengeSecs] = useState(0);
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

  // Reset the bonus name/artist guess each new card
  useEffect(() => {
    setGuessName('');
    setGuessArtist('');
  }, [trackId]);

  // Countdown for the challenge window (after a placement, before reveal)
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

  // After a reveal, auto-advance to the next turn with a 3..2..1 countdown.
  useEffect(() => {
    if (phase !== 'revealing') {
      setCountdown(null);
      return;
    }
    setCountdown(3);
    const tick = setInterval(() => setCountdown((c) => (c > 1 ? c - 1 : 0)), 1000);
    const advance = isHost ? setTimeout(() => nextTurn(), 3000) : null;
    return () => {
      clearInterval(tick);
      if (advance) clearTimeout(advance);
    };
  }, [phase, trackId, isHost]);

  // Stop Spotify when the game ends
  useEffect(() => {
    if (!gameOver) return;
    (async () => {
      try {
        await pausePlayback(await getToken());
      } catch {}
    })();
  }, [gameOver]);

  const handleDragEnd = ({ over }) => {
    if (!over || typeof over.id !== 'string' || !over.id.startsWith('slot-')) return;
    const pos = parseInt(over.id.slice(5), 10);
    if (isMyTurn) placeCard(pos);
    else placeChallenge(pos);
  };

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
  const myTimeline = myPlayer?.timeline || [];
  const isRevealing = phase === 'revealing';
  const isPlaced = phase === 'placed';
  const isPlaying = phase === 'playing';

  const myChallenge = challenges[mySocketId];
  const canChallenge =
    !isMyTurn && isPlaced && challengeSecs > 0 && (myPlayer?.tokens ?? 0) > 0 && !myChallenge;

  // Markers placed on the active player's timeline (their guess + challengers)
  const challengerMarkers = Object.entries(challenges).map(([pid, ch]) => ({
    position: ch.position,
    kind: pid === mySocketId ? 'me' : 'other',
    label: pid === mySocketId ? 'You' : players.find((p) => p.id === pid)?.name || '?',
  }));

  return (
    <div className="min-h-screen bg-hitster-dark flex flex-col">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {error && (
          <div className="bg-hitster-accent/20 border border-hitster-accent text-white text-sm rounded-xl p-3 text-center">
            {error}
          </div>
        )}

        <PlayerList players={players} currentPlayerId={currentPlayerId} myId={mySocketId} />

        {/* ===== REVEAL ===== */}
        {isRevealing && revealData && (
          <>
            <RevealResult revealData={revealData} players={players} />
            {myTimeline.length > 0 && (
              <div className="space-y-2">
                <p className="text-white/50 text-xs uppercase tracking-wider">Your timeline</p>
                <Timeline timeline={myTimeline} />
              </div>
            )}
          </>
        )}

        {/* ===== ACTIVE PLAYER ===== */}
        {isMyTurn && !isRevealing && (
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
              {currentCard &&
                (isPlaying ? (
                  <DraggableMystery card={currentCard} />
                ) : (
                  <NowPlaying card={currentCard} />
                ))}
              <p className="text-white/50 text-xs uppercase tracking-wider">
                {isPlaced
                  ? challengeSecs > 0
                    ? `Locked in — others can challenge for ${challengeSecs}s`
                    : 'Locked in — tap Reveal Year'
                  : 'Drag the Mystery Song onto your timeline (or tap a slot)'}
              </p>
              <Timeline
                timeline={myTimeline}
                onPlace={isPlaying ? placeCard : undefined}
                droppablePositions={isPlaying ? range(myTimeline.length + 1) : null}
                markers={
                  isPlaced
                    ? [{ position: activePlayerPlacement, kind: 'mystery', label: 'You' }, ...challengerMarkers]
                    : []
                }
              />
              {isPlaced && (
                <div className="space-y-2">
                  <p className="text-white/50 text-xs uppercase tracking-wider">
                    Bonus — name the song &amp; artist for a token
                  </p>
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
                </div>
              )}

              {isPlaying && (
                <button
                  onClick={skipCard}
                  disabled={!myPlayer || myPlayer.tokens <= 0}
                  className="w-full bg-white/10 text-white/80 text-sm font-semibold py-2.5 rounded-xl active:opacity-80 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  Skip this song
                  <span className="w-2.5 h-2.5 rounded-full bg-hitster-yellow inline-block" />
                  <span className="text-white/50">1 token · {myPlayer?.tokens ?? 0} left</span>
                </button>
              )}
            </div>
          </DndContext>
        )}

        {/* ===== OTHER PLAYERS ===== */}
        {!isMyTurn && !isRevealing && activePlayer && (
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
            <div className="space-y-3">
              {currentCard &&
                (canChallenge ? (
                  <DraggableMystery card={currentCard} />
                ) : (
                  <NowPlaying card={currentCard} />
                ))}

              <p className="text-white/50 text-xs uppercase tracking-wider">
                {isPlaying
                  ? `${activePlayer.name} is placing the song…`
                  : canChallenge
                  ? `Challenge! Drag onto a different spot — ${challengeSecs}s`
                  : myChallenge
                  ? `Challenge placed — revealing in ${challengeSecs}s`
                  : (myPlayer?.tokens ?? 0) <= 0
                  ? `No tokens to challenge — ${challengeSecs}s`
                  : `${activePlayer.name}'s guess is locked — ${challengeSecs}s`}
              </p>

              <p className="text-white/40 text-xs">{activePlayer.name}'s timeline</p>
              <Timeline
                timeline={activePlayer.timeline}
                onPlace={canChallenge ? placeChallenge : undefined}
                droppablePositions={
                  canChallenge
                    ? range(activePlayer.timeline.length + 1).filter((p) => p !== activePlayerPlacement)
                    : null
                }
                markers={
                  isPlaced
                    ? [
                        { position: activePlayerPlacement, kind: 'active', label: 'Their guess' },
                        ...challengerMarkers,
                      ]
                    : []
                }
              />

              {myTimeline.length > 0 && (
                <div className="pt-1">
                  <p className="text-white/40 text-xs mb-1">Your timeline</p>
                  <Timeline timeline={myTimeline} />
                </div>
              )}
            </div>
          </DndContext>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-hitster-dark border-t border-white/10 p-4 safe-bottom">
        {isMyTurn && isPlaced && !isRevealing && (
          <button
            onClick={() => reveal({ name: guessName, artist: guessArtist })}
            disabled={challengeSecs > 0}
            className="w-full bg-hitster-yellow text-black font-bold py-4 rounded-2xl text-lg active:opacity-80 disabled:opacity-40"
          >
            {challengeSecs > 0 ? `Reveal in ${challengeSecs}s` : 'Reveal Year'}
          </button>
        )}

        {isRevealing && (
          <p className="text-center text-white/60 text-sm py-3">
            Next round in <span className="text-hitster-yellow font-bold text-lg">{countdown ?? 3}</span>…
          </p>
        )}

        {isMyTurn && isPlaying && (
          <p className="text-center text-white/40 text-sm py-3">Drag the song onto your timeline</p>
        )}

        {!isMyTurn && !isRevealing && (
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
