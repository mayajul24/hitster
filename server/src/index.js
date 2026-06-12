require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const gameHandler = require('./socket/gameHandler');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'https://localhost:5173';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  gameHandler(io, socket);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Hitster server on :${PORT}`));
