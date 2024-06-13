const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let rooms = new Map(); // Use Map for faster lookups
const HEARTBEAT_INTERVAL = 5000; // 5 seconds
const TIMEOUT = 10000; // 10 seconds
const UPDATE_INTERVAL = 100; // 10 updates per second

io.on('connection', (socket) => {
  console.log('A user connected: ', socket.id);

  socket.on('createRoom', ({ roomId, targetPlayerCount, username }) => {
    if (!roomId || !targetPlayerCount || !username) {
      console.error('Invalid room creation data');
      return;
    }
    console.log(`Creating room with ID: ${roomId} for ${targetPlayerCount} players`);
    rooms.set(roomId, { players: [{ id: socket.id, username, index: 0 }], directions: assignDirections(targetPlayerCount), targetPlayerCount, food: generateFoodPosition([]), currentDirection: 'right' });
    socket.join(roomId);
    io.to(roomId).emit('playerJoined', rooms.get(roomId).players.length);
    socket.emit('setPlayerIndex', 0);
    socket.emit('setTargetPlayerCount', targetPlayerCount);
    socket.emit('updateDirections', rooms.get(roomId).directions);
    console.log(`Directions for room ${roomId}:`, rooms.get(roomId).directions);

    if (rooms.get(roomId).players.length === targetPlayerCount) {
      console.log(`Single player room or target player count reached. Starting countdown...`);
      startGameCountdown(roomId);
    }

    startHeartbeat(socket, roomId);
  });

  socket.on('joinRoom', ({ roomId, username }) => {
    if (!roomId || !username) {
      console.error('Invalid room join data');
      return;
    }
    console.log(`Joining room with ID: ${roomId}`);
    const room = rooms.get(roomId);
    if (room && room.players.length < room.targetPlayerCount) {
      const playerIndex = room.players.length;
      room.players.push({ id: socket.id, username, index: playerIndex });
      socket.join(roomId);
      io.to(roomId).emit('playerJoined', room.players.length);
      socket.emit('setPlayerIndex', playerIndex);
      socket.emit('setTargetPlayerCount', room.targetPlayerCount);

      setTimeout(() => {
        socket.emit('updateDirections', room.directions);
        console.log(`Directions for room ${roomId}:`, room.directions);
      }, 100);

      if (room.players.length === room.targetPlayerCount) {
        console.log(`Target number of players reached in room ${roomId}. Starting countdown...`);
        startGameCountdown(roomId);
      }

      startHeartbeat(socket, roomId);
    } else {
      socket.emit('roomFull');
    }
  });

  socket.on('directionChange', (data) => {
    if (!data || !data.roomId || !data.direction) {
      console.error('Invalid direction change data');
      return;
    }
    console.log(`Direction change received in room ${data.roomId}: ${data.direction}`);
    const room = rooms.get(data.roomId);
    if (room) {
      room.currentDirection = data.direction;
      io.to(data.roomId).emit('updateDirection', { direction: data.direction });
    } else {
      console.log(`Room ${data.roomId} not found`);
    }
  });

  socket.on('foodEaten', (data) => {
    if (!data || !data.roomId || !Array.isArray(data.snake)) {
      console.error('Invalid food eaten data');
      return;
    }
    console.log(`Food eaten in room ${data.roomId}`);
    const room = rooms.get(data.roomId);
    if (room) {
      room.food = generateFoodPosition(data.snake);
      console.log(`Generated new food position: ${room.food.x}, ${room.food.y}`);
      io.to(data.roomId).emit('foodPositionUpdate', room.food);
    }
  });

  socket.on('updateSnake', ({ roomId, snake }) => {
    if (!roomId || !Array.isArray(snake)) {
      console.error('Invalid snake update data');
      return;
    }
    const room = rooms.get(roomId);
    if (room) {
      room.snake = snake;
      io.to(roomId).emit('updateSnake', snake);
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected: ', socket.id);
    rooms.forEach((room, roomId) => {
      const disconnectedPlayer = room.players.find(player => player.id === socket.id);
      if (disconnectedPlayer) {
        room.players = room.players.filter(player => player.id !== socket.id);
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('playerDisconnected', {
            username: disconnectedPlayer.username,
            remainingPlayers: room.players.length,
            targetPlayerCount: room.targetPlayerCount
          });
          console.log(`Player count after disconnect for room ${roomId}: ${room.players.length}`);
        }
      }
    });
  });

  socket.on('pong', () => {
    socket.lastPong = Date.now();
  });

  socket.on('playerReconnected', ({ roomId, username }) => {
    if (!roomId || !username) {
      console.error('Invalid player reconnection data');
      return;
    }
    console.log(`Player ${username} connected to room ${roomId}`);
    const room = rooms.get(roomId);
    if (room) {
      const playerIndex = room.players.length;
      room.players.push({ id: socket.id, username, index: playerIndex });
      socket.join(roomId);
      io.to(roomId).emit('playerReconnected', {
        username,
        remainingPlayers: room.players.length,
        targetPlayerCount: room.targetPlayerCount
      });

      if (room.players.length === room.targetPlayerCount) {
        io.to(roomId).emit('resumeGame');
      }

      startHeartbeat(socket, roomId);
    }
  });
});

function startHeartbeat(socket, roomId) {
  socket.lastPong = Date.now();

  const heartbeatInterval = setInterval(() => {
    if (Date.now() - socket.lastPong > TIMEOUT) {
      clearInterval(heartbeatInterval);
      socket.disconnect(true);
      console.log(`Heartbeat timeout for user ${socket.id}`);
    } else {
      socket.emit('ping');
    }
  }, HEARTBEAT_INTERVAL);

  socket.on('disconnect', () => {
    clearInterval(heartbeatInterval);
  });
}

function startGameCountdown(roomId) {
  const room = rooms.get(roomId);
  let countdown = 3;
  io.to(roomId).emit('updateCountdown', countdown);
  console.log(`Countdown started for room ${roomId} with countdown ${countdown}`);

  const countdownInterval = setInterval(() => {
    countdown--;
    io.to(roomId).emit('updateCountdown', countdown);
    console.log(`Countdown in room ${roomId}: ${countdown}`);

    if (countdown === 0) {
      clearInterval(countdownInterval);
      const initialSnake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
      ];
      room.snake = initialSnake;
      room.gameInterval = setInterval(() => updateGameState(roomId), UPDATE_INTERVAL);
      io.to(roomId).emit('startGame', { directions: room.directions, food: room.food, snake: initialSnake });
    }
  }, 1000);
}

function updateGameState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const head = { ...room.snake[0] };
  if (room.currentDirection === 'right') head.x += 1;
  if (room.currentDirection === 'left') head.x -= 1;
  if (room.currentDirection === 'up') head.y -= 1;
  if (room.currentDirection === 'down') head.y += 1;
  if (head.x >= 20) head.x = 0;
  if (head.x < 0) head.x = 19;
  if (head.y >= 20) head.y = 0;
  if (head.y < 0) head.y = 19;

  for (let i = 1; i < room.snake.length; i++) {
    if (room.snake[i].x === head.x && room.snake[i].y === head.y) {
      gameOver(roomId);
      return;
    }
  }

  if (head.x === room.food.x && head.y === room.food.y) {
    room.snake.unshift(head);
    room.food = generateFoodPosition(room.snake);
    io.to(roomId).emit('foodPositionUpdate', room.food);
  } else {
    room.snake.unshift(head);
    room.snake.pop();
  }

  io.to(roomId).emit('updateSnake', room.snake);
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
