class GameRoom {
  constructor(hostId, hostName, hostSpotifyId) {
    this.code = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.hostId = hostId;
    this.phase = 'lobby'; // lobby | playing | placed | revealing | ended
    this.players = [this._makePlayer(hostId, hostName, hostSpotifyId)];
    this.deck = [];
    this.currentCard = null;
    this.currentPlayerIndex = 0;
    this.tokenPlacements = {}; // { socketId: { yearBefore, yearAfter } }
    this.activePlayerPlacement = null;
    this.playlistName = '';
  }

  _makePlayer(id, name, spotifyId) {
    return { id, name, spotifyId, tokens: 0, timeline: [], connected: true };
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
    if (idx === -1) return;
    this.players.splice(idx, 1);
    if (this.currentPlayerIndex >= this.players.length) {
      this.currentPlayerIndex = 0;
    }
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
    this.currentCard = this.deck.pop();
    this.tokenPlacements = {};
    this.activePlayerPlacement = null;
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

  placeCard(playerId, position) {
    if (this.getCurrentPlayer()?.id !== playerId) throw new Error('Not your turn');
    if (this.phase !== 'playing') throw new Error('Cannot place now');
    this.activePlayerPlacement = position;
    this.phase = 'placed';
  }

  placeToken(playerId, position) {
    if (this.getCurrentPlayer()?.id === playerId) throw new Error('Cannot bet on your own turn');
    if (this.phase !== 'playing' && this.phase !== 'placed') throw new Error('Cannot place token now');
    const player = this.getPlayer(playerId);
    if (!player) throw new Error('Player not found');
    if (player.tokens <= 0) throw new Error('No tokens left');
    if (this.tokenPlacements[playerId]) throw new Error('Already placed a token this round');

    player.tokens--;

    // Record the year range this bet represents on the active player's timeline
    const activeTimeline = this.getCurrentPlayer().timeline;
    const yearBefore = position > 0 ? activeTimeline[position - 1].year : -Infinity;
    const yearAfter = position < activeTimeline.length ? activeTimeline[position].year : Infinity;
    this.tokenPlacements[playerId] = { position, yearBefore, yearAfter };
  }

  reveal() {
    if (this.activePlayerPlacement === null) throw new Error('Place the card first');
    const { year } = this.currentCard;
    const activePlayer = this.getCurrentPlayer();
    const correct = this._checkPosition(
      activePlayer.timeline,
      this.activePlayerPlacement,
      year
    );
    if (correct) this._insertCard(activePlayer, this.currentCard);
    this.phase = 'revealing';
    return { year, correct };
  }

  _checkPosition(timeline, position, year) {
    const before = timeline[position - 1];
    const after = timeline[position];
    return (!before || before.year <= year) && (!after || after.year >= year);
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
      tokenPlacements: this.tokenPlacements,
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
