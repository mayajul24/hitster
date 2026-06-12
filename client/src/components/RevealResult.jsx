export default function RevealResult({ revealData, players, myId }) {
  if (!revealData) return null;

  const { year, outcomes, card } = revealData;

  const getOutcome = (playerId) => outcomes.find((o) => o.playerId === playerId);
  const myOutcome = getOutcome(myId);

  const resultLabel = {
    correct: { text: 'Correct!', color: 'text-[#1DB954]' },
    wrong: { text: 'Wrong', color: 'text-hitster-accent' },
    challenge_correct: { text: 'Bet won! +1 card', color: 'text-[#1DB954]' },
    challenge_wrong: { text: 'Bet lost', color: 'text-hitster-accent' },
    challenge_failed: { text: 'Bet lost (they were right)', color: 'text-white/50' },
  };

  return (
    <div className="space-y-4">
      {/* Year reveal */}
      <div className="text-center bg-hitster-card rounded-2xl p-5 border border-white/10">
        {card?.albumArt && (
          <img src={card.albumArt} className="w-20 h-20 rounded-xl object-cover mx-auto mb-3" alt="" />
        )}
        <p className="text-white/50 text-sm">{card?.trackName}</p>
        <p className="text-white/30 text-xs mb-2">{card?.artist}</p>
        <p className="text-6xl font-black text-hitster-yellow">{year}</p>
      </div>

      {/* My result */}
      {myOutcome && (
        <div className={`text-center text-xl font-bold ${resultLabel[myOutcome.result]?.color}`}>
          {resultLabel[myOutcome.result]?.text}
        </div>
      )}

      {/* All outcomes */}
      <div className="space-y-2">
        {outcomes.map((o) => {
          const player = players.find((p) => p.id === o.playerId);
          const label = resultLabel[o.result];
          return (
            <div key={o.playerId} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2">
              <span className="text-sm font-medium">{player?.name || '?'}</span>
              <span className={`text-sm font-semibold ${label?.color}`}>{label?.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
