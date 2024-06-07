const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let rooms = {};

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createRoom', ({ roomId, targetPlayerCount }) => {
    console.log(`Creating room with ID: ${roomId} for ${targetPlayerCount} players`);
    rooms[roomId] = { players: [], directions: [], targetPlayerCount };
    socket.join(roomId);
    rooms[roomId].players.push(socket.id);
    console.log(`Room created with player count for room ${roomId}: ${rooms[roomId].players.length}`);
    io.to(roomId).emit('playerJoined', rooms[roomId].players.length);
    socket.emit('setTargetPlayerCount', targetPlayerCount);
  });

  socket.on('joinRoom', (roomId) => {
    console.log(`Joining room with ID: ${roomId}`);
    if (rooms[roomId] && rooms[roomId].players.length < 4) {
      rooms[roomId].players.push(socket.id);
      socket.join(roomId);
      console.log(`Player count after joining for room ${roomId}: ${rooms[roomId].players.length}`);
      io.to(roomId).emit('playerJoined', rooms[roomId].players.length);
      socket.emit('setTargetPlayerCount', rooms[roomId].targetPlayerCount);
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('startGame', (roomId) => {
    console.log(`Starting game in room ${roomId}`);
    const room = rooms[roomId];
    if (room.players.length === 1) {
      room.directions = [
        ['up', 'down', 'left', 'right']
      ];
    } else if (room.players.length === 2) {
      room.directions = [
        ['up', 'down'],
        ['left', 'right']
      ];
    } else if (room.players.length === 4) {
      room.directions = [
        ['up'],
        ['down'],
        ['left'],
        ['right']
      ];
    }
    io.to(roomId).emit('startGame', room.directions);
  });

  socket.on('directionChange', (roomId, direction) => {
    socket.to(roomId).emit('updateDirection', direction);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    for (let roomId in rooms) {
      let room = rooms[roomId];
      room.players = room.players.filter((player) => player !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        console.log(`Player count after disconnect for room ${roomId}: ${room.players.length}`);
        io.to(roomId).emit('playerJoined', room.players.length);
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Listening on *:3000');
});
