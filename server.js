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
    rooms[roomId] = { players: [], directions: [], targetPlayerCount, food: generateFoodPosition([]) };
    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id, index: 0 });
    console.log(`Room created with player count for room ${roomId}: ${rooms[roomId].players.length}`);
    io.to(roomId).emit('playerJoined', rooms[roomId].players.length);
    socket.emit('setPlayerIndex', 0);
    socket.emit('setTargetPlayerCount', targetPlayerCount);

    // Check if the room should start immediately
    if (rooms[roomId].players.length === targetPlayerCount) {
      console.log(`Single player room or target player count reached. Starting countdown...`);
      startGameCountdown(roomId);
    }
  });

  socket.on('joinRoom', (roomId) => {
    console.log(`Joining room with ID: ${roomId}`);
    if (rooms[roomId] && rooms[roomId].players.length < rooms[roomId].targetPlayerCount) {
      const playerIndex = rooms[roomId].players.length;
      rooms[roomId].players.push({ id: socket.id, index: playerIndex });
      socket.join(roomId);
      console.log(`Player count after joining for room ${roomId}: ${rooms[roomId].players.length}`);
      io.to(roomId).emit('playerJoined', rooms[roomId].players.length);
      socket.emit('setPlayerIndex', playerIndex);
      socket.emit('setTargetPlayerCount', rooms[roomId].targetPlayerCount);

      if (rooms[roomId].players.length === rooms[roomId].targetPlayerCount) {
        console.log(`Target number of players reached in room ${roomId}. Starting countdown...`);
        startGameCountdown(roomId);
      }
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('directionChange', (data) => {
    console.log(`Direction change received in room ${data.roomId}: ${data.direction}`);
    const room = rooms[data.roomId];
    if (room) {
      room.currentDirection = data.direction;
      io.to(data.roomId).emit('updateDirection', { direction: data.direction });
    } else {
      console.log(`Room ${data.roomId} not found`);
    }
  });

  socket.on('foodEaten', (data) => {
    console.log(`Food eaten in room ${data.roomId}`);
    const room = rooms[data.roomId];
    if (room) {
      room.food = generateFoodPosition(data.snake);
      console.log(`Generated new food position: ${room.food.x}, ${room.food.y}`);
      io.to(data.roomId).emit('foodPositionUpdate', room.food);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    for (let roomId in rooms) {
      let room = rooms[roomId];
      room.players = room.players.filter((player) => player.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        console.log(`Player count after disconnect for room ${roomId}: ${room.players.length}`);
        io.to(roomId).emit('playerJoined', room.players.length);
      }
    }
  });
});

function startGameCountdown(roomId) {
  let countdown = 3;
  io.to(roomId).emit('updateCountdown', countdown);
  console.log(`Countdown started for room ${roomId} with countdown ${countdown}`);

  const countdownInterval = setInterval(() => {
    countdown--;
    io.to(roomId).emit('updateCountdown', countdown);
    console.log(`Countdown in room ${roomId}: ${countdown}`);

    if (countdown === 0) {
      clearInterval(countdownInterval);
      const room = rooms[roomId];
      room.directions = assignDirections(room.players.length);
      io.to(roomId).emit('startGame', { directions: room.directions, food: room.food });
    }
  }, 1000);
}

function generateFoodPosition(snake) {
  let food;
  let validPosition = false;
  
  while (!validPosition) {
    food = {
      x: Math.floor(Math.random() * 20),
      y: Math.floor(Math.random() * 20)
    };

    validPosition = !snake.some(segment => segment.x === food.x && segment.y === food.y);
  }
  
  return food;
}

function assignDirections(playerCount) {
  if (playerCount === 1) {
    return [['up', 'down', 'left', 'right']];
  } else if (playerCount === 2) {
    return [['up', 'down'], ['left', 'right']];
  } else if (playerCount === 4) {
    return [['up'], ['right'], ['down'], ['left']];
  }
  return [];
}

server.listen(3000, () => {
  console.log('Listening on *:3000');
});
