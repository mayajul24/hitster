const GameRoom = require('../game/GameRoom');

const rooms = new Map(); // code -> GameRoom

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

  socket.on('start_game', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    if (room.hostId !== socket.id) return emit('error', { message: 'Not the host' });
    try {
      room.startGame();
      broadcast(room.code, 'game_started', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('place_card', ({ roomCode, position }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.placeCard(socket.id, position);
      broadcast(room.code, 'state_update', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('skip_card', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.skipCard(socket.id);
      broadcast(room.code, 'state_update', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('place_token', ({ roomCode, position }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    try {
      room.placeToken(socket.id, position);
      broadcast(room.code, 'state_update', { state: room.publicState() });
    } catch (e) {
      emit('error', { message: e.message });
    }
  });

  socket.on('reveal', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return emit('error', { message: 'Room not found' });
    if (room.getCurrentPlayer()?.id !== socket.id)
      return emit('error', { message: 'Not your turn' });
    try {
      const { year, correct } = room.reveal();
      broadcast(room.code, 'revealed', {
        year,
        correct,
        card: room.currentCard,
        state: room.publicState(),
      });
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
