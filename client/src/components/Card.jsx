export default function Card({ card, revealed = false, small = false }) {
  if (!card) return null;

  return (
    <div
      className={`rounded-xl overflow-hidden bg-hitster-card border border-white/10 flex-shrink-0 ${
        small ? 'w-20' : 'w-full'
      }`}
    >
      {card.albumArt && (
        <img
          src={card.albumArt}
          alt=""
          className={`w-full object-cover ${small ? 'h-20' : 'h-40'}`}
        />
      )}
      <div className={`p-2 ${small ? 'p-1' : 'p-3'}`}>
        {revealed && (
          <p className={`font-black text-hitster-yellow ${small ? 'text-xs' : 'text-2xl'}`}>
            {card.year}
          </p>
        )}
        <p className={`font-semibold text-white leading-tight ${small ? 'text-xs' : 'text-sm'}`}>
          {card.trackName}
        </p>
        <p className={`text-white/50 ${small ? 'text-xs' : 'text-xs'} truncate`}>{card.artist}</p>
      </div>
    </div>
  );
}
