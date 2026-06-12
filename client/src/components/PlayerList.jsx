export default function PlayerList({ players, currentPlayerId, myId }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {players.map((p) => {
        const isActive = p.id === currentPlayerId;
        const isMe = p.id === myId;
        const n = p.timeline.length;
        return (
          <div
            key={p.id}
            className={`flex-shrink-0 rounded-xl p-2.5 text-center min-w-[72px] transition-colors ${
              isActive ? 'bg-hitster-yellow' : 'bg-white/5'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mx-auto ${
                isActive ? 'bg-black text-hitster-yellow' : 'bg-white/20 text-white'
              }`}
            >
              {p.name[0]?.toUpperCase()}
            </div>
            <p
              className={`text-xs font-semibold mt-1 truncate max-w-[64px] ${
                isActive ? 'text-black' : 'text-white'
              }`}
            >
              {isMe ? 'You' : p.name}
            </p>
            <p className={`text-xs ${isActive ? 'text-black/60' : 'text-white/40'}`}>
              {n} card{n === 1 ? '' : 's'}
            </p>
            {/* Skip tokens */}
            <div className="flex justify-center gap-1 mt-1">
              {Array.from({ length: Math.max(2, p.tokens) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full border transition-colors ${
                    i < p.tokens
                      ? isActive
                        ? 'bg-black border-black'
                        : 'bg-hitster-yellow border-hitster-yellow'
                      : isActive
                      ? 'border-black/30'
                      : 'border-white/25'
                  }`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
