const GameRoom = require('../game/GameRoom');
const mb = require('../lib/musicbrainz');

const rooms = new Map(); // code -> GameRoom

// Correct a card's year to the song's original release year (await before it matters).
async function applyYear(card) {
  if (!card) return;
  card.year = await mb.lookupYear({
    isrc: card.isrc,
    trackName: card.trackName,
    artist: card.artist,
    fallbackYear: card.year,
  });
}

// Fire-and-forget lookup so the result is cached before the card is revealed.
function prewarm(card) {
  if (!card) return;
  mb.lookupYear({
    isrc: card.isrc,
    trackName: card.trackName,
    artist: card.artist,
    fallbackYear: card.year,
  }).catch(() => {});
}

module.exports = function gameHandler(io, socket) {
  function emit(event, data) {
    socket.emit(event, data);
  }
  function broadcast(code, event, data) {
    io.to(code).emit(event, data);
  }
  function getRoom(code) {
    return rooms.get(typeof code === 'string' ? code.toUpperCase() : '');
  }

  async function revealNow(room) {
    if (room._revealTimer) {
      clearTimeout(room._revealTimer);
      room._revealTimer = null;
    }
    if (room.phase !== 'placed') return;
    // Make sure the mystery card carries its true original year before scoring
    await applyYear(room.currentCard);
    if (room.phase !== 'placed') return; // state may have changed while awaiting
    try {
      const { year, outcomes } = room.reveal();
      io.to(room.code).emit('revealed', {
        year,
        outcomes,
        card: room.currentCard,
        state: room.publicState(),
      });
    } catch (e) {
      /* ignore */
    }
  }

  function scheduleReveal(room) {
    const code = room.code;
    const delay = Math.max(0, (room.challengeDeadline || Date.now()) - Date.now());
    if (room._revealTimer) clearTimeout(room._revealTimer);
    room._revealTimer = setTimeout(() => {
      const r = rooms.get(code);
      if (r) revealNow(r);
    }, delay);
  }

  socket.on('create_room', ({ playerName, spotifyId }) => {
    const room = new GameRoom(socket.id, playerName, spotifyId);
    rooms.set(room.code, room);
    socket.join(room.code);
    emit('room_created', { roomCode: room.code, state: room.publicState() });
  });

  socket.on('join_room', ({ roomCode, playerName, spotifyId }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.addPlayer(socket.id, playerName, spotifyId);
      socket.join(room.code);
      emit('room_joined', { state: room.publicState() });
      socket.to(room.code).emit('state_update', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('set_playlist', ({ roomCode, tracks, playlistName }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    if (room.hostId !== socket.id) return emit('error', { message: 'Not the host' });
    room.setDeck(tracks, playlistName);
    broadcast(room.code, 'state_update', { state: room.publicState() });
  });

  socket.on('start_game', async ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    if (room.hostId !== socket.id) return emit('error', { message: 'Not the host' });
    try {
      room.startGame();
      // Starting cards are shown with their year immediately, so correct them now
      await Promise.all(room.players.map((p) => applyYear(p.timeline[0])));
      prewarm(room.currentCard); // first mystery — ready by reveal time
      broadcast(room.code, 'game_started', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('lock_placement', ({ roomCode, position, name, artist }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.lockPlacement(socket.id, position, { name, artist });
      broadcast(room.code, 'state_update', { state: room.publicState() });
      // Reveal right away if no one can challenge; otherwise run the window
      if (room.allChallengesIn()) revealNow(room);
      else scheduleReveal(room);
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('skip_card', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.skipCard(socket.id);
      prewarm(room.currentCard);
      broadcast(room.code, 'state_update', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('place_challenge', ({ roomCode, position }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.placeChallenge(socket.id, position);
      broadcast(room.code, 'state_update', { state: room.publicState() });
      if (room.allChallengesIn()) revealNow(room);
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('pass_challenge', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.passChallenge(socket.id);
      broadcast(room.code, 'state_update', { state: room.publicState() });
      if (room.allChallengesIn()) revealNow(room);
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('next_turn', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    if (room.getCurrentPlayer()?.id !== socket.id && room.hostId !== socket.id)
      return emit('error', { message: 'Not allowed' });

    const { winner } = room.nextTurn();
    if (winner) {
      broadcast(room.code, 'game_over', { winner, state: room.publicState() });
      rooms.delete(room.code);
    } else {
      prewarm(room.currentCard);
      broadcast(room.code, 'turn_started', { state: room.publicState() });
    }
  });

  socket.on('disconnecting', () => {
    for (const roomCode of socket.rooms) {
      if (roomCode === socket.id) continue;
      const room = rooms.get(roomCode);
      if (!room) continue;

      const result = room.handleLeave(socket.id);
      if (!result.removed) continue;

      if (room.players.length === 0) {
        rooms.delete(roomCode);
        continue;
      }

      // Reassign host if the one who left was hosting
      if (room.hostId === socket.id) room.hostId = room.players[0].id;

      // Tell everyone who left
      io.to(roomCode).emit('player_left', { name: result.name });

      if (result.stopped) {
        io.to(roomCode).emit('game_over', {
          winner: result.winner,
          reason: 'abandoned',
          state: room.publicState(),
        });
        rooms.delete(roomCode);
      } else {
        io.to(roomCode).emit('state_update', { state: room.publicState() });
      }
    }
  });
};
