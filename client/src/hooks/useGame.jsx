import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { socket } from '../lib/socket.js';

const Ctx = createContext(null);

export function GameProvider({ children }) {
  const [roomCode, setRoomCode] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [mySocketId, setMySocketId] = useState(null);
  const [revealData, setRevealData] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    socket.on('connect', () => setMySocketId(socket.id));
    socket.on('disconnect', () => setMySocketId(null));

    socket.on('room_created', ({ roomCode: code, state }) => {
      setRoomCode(code);
      setGameState(state);
    });

    socket.on('room_joined', ({ state }) => {
      setRoomCode(state.code);
      setGameState(state);
    });

    socket.on('state_update', ({ state }) => setGameState(state));
    socket.on('game_started', ({ state }) => setGameState(state));
    socket.on('turn_started', ({ state }) => {
      setGameState(state);
      setRevealData(null);
    });

    socket.on('revealed', ({ year, outcomes, card, state }) => {
      setGameState(state);
      setRevealData({ year, outcomes, card });
    });

    socket.on('game_over', ({ winner, reason, state }) => {
      setGameState(state);
      setGameOver({ ...(winner || {}), reason });
    });

    socket.on('player_left', ({ name }) => {
      setError(`${name} left the game`);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    return () => socket.removeAllListeners();
  }, []);

  const connect = useCallback(() => {
    if (!socket.connected) socket.connect();
  }, []);

  const createRoom = useCallback((playerName, spotifyId) => {
    connect();
    socket.emit('create_room', { playerName, spotifyId });
  }, [connect]);

  const joinRoom = useCallback((code, playerName, spotifyId) => {
    connect();
    socket.emit('join_room', { roomCode: code, playerName, spotifyId });
  }, [connect]);

  const setPlaylist = useCallback((tracks, playlistName) => {
    socket.emit('set_playlist', { roomCode, tracks, playlistName });
  }, [roomCode]);

  const startGame = useCallback(() => {
    socket.emit('start_game', { roomCode });
  }, [roomCode]);

  const placeCard = useCallback((position) => {
    socket.emit('place_card', { roomCode, position });
  }, [roomCode]);

  const skipCard = useCallback(() => {
    socket.emit('skip_card', { roomCode });
  }, [roomCode]);

  const placeChallenge = useCallback((position) => {
    socket.emit('place_challenge', { roomCode, position });
  }, [roomCode]);

  const reveal = useCallback(() => {
    socket.emit('reveal', { roomCode });
  }, [roomCode]);

  const nextTurn = useCallback(() => {
    socket.emit('next_turn', { roomCode });
  }, [roomCode]);

  const myPlayer = gameState?.players.find((p) => p.id === mySocketId);
  const isMyTurn = gameState?.currentPlayerId === mySocketId;
  const isHost = gameState?.hostId === mySocketId;

  return (
    <Ctx.Provider
      value={{
        roomCode,
        gameState,
        mySocketId,
        myPlayer,
        isMyTurn,
        isHost,
        revealData,
        gameOver,
        error,
        createRoom,
        joinRoom,
        setPlaylist,
        startGame,
        placeCard,
        skipCard,
        placeChallenge,
        reveal,
        nextTurn,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useGame() {
  return useContext(Ctx);
}
