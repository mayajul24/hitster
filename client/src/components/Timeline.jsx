// Horizontal timeline of song cards, oldest -> newest left to right.
// onPlace(position)  — when provided, shows tappable insert slots between/around cards.
// selectedPosition   — slot index the active player locked in (renders a mystery card there).
export default function Timeline({ timeline, onPlace, selectedPosition = null }) {
  const interactive = !!onPlace;
  const items = [];

  for (let pos = 0; pos <= timeline.length; pos++) {
    const selected = selectedPosition === pos;

    if (selected) {
      items.push(<MysteryCard key={`slot-${pos}`} />);
    } else if (interactive) {
      items.push(
        <button
          key={`slot-${pos}`}
          onClick={() => onPlace(pos)}
          aria-label={
            pos === 0
              ? 'Place before all'
              : pos === timeline.length
              ? 'Place after all'
              : 'Place here'
          }
          className="w-12 flex-shrink-0 self-stretch min-h-[7.5rem] rounded-xl border-2 border-dashed border-white/20 text-white/40 flex items-center justify-center active:bg-hitster-yellow/20 active:border-hitster-yellow active:text-hitster-yellow transition-colors"
        >
          <span className="text-2xl leading-none">+</span>
        </button>
      );
    }

    const card = timeline[pos];
    if (card) items.push(<TimelineCard key={`card-${card.trackId ?? pos}`} card={card} />);
  }

  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto pb-2 px-1 min-h-[8rem]">
      {items}
    </div>
  );
}

function TimelineCard({ card }) {
  return (
    <div className="w-28 flex-shrink-0 rounded-xl overflow-hidden bg-hitster-card border border-white/10">
      {card.albumArt ? (
        <img src={card.albumArt} className="w-full h-20 object-cover" alt="" />
      ) : (
        <div className="w-full h-20 bg-white/5" />
      )}
      <div className="p-2">
        <p className="text-hitster-yellow font-black text-xl leading-none">{card.year}</p>
        <p className="text-white text-xs font-semibold truncate mt-1">{card.trackName}</p>
        <p className="text-white/50 text-[11px] truncate">{card.artist}</p>
      </div>
    </div>
  );
}

function MysteryCard() {
  return (
    <div className="w-28 flex-shrink-0 self-stretch min-h-[7.5rem] rounded-xl border-2 border-hitster-yellow bg-hitster-yellow/15 flex flex-col items-center justify-center">
      <span className="text-4xl text-hitster-yellow font-black leading-none">?</span>
      <span className="text-hitster-yellow text-[11px] mt-1 font-semibold">Placed here</span>
    </div>
  );
}
