const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let rooms = {};

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('createRoom', (roomId) => {
    rooms[roomId] = { players: [], directions: [] };
    socket.join(roomId);
  });

  socket.on('joinRoom', (roomId) => {
    if (rooms[roomId] && rooms[roomId].players.length < 4) {
      rooms[roomId].players.push(socket.id);
      socket.join(roomId);

      if (rooms[roomId].players.length === 2) {
        rooms[roomId].directions = [
          ['up', 'down'],
          ['left', 'right']
        ];
      } else if (rooms[roomId].players.length === 4) {
        rooms[roomId].directions = [
          ['up'],
          ['down'],
          ['left'],
          ['right']
        ];
      }

      io.to(roomId).emit('startGame', rooms[roomId].directions);
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('directionChange', (roomId, direction) => {
    socket.to(roomId).emit('updateDirection', direction);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
    for (let roomId in rooms) {
      let room = rooms[roomId];
      room.players = room.players.filter((player) => player !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});

