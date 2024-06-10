const socket = io();
let directions = [];
let targetPlayerCount = 0;
let currentPlayers = 0;
let roomId = getUrlParameter('roomId') || "";
let snake = [];
let food;
let gameLoopInterval;
let currentDirection = 'right';
let directionChanged = false;
let playerIndex = 0;

document.addEventListener('DOMContentLoaded', (event) => {
  if (roomId) {
    joinRoom(roomId);
  }

  document.getElementById('upButton').addEventListener('click', () => changeDirection('up'));
  document.getElementById('leftButton').addEventListener('click', () => changeDirection('left'));
  document.getElementById('downButton').addEventListener('click', () => changeDirection('down'));
  document.getElementById('rightButton').addEventListener('click', () => changeDirection('right'));
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

socket.on('playerJoined', (playerCount) => {
  console.log('Received playerJoined event with playerCount:', playerCount);
  currentPlayers = playerCount;
  console.log(`Player joined. Current players: ${currentPlayers}`);
  updateWaitingMessage();
  // Removed client-side emission of startGame
});

socket.on('setTargetPlayerCount', (count) => {
  targetPlayerCount = count;
  console.log(`Target player count set to: ${targetPlayerCount}`);
  updateWaitingMessage();
});

socket.on('setPlayerIndex', (index) => {
  playerIndex = index;
  console.log(`Player index set to: ${playerIndex}`);
});

socket.on('updateCountdown', (countdown) => {
  console.log(`Countdown: ${countdown}`);
  if (countdown > 0) {
    document.getElementById('waitingMessage').textContent = `Game starting in ${countdown}...`;
  } else {
    document.getElementById('waitingMessage').textContent = `Game starting...`;
  }
});

socket.on('startGame', ({ directions: playerDirections, food: initialFood }) => {
  directions = playerDirections;
  food = initialFood;
  console.log('Game started with directions: ', directions);
  document.getElementById('roomWaiting').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  setupGame();
});

socket.on('updateDirection', (data) => {
  console.log(`Received direction update: ${data.direction}`);
  currentDirection = data.direction;
  directionChanged = true; // Ensure we don't change direction multiple times in one frame
});

socket.on('foodPositionUpdate', (newFood) => {
  console.log(`New food position received: ${newFood.x}, ${newFood.y}`);
  food = newFood;
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

function setupGame() {
  snake = [{ x: 10, y: 10 }];
  currentDirection = 'right';

  document.addEventListener('keydown', handleKeydown);

  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }
  gameLoopInterval = setInterval(gameLoop, 100);

  displayPlayerDirections(); // Display player directions
  document.getElementById('controlButtons').style.display = 'block'; // Show control buttons
}

function handleKeydown(event) {
  const key = event.keyCode;
  if (directionChanged) return; // Prevent changing direction twice in the same frame

  let newDirection;
  if (directions[playerIndex]?.includes('up') && key === 38 && currentDirection !== 'down') { // UP arrow
    newDirection = 'up';
  } else if (directions[playerIndex]?.includes('down') && key === 40 && currentDirection !== 'up') { // DOWN arrow
    newDirection = 'down';
  } else if (directions[playerIndex]?.includes('left') && key === 37 && currentDirection !== 'right') { // LEFT arrow
    newDirection = 'left';
  } else if (directions[playerIndex]?.includes('right') && key === 39 && currentDirection !== 'left') { // RIGHT arrow
    newDirection = 'right';
  }

  if (newDirection) {
    currentDirection = newDirection;
    directionChanged = true;
    console.log(`Emitting directionChange: ${currentDirection}`);
    socket.emit('directionChange', { roomId, direction: currentDirection });
  }
}

function changeDirection(newDirection) {
  if (directionChanged) return; // Prevent changing direction twice in the same frame

  if (directions[playerIndex]?.includes(newDirection) && isValidDirection(newDirection)) {
    currentDirection = newDirection;
    directionChanged = true;
    console.log(`Emitting directionChange: ${currentDirection}`);
    socket.emit('directionChange', { roomId, direction: currentDirection });
  }
}

function isValidDirection(newDirection) {
  if (newDirection === 'up' && currentDirection !== 'down') return true;
  if (newDirection === 'down' && currentDirection !== 'up') return true;
  if (newDirection === 'left' && currentDirection !== 'right') return true;
  if (newDirection === 'right' && currentDirection !== 'left') return true;
  return false;
}

function updateGame() {
  if (!Array.isArray(snake) || snake.length === 0) {
    console.error("Snake is not initialized properly or is empty.");
    return;
  }

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
    console.log("Food eaten");
    snake.unshift(head); // Grow the snake
    socket.emit('foodEaten', { roomId, snake });
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
  ctx.fillStyle = '#00FF00'; // Retro green color for snake
  ctx.strokeStyle = '#003300'; // Darker green for the border
  ctx.lineWidth = 2;

  for (let segment of snake) {
    ctx.fillRect(segment.x * 20, segment.y * 20, 20, 20);
    ctx.strokeRect(segment.x * 20, segment.y * 20, 20, 20);
  }

  // Draw the food
  ctx.fillStyle = '#FF0000'; // Retro red color for food
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

function displayPlayerDirections() {
  const playerDirectionsDiv = document.getElementById('playerDirections');
  const directionsList = directions[playerIndex].join(', ');
  playerDirectionsDiv.textContent = `You control: ${directionsList}`;
  playerDirectionsDiv.style.display = 'block';
}
