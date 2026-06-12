import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

  // Auto-play the mystery track on this client's own Spotify device each new card
  useEffect(() => {
    const uri = gameState?.currentCard?.uri;
    if (!uri || gameState.phase === 'revealing') return;
    (async () => {
      try {
        const token = await getToken();
        const devices = await getDevices(token);
        const active = devices.find((d) => d.is_active) || devices[0];
        if (active) await playTrack(uri, token, active.id);
      } catch {}
    })();
  }, [gameState?.currentCard?.trackId]);

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

  const { phase, currentCard, currentPlayerId, activePlayerPlacement, players } = gameState;
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

        {/* ACTIVE PLAYER: place the song on your own timeline */}
        {isMyTurn && !isRevealing && (
          <div className="space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-wider">
              {isPlaced ? 'Locked in — reveal when ready' : 'Where does this song go? Tap a slot.'}
            </p>
            <Timeline
              timeline={myTimeline}
              onPlace={!isPlaced ? placeCard : undefined}
              selectedPosition={isPlaced ? activePlayerPlacement : null}
            />
          </div>
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

        {isMyTurn && phase === 'playing' && (
          <p className="text-center text-white/40 text-sm py-3">Tap a slot to place the song</p>
        )}

        {!isMyTurn && !isRevealing && (
          <p className="text-center text-white/40 text-sm py-3">{activePlayer?.name}'s turn</p>
        )}
      </div>
    </div>
  );
}
