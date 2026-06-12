export default function RevealResult({ revealData, playerName, isMe }) {
  if (!revealData) return null;
  const { year, correct, card } = revealData;
  const who = isMe ? 'You' : playerName || 'Player';

  return (
    <div className="space-y-4">
      {/* Song + year reveal */}
      <div className="text-center bg-hitster-card rounded-2xl p-5 border border-white/10">
        {card?.albumArt && (
          <img src={card.albumArt} className="w-20 h-20 rounded-xl object-cover mx-auto mb-3" alt="" />
        )}
        <p className="text-white font-semibold">{card?.trackName}</p>
        <p className="text-white/40 text-xs mb-3">{card?.artist}</p>
        <p className="text-6xl font-black text-hitster-yellow">{year}</p>
      </div>

      {/* Result */}
      <div
        className={`text-center text-xl font-bold ${
          correct ? 'text-[#1DB954]' : 'text-hitster-accent'
        }`}
      >
        {correct ? `${who} got it! +1 card` : `${who} missed — no card`}
      </div>
    </div>
  );
}
