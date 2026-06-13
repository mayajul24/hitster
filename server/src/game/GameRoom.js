const CHALLENGE_WINDOW_MS = 12000; // how long others can challenge after a placement

class GameRoom {
  constructor(hostId, hostName, hostSpotifyId) {
    this.code = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.hostId = hostId;
    this.phase = 'lobby'; // lobby | playing | placed | revealing | ended
    this.players = [this._makePlayer(hostId, hostName, hostSpotifyId)];
    this.deck = [];
    this.currentCard = null;
    this.currentPlayerIndex = 0;
    this.challenges = {}; // { socketId: { position } }
    this.passes = {}; // { socketId: true } — players who declined to challenge
    this.activePlayerPlacement = null;
    this.activeGuess = null; // { name, artist } submitted on lock
    this.challengeDeadline = null; // epoch ms until challenges are open
    this.playlistName = '';
  }

  _makePlayer(id, name, spotifyId) {
    return { id, name, spotifyId, tokens: 2, timeline: [], connected: true };
  }

  getPlayer(id) {
    return this.players.find((p) => p.id === id);
  }

  addPlayer(id, name, spotifyId) {
    if (this.players.length >= 8) throw new Error('Room is full');
    if (this.phase !== 'lobby') throw new Error('Game already started');
    if (this.players.find((p) => p.id === id)) return;
    this.players.push(this._makePlayer(id, name, spotifyId));
  }

  removePlayer(id) {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx === -1) return { removed: false, wasCurrent: false };
    const wasCurrent = idx === this.currentPlayerIndex;
    const currentId = this.getCurrentPlayer()?.id;
    this.players.splice(idx, 1);
    // Keep pointing at the same active player if they're still here
    if (!wasCurrent && currentId) {
      const newIdx = this.players.findIndex((p) => p.id === currentId);
      this.currentPlayerIndex = newIdx === -1 ? 0 : newIdx;
    } else if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }
    return { removed: true, wasCurrent };
  }

  // Handle a player disconnecting. Returns details so the socket layer can
  // notify the room and, if needed, stop the game.
  handleLeave(id) {
    const name = this.getPlayer(id)?.name || 'A player';
    const { removed, wasCurrent } = this.removePlayer(id);
    if (!removed) return { removed: false, name };

    const inProgress = this.phase !== 'lobby' && this.phase !== 'ended';
    let stopped = false;
    let winner = null;

    if (inProgress && this.players.length < 2) {
      // Not enough players to continue — stop the game
      this.phase = 'ended';
      stopped = true;
      winner = this.players[0] || null;
    } else if (inProgress && wasCurrent && (this.phase === 'playing' || this.phase === 'placed')) {
      // The active player left mid-turn — give the next player a fresh song
      this._drawCard();
      if (this.phase === 'ended') {
        stopped = true;
        winner = [...this.players].sort((a, b) => b.timeline.length - a.timeline.length)[0] || null;
      }
    }

    return { removed: true, name, stopped, winner };
  }

  setDeck(tracks, playlistName) {
    this.deck = [...tracks].sort(() => Math.random() - 0.5);
    this.playlistName = playlistName;
  }

  startGame() {
    if (this.deck.length === 0) throw new Error('No playlist set');
    if (this.players.length < 2) throw new Error('Need at least 2 players');
    const needed = this.players.length * 10;
    if (this.deck.length < needed)
      throw new Error(
        `Need at least 10 songs per player — ${this.players.length} players require ${needed} dated songs, but this playlist only has ${this.deck.length}. Pick a bigger playlist.`
      );
    this.phase = 'playing';
    this.currentPlayerIndex = 0;
    // Deal each player one starting card (revealed on their own timeline)
    for (const player of this.players) {
      player.timeline = [this.deck.pop()];
    }
    this._drawCard();
  }

  _drawCard() {
    if (this.deck.length === 0) {
      this.phase = 'ended';
      return;
    }
    if (this._revealTimer) {
      clearTimeout(this._revealTimer);
      this._revealTimer = null;
    }
    this.currentCard = this.deck.pop();
    this.challenges = {};
    this.passes = {};
    this.activePlayerPlacement = null;
    this.activeGuess = null;
    this.challengeDeadline = null;
    this.phase = 'playing';
  }

  getPublicCard() {
    if (!this.currentCard) return null;
    // Hide every detail while in play — players only hear the song.
    return { trackId: this.currentCard.trackId, uri: this.currentCard.uri };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex] || null;
  }

  // Active player commits their placement (and optional name/artist guess).
  // Until this is called they can re-place freely with no time pressure.
  lockPlacement(playerId, position, guess = {}) {
    if (this.getCurrentPlayer()?.id !== playerId) throw new Error('Not your turn');
    if (this.phase !== 'playing') throw new Error('Already locked in');
    if (position == null) throw new Error('Place the card first');
    this.activePlayerPlacement = position;
    this.activeGuess = { name: (guess.name || '').trim(), artist: (guess.artist || '').trim() };
    this.phase = 'placed';
    // Open the challenge window
    this.challengeDeadline = Date.now() + CHALLENGE_WINDOW_MS;
  }

  skipCard(playerId) {
    if (this.getCurrentPlayer()?.id !== playerId) throw new Error('Not your turn');
    if (this.phase !== 'playing') throw new Error('You can only skip before placing');
    const player = this.getPlayer(playerId);
    if (!player || player.tokens <= 0) throw new Error('No tokens left to skip');
    player.tokens--;
    // Send the skipped song to the bottom of the deck and draw a fresh one
    this.deck.unshift(this.currentCard);
    this._drawCard();
  }

  placeChallenge(playerId, position) {
    if (this.phase !== 'placed') throw new Error('No challenge open right now');
    if (this.getCurrentPlayer()?.id === playerId)
      throw new Error("You can't challenge your own turn");
    if (this.challengeDeadline && Date.now() > this.challengeDeadline)
      throw new Error('Challenge window closed');
    if (position === this.activePlayerPlacement)
      throw new Error('Pick a different spot than the active player');
    const player = this.getPlayer(playerId);
    if (!player) throw new Error('Player not found');
    if (player.tokens <= 0) throw new Error('No tokens left to challenge');
    if (this.challenges[playerId]) throw new Error('You already challenged this round');

    player.tokens--;
    this.challenges[playerId] = { position };
  }

  passChallenge(playerId) {
    if (this.phase !== 'placed') throw new Error('No challenge open right now');
    if (this.getCurrentPlayer()?.id === playerId) throw new Error("It's your turn");
    if (this.challenges[playerId]) throw new Error('You already challenged');
    this.passes[playerId] = true;
  }

  // True once every non-active player who could still challenge has decided
  // (challenged or passed), so the window can close early.
  allChallengesIn() {
    if (this.phase !== 'placed') return false;
    const activeId = this.getCurrentPlayer()?.id;
    return this.players
      .filter((p) => p.id !== activeId && p.tokens > 0 && !this.challenges[p.id])
      .every((p) => this.passes[p.id]);
  }

  reveal() {
    if (this.activePlayerPlacement === null) throw new Error('Place the card first');
    if (this.phase !== 'placed') throw new Error('Nothing to reveal');

    const { year } = this.currentCard;
    const activePlayer = this.getCurrentPlayer();
    const activeTimeline = activePlayer.timeline; // unchanged until we award cards
    const activeCorrect = this._checkPosition(activeTimeline, this.activePlayerPlacement, year);

    // Bonus token: active player named both the song title AND artist
    const g = this.activeGuess || {};
    const guessName = (g.name || '').trim();
    const guessArtist = (g.artist || '').trim();
    const guessed = !!guessName || !!guessArtist;
    const named =
      !!guessName &&
      !!guessArtist &&
      this._matchName(guessName, this.currentCard.trackName) &&
      this._matchArtist(guessArtist, this.currentCard.artist);
    if (named) activePlayer.tokens++;

    const outcomes = [
      {
        playerId: activePlayer.id,
        role: 'active',
        correct: activeCorrect,
        wonCard: activeCorrect,
        guessed,
        named,
      },
    ];
    const winners = activeCorrect ? [activePlayer] : [];

    for (const [pid, ch] of Object.entries(this.challenges)) {
      const challenger = this.getPlayer(pid);
      if (!challenger) continue;
      const chCorrect = this._checkPosition(activeTimeline, ch.position, year);
      // Refund the token only when both the active player and challenger were right (a tie)
      const refunded = chCorrect && activeCorrect;
      if (refunded) challenger.tokens++;
      if (chCorrect) winners.push(challenger);
      outcomes.push({
        playerId: pid,
        role: 'challenger',
        correct: chCorrect,
        wonCard: chCorrect,
        refunded,
      });
    }

    // Award the card to every winner (each keeps their own copy)
    for (const w of winners) this._insertCard(w, this.currentCard);

    this.phase = 'revealing';
    return { year, outcomes };
  }

  _checkPosition(timeline, position, year) {
    const before = timeline[position - 1];
    const after = timeline[position];
    return (!before || before.year <= year) && (!after || after.year >= year);
  }

  // Normalize a title/name for forgiving comparison: lowercase, strip accents,
  // drop "(feat. ...)" / "[...]" and "- Remastered ..." suffixes and punctuation.
  _normalize(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\s-\s.*$/, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  _matchName(guess, actual) {
    const g = this._normalize(guess);
    return !!g && g === this._normalize(actual);
  }

  _matchArtist(guess, actual) {
    const g = this._normalize(guess);
    if (!g) return false;
    if (g === this._normalize(actual)) return true; // full "A, B, C" string
    const parts = (actual || '').split(',').map((a) => this._normalize(a)).filter(Boolean);
    return parts.includes(g); // any individual artist (incl. the primary one)
  }

  _insertCard(player, card) {
    player.timeline.push({ ...card });
    player.timeline.sort((a, b) => a.year - b.year);
  }

  nextTurn() {
    const winner = this.players.find((p) => p.timeline.length >= 10);
    if (winner) {
      this.phase = 'ended';
      return { winner };
    }
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this._drawCard();
    // Deck exhausted — end the game and award it to whoever has the most cards
    if (this.phase === 'ended') {
      const leader = [...this.players].sort(
        (a, b) => b.timeline.length - a.timeline.length
      )[0];
      return { winner: leader };
    }
    return { winner: null };
  }

  // State sent to all clients (year hidden during playing/placed phases)
  publicState() {
    const hideYear = this.phase === 'playing' || this.phase === 'placed';
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      playlistName: this.playlistName,
      deckRemaining: this.deck.length,
      currentPlayerId: this.getCurrentPlayer()?.id || null,
      currentCard: this.currentCard
        ? hideYear
          ? this.getPublicCard()
          : this.currentCard
        : null,
      activePlayerPlacement: this.activePlayerPlacement,
      challenges: this.challenges,
      passes: this.passes,
      challengeDeadline: this.challengeDeadline,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        tokens: p.tokens,
        timeline: p.timeline,
        connected: p.connected,
      })),
    };
  }
}

module.exports = GameRoom;
