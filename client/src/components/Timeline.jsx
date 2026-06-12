import Card from './Card.jsx';

// Renders a player's timeline with placement slots between cards.
// onPlace(position) — called when user taps a slot
// highlightPosition — index of the active player's chosen placement
// tokenPosition — index where myToken is placed
// otherTokens — [{ playerId, playerName, position }]
export default function Timeline({
  timeline,
  onPlace,
  highlightPosition,
  tokenPosition,
  otherTokens = [],
  revealed = false,
  disabled = false,
}) {
  const slots = timeline.length + 1; // positions 0..timeline.length

  const getTokensAtSlot = (pos) =>
    otherTokens.filter((t) => t.position === pos);

  return (
    <div className="space-y-1">
      {Array.from({ length: slots }).map((_, pos) => {
        const card = timeline[pos - 1]; // card to the left of this slot
        const nextCard = timeline[pos]; // card to the right
        const myTokenHere = tokenPosition === pos;
        const othersHere = getTokensAtSlot(pos);
        const activeHere = highlightPosition === pos;
        const canPlace = !disabled && !!onPlace;

        return (
          <div key={pos}>
            {/* Slot */}
            <button
              disabled={!canPlace}
              onClick={() => onPlace?.(pos)}
              className={`w-full flex items-center gap-2 py-2 px-3 rounded-xl transition-colors ${
                activeHere
                  ? 'bg-hitster-yellow/30 border border-hitster-yellow'
                  : myTokenHere
                  ? 'bg-hitster-accent/20 border border-hitster-accent'
                  : canPlace
                  ? 'bg-white/5 border border-white/10 active:bg-white/10'
                  : 'border border-transparent'
              }`}
            >
              <div className="flex-1 h-0.5 bg-white/10 rounded" />
              {canPlace && (
                <span className="text-white/30 text-xs">
                  {pos === 0 ? 'Before all' : pos === timeline.length ? 'After all' : ''}
                </span>
              )}
              {myTokenHere && (
                <span className="bg-hitster-accent text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                  Your token
                </span>
              )}
              {activeHere && !myTokenHere && (
                <span className="bg-hitster-yellow text-black text-xs px-2 py-0.5 rounded-full font-semibold">
                  Placed here
                </span>
              )}
              {othersHere.map((t) => (
                <span
                  key={t.playerId}
                  className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full"
                >
                  {t.playerName}
                </span>
              ))}
              <div className="flex-1 h-0.5 bg-white/10 rounded" />
            </button>

            {/* Card after this slot */}
            {nextCard && (
              <div className="px-2">
                <div className="bg-hitster-card border border-white/10 rounded-xl p-3 flex items-center gap-3">
                  {nextCard.albumArt && (
                    <img src={nextCard.albumArt} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{nextCard.trackName}</p>
                    <p className="text-white/50 text-xs truncate">{nextCard.artist}</p>
                  </div>
                  <span className="text-hitster-yellow font-black text-lg">{nextCard.year}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
