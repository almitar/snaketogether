const socket = io();
let directions = [];
let targetPlayerCount = 0;
let currentPlayers = 0;
let roomId = getUrlParameter('roomId') || "";
let snake;
let food;
let gameLoopInterval;
let currentDirection = 'right';
let directionChanged = false;
let playerIndex = 0;

document.addEventListener('DOMContentLoaded', (event) => {
  if (roomId) {
    joinRoom(roomId);
  }
});

document.getElementById('createRoomButton').addEventListener('click', () => {
  roomId = document.getElementById('roomIdInput').value;
  targetPlayerCount = parseInt(document.getElementById('playerCount').value);
  console.log(`Creating room with ID: ${roomId} for ${targetPlayerCount} players`);
  socket.emit('createRoom', { roomId, targetPlayerCount });

  // Update the URL to include the room ID
  window.history.pushState({}, '', `?roomId=${roomId}`);

  document.getElementById('roomCreation').style.display = 'none';
  document.getElementById('roomWaiting').style.display = 'block';
  updateWaitingMessage();
});

document.getElementById('invitePlayersButton').addEventListener('click', () => {
  const inviteLink = `${window.location.origin}?roomId=${roomId}`;
  navigator.clipboard.writeText(inviteLink).then(() => {
    alert('Invitation link copied to clipboard: ' + inviteLink);
  });
});

document.getElementById('startGameButton').addEventListener('click', () => {
  socket.emit('startGame', roomId);
});

socket.on('playerJoined', (playerCount) => {
  console.log('Received playerJoined event with playerCount:', playerCount);
  currentPlayers = playerCount;
  console.log(`Player joined. Current players: ${currentPlayers}`);
  updateWaitingMessage();
  if (currentPlayers === targetPlayerCount) {
    document.getElementById('startGameButton').disabled = false;
    startCountdown();
  }
});

socket.on('setTargetPlayerCount', (count) => {
  targetPlayerCount = count;
  console.log(`Target player count set to: ${targetPlayerCount}`);
  updateWaitingMessage();
});

socket.on('startGame', (playerDirections) => {
  directions = playerDirections.flat();
  playerIndex = directions.findIndex(dir => dir.includes(currentDirection));
  document.getElementById('roomWaiting').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  setupGame();
});

socket.on('updateDirection', (direction) => {
  currentDirection = direction;
});

function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function joinRoom(roomId) {
  console.log(`Joining room with ID: ${roomId}`);
  socket.emit('joinRoom', roomId);
  document.getElementById('roomCreation').style.display = 'none';
  document.getElementById('roomWaiting').style.display = 'block';
}

function updateWaitingMessage() {
  console.log(`Target players: ${targetPlayerCount}, Current players: ${currentPlayers}`);
  const playersNeeded = targetPlayerCount - currentPlayers;
  document.getElementById('waitingMessage').textContent = `Waiting for ${playersNeeded} more player(s) to join...`;
}

function startCountdown() {
  let countdown = 3;
  document.getElementById('waitingMessage').textContent = `Game starting in ${countdown}...`;
  document.getElementById('playerDirection').textContent = `You are responsible for: ${directions[playerIndex]}`;

  const countdownInterval = setInterval(() => {
    countdown--;
    document.getElementById('waitingMessage').textContent = `Game starting in ${countdown}...`;

    if (countdown === 0) {
      clearInterval(countdownInterval);
      socket.emit('startGame', roomId);
    }
  }, 1000);
}

function setupGame() {
  snake = [{ x: 10, y: 10 }];
  spawnFood();
  currentDirection = 'right';

  document.addEventListener('keydown', handleKeydown);

  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }
  gameLoopInterval = setInterval(gameLoop, 100);
}

function handleKeydown(event) {
  const key = event.keyCode;
  if (directionChanged) return; // Prevent changing direction twice in the same frame

  if (directions.includes('up') && key === 38 && currentDirection !== 'down') { // UP arrow
    currentDirection = 'up';
    directionChanged = true;
    socket.emit('directionChange', currentDirection);
  } else if (directions.includes('down') && key === 40 && currentDirection !== 'up') { // DOWN arrow
    currentDirection = 'down';
    directionChanged = true;
    socket.emit('directionChange', currentDirection);
  } else if (directions.includes('left') && key === 37 && currentDirection !== 'right') { // LEFT arrow
    currentDirection = 'left';
    directionChanged = true;
    socket.emit('directionChange', currentDirection);
  } else if (directions.includes('right') && key === 39 && currentDirection !== 'left') { // RIGHT arrow
    currentDirection = 'right';
    directionChanged = true;
    socket.emit('directionChange', currentDirection);
  }
}

function spawnFood() {
  food = {
    x: Math.floor(Math.random() * 20),
    y: Math.floor(Math.random() * 20)
  };
}

function updateGame() {
  const head = { ...snake[0] };
  if (currentDirection === 'right') head.x += 1;
  if (currentDirection === 'left') head.x -= 1;
  if (currentDirection === 'up') head.y -= 1;
  if (currentDirection === 'down') head.y += 1;

  // Wrap around the canvas edges
  if (head.x >= 20) head.x = 0;
  if (head.x < 0) head.x = 19;
  if (head.y >= 20) head.y = 0;
  if (head.y < 0) head.y = 19;

  // Check if the snake eats itself
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      gameOver();
      return;
    }
  }

  // Check if the snake eats the food
  if (head.x === food.x && head.y === food.y) {
    snake.unshift(head); // Grow the snake
    spawnFood();
  } else {
    snake.unshift(head);
    snake.pop();
  }

  directionChanged = false;
}

function drawGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the snake
  ctx.fillStyle = 'green';
  for (let segment of snake) {
    ctx.fillRect(segment.x * 20, segment.y * 20, 20, 20);
  }

  // Draw the food
  ctx.fillStyle = 'red';
  ctx.fillRect(food.x * 20, food.y * 20, 20, 20);
}

function gameLoop() {
  updateGame();
  drawGame();
}

function gameOver() {
  clearInterval(gameLoopInterval);
  alert('Game Over! Your score is ' + (snake.length - 1));
  // Optionally, you could restart the game or redirect to the home screen
}
