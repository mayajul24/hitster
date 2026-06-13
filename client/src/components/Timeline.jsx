import { useDroppable, useDraggable } from '@dnd-kit/core';

// Horizontal timeline of song cards, oldest -> newest left to right.
// droppablePositions — array of slot indices that accept a drop / tap (or null).
// onPlace(position)   — called when a droppable slot is tapped.
// markers             — [{ position, kind: 'mystery'|'active'|'me'|'other', label }]
//                       rendered as a "?" placeholder at that slot.
// mysteryDraggable    — when true, a 'mystery' marker can be dragged to another slot.
export default function Timeline({
  timeline,
  onPlace,
  droppablePositions = null,
  markers = [],
  mysteryDraggable = false,
}) {
  const items = [];

  for (let pos = 0; pos <= timeline.length; pos++) {
    const droppable = droppablePositions?.includes(pos);

    if (droppable) {
      items.push(
        <DropSlot
          key={`slot-${pos}`}
          pos={pos}
          onPlace={onPlace}
          edge={pos === 0 ? 'before' : pos === timeline.length ? 'after' : null}
        />
      );
    } else {
      const here = markers.filter((m) => m.position === pos);
      if (here.length) {
        items.push(
          <div key={`m-${pos}`} className="flex-shrink-0 flex flex-col gap-1 justify-center">
            {here.map((m, i) =>
              m.kind === 'mystery' && mysteryDraggable ? (
                <DraggableMarker key={i} label={m.label} />
              ) : (
                <Marker key={i} kind={m.kind} label={m.label} />
              )
            )}
          </div>
        );
      }
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

const MARKER_STYLES = {
  mystery: 'border-hitster-yellow bg-hitster-yellow/15 text-hitster-yellow',
  active: 'border-hitster-yellow bg-hitster-yellow/15 text-hitster-yellow',
  me: 'border-hitster-accent bg-hitster-accent/20 text-hitster-accent',
  other: 'border-white/30 bg-white/10 text-white/80',
};

function Marker({ kind, label }) {
  return (
    <div
      className={`w-20 flex-shrink-0 self-stretch min-h-[7.5rem] rounded-xl border-2 flex flex-col items-center justify-center ${
        MARKER_STYLES[kind] || MARKER_STYLES.other
      }`}
    >
      <span className="text-3xl font-black leading-none">?</span>
      <span className="text-[10px] font-semibold mt-1 px-1 text-center leading-tight">{label}</span>
    </div>
  );
}

// The active player's placed "?" — draggable so they can move it to another slot.
function DraggableMarker({ label }) {
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
      className={`w-20 flex-shrink-0 self-stretch min-h-[7.5rem] rounded-xl border-2 border-hitster-yellow bg-hitster-yellow/15 text-hitster-yellow flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none ${
        isDragging ? 'opacity-80 shadow-2xl' : ''
      }`}
    >
      <span className="text-3xl font-black leading-none">?</span>
      <span className="text-[10px] font-semibold mt-1 px-1 text-center leading-tight">{label}</span>
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
