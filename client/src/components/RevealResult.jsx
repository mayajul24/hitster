export default function RevealResult({ revealData, players }) {
  if (!revealData) return null;
  const { year, outcomes = [], card } = revealData;
  const nameOf = (id) => players.find((p) => p.id === id)?.name || '?';

  const labelFor = (o) => {
    if (o.role === 'active') {
      return o.correct
        ? { t: 'Correct! +1 card', c: 'text-[#1DB954]' }
        : { t: 'Wrong', c: 'text-hitster-accent' };
    }
    if (o.correct) {
      return o.refunded
        ? { t: 'Tied — card + token back', c: 'text-[#1DB954]' }
        : { t: 'Challenge won! +1 card', c: 'text-[#1DB954]' };
    }
    return { t: 'Challenge failed', c: 'text-hitster-accent' };
  };

  // Naming sub-result for the active player (shown whether right or wrong)
  const nameNote = (o) => {
    if (o.role !== 'active' || !o.guessed) return null;
    return o.named
      ? { t: 'Named it · +1 token', c: 'text-[#1DB954]' }
      : { t: 'Name/artist missed', c: 'text-white/40' };
  };

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

      {/* Per-player outcomes */}
      <div className="space-y-2">
        {outcomes.map((o) => {
          const l = labelFor(o);
          const note = nameNote(o);
          return (
            <div
              key={o.playerId}
              className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2"
            >
              <span className="text-sm font-medium">
                {nameOf(o.playerId)}
                {o.role === 'active' && <span className="text-white/40 text-xs"> · turn</span>}
              </span>
              <span className="text-right">
                <span className={`block text-sm font-semibold ${l.c}`}>{l.t}</span>
                {note && <span className={`block text-xs ${note.c}`}>{note.t}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
