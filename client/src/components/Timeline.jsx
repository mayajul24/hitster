import { useDroppable } from '@dnd-kit/core';

// Horizontal timeline of song cards, oldest -> newest left to right.
// placing          — when true, renders drop targets (and tappable slots) between/around cards.
// onPlace(position)— called when a slot is tapped (fallback to dragging).
// selectedPosition — slot index the active player locked in (renders a mystery card there).
export default function Timeline({ timeline, placing = false, onPlace, selectedPosition = null }) {
  const items = [];

  for (let pos = 0; pos <= timeline.length; pos++) {
    const selected = selectedPosition === pos;

    if (selected) {
      items.push(<MysteryCard key={`slot-${pos}`} />);
    } else if (placing) {
      items.push(
        <DropSlot
          key={`slot-${pos}`}
          pos={pos}
          onPlace={onPlace}
          edge={pos === 0 ? 'before' : pos === timeline.length ? 'after' : null}
        />
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

function DropSlot({ pos, onPlace, edge }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${pos}` });
  return (
    <button
      ref={setNodeRef}
      onClick={() => onPlace?.(pos)}
      aria-label={edge === 'before' ? 'Place before all' : edge === 'after' ? 'Place after all' : 'Place here'}
      className={`w-12 flex-shrink-0 self-stretch min-h-[7.5rem] rounded-xl border-2 border-dashed flex items-center justify-center transition-colors ${
        isOver
          ? 'border-hitster-yellow bg-hitster-yellow/30 text-hitster-yellow scale-105'
          : 'border-white/20 text-white/40 active:bg-hitster-yellow/20 active:border-hitster-yellow'
      }`}
    >
      <span className="text-2xl leading-none">+</span>
    </button>
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
