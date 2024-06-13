const socket = io();
let directions = [];
let targetPlayerCount = 0;
let currentPlayers = 0;
let roomId = getUrlParameter('roomId') || "";
let username = "";
let snake = [];
let food;
let gameLoopInterval;
let currentDirection = 'right';
let directionChanged = false;
let playerIndex = 0;
let lastUpdateTime = 0;
const snakeSpeed = 80; // Snake speed in milliseconds


document.addEventListener('DOMContentLoaded', (event) => {
  if (roomId) {
    document.getElementById('initialJoin').style.display = 'block';
  } else {
    document.getElementById('roomCreation').style.display = 'block';
  }

  document.getElementById('upButton').addEventListener('click', () => changeDirection('up', 'upButton'));
  document.getElementById('leftButton').addEventListener('click', () => changeDirection('left', 'leftButton'));
  document.getElementById('downButton').addEventListener('click', () => changeDirection('down', 'downButton'));
  document.getElementById('rightButton').addEventListener('click', () => changeDirection('right', 'rightButton'));
});

document.getElementById('createRoomButton').addEventListener('click', () => {
  username = document.getElementById('usernameInputCreate').value;
  targetPlayerCount = parseInt(document.getElementById('playerCount').value);

  if (!username) {
    alert('Please enter a username.');
    return;
  }

  const uniqueId = Date.now();
  roomId = `${uniqueId}`;

  console.log(`Creating room with ID: ${roomId} for ${targetPlayerCount} players`);
  socket.emit('createRoom', { roomId, targetPlayerCount, username });

  window.history.pushState({}, '', `?roomId=${roomId}`);

  document.getElementById('roomCreation').style.display = 'none';
  document.getElementById('roomWaiting').style.display = 'block';
  updateWaitingMessage();
});

document.getElementById('joinRoomButton').addEventListener('click', () => {
  username = document.getElementById('usernameInputJoin').value;
  if (!username) {
    alert('Please enter a username.');
    return;
  }
  console.log(`Joining room with ID: ${roomId}`);
  socket.emit('joinRoom', { roomId, username });

  document.getElementById('initialJoin').style.display = 'none';
  if (currentPlayers + 1 === targetPlayerCount) {
    document.getElementById('waitingMessage').style.display = 'none';
  }
  document.getElementById('roomWaiting').style.display = 'block';
});

document.getElementById('invitePlayersButton').addEventListener('click', () => {
  const inviteLink = `${window.location.origin}?roomId=${roomId}`;
  console.log('Invite link:', inviteLink);
  navigator.clipboard.writeText(inviteLink).then(() => {
    const inviteMessage = document.getElementById('inviteMessage');
    inviteMessage.textContent = `Link copied!`;
    inviteMessage.style.visibility = 'visible';
    setTimeout(() => {
      inviteMessage.style.visibility = 'hidden';
    }, 2000);
  }).catch(err => {
    console.error('Could not copy text: ', err);
  });
});

document.getElementById('invitePlayersModalButton').addEventListener('click', () => {
  const inviteLink = `${window.location.origin}?roomId=${roomId}`;
  navigator.clipboard.writeText(inviteLink).then(() => {
    alert('Invite link copied to clipboard!');
  }).catch(err => {
    console.error('Could not copy text: ', err);
  });
});

socket.on('playerJoined', (playerCount) => {
  currentPlayers = playerCount;
  updateWaitingMessage();
  if (typeof playerIndex !== 'undefined') {
    displayPlayerDirections();
  }
});

socket.on('setPlayerIndex', (index) => {
  playerIndex = index;
  if (directions.length > 0) {
    displayPlayerDirections();
  }
});

socket.on('setTargetPlayerCount', (count) => {
  targetPlayerCount = count;
  if (directions.length > 0) {
    displayPlayerDirections();
  }
});

socket.on('updateCountdown', (countdown) => {
  const inviteButton = document.getElementById('invitePlayersButton');
  if (countdown > 0) {
    inviteButton.style.display = 'none';
    document.getElementById('waitingMessage').textContent = `Game starting in ${countdown}...`;
    displayPlayerDirections();
  } else {
    document.getElementById('waitingMessage').textContent = `Game starting...`;
  }
});

socket.on('startGame', ({ directions: playerDirections, food: initialFood, snake: initialSnake }) => {
  directions = playerDirections;
  food = initialFood;
  snake = initialSnake;
  document.getElementById('roomWaiting').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  document.getElementById('playerDirections').style.display = 'none';
  setupGame();
});

socket.on('updateDirections', (updatedDirections) => {
  directions = updatedDirections;
  if (typeof playerIndex !== 'undefined') {
    displayPlayerDirections();
  }
});

socket.on('updateDirection', (data) => {
  currentDirection = data.direction;
  directionChanged = true;
});

socket.on('foodPositionUpdate', (newFood) => {
  food = newFood;
});

socket.on('playerDisconnected', ({ username, remainingPlayers, targetPlayerCount }) => {
  gameOver(username);
});

socket.on('playerReconnected', ({ username, remainingPlayers, targetPlayerCount }) => {
  const playersNeeded = targetPlayerCount - remainingPlayers;
  updateModal(`Player ${username} reconnected. Waiting for ${playersNeeded} player(s) to join.`, 30);
  if (remainingPlayers === targetPlayerCount) {
    closeModal();
    resumeGame();
  }
});

socket.on('ping', () => {
  socket.emit('pong');
});

function pauseGame() {
  clearInterval(gameLoopInterval);
}

function resumeGame() {
  gameLoopInterval = setInterval(gameLoop, 100);
}

function showModal(message, countdown) {
  const modal = document.getElementById('modal');
  const messageElement = document.getElementById('modalMessage');
  const countdownElement = document.getElementById('countdown');
  const inviteButton = document.getElementById('invitePlayersModalButton');

  messageElement.textContent = message;
  countdownElement.textContent = `Countdown: ${countdown}s`;
  inviteButton.style.display = 'block';
  modal.style.display = 'block';

  const countdownInterval = setInterval(() => {
    countdown--;
    countdownElement.textContent = `Countdown: ${countdown}s`;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      gameOver();
    }
  }, 1000);
}

function updateModal(message, countdown) {
  const messageElement = document.getElementById('modalMessage');
  const countdownElement = document.getElementById('countdown');
  messageElement.textContent = message;
  countdownElement.textContent = `Countdown: ${countdown}s`;
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
}

function gameOver(disconnectedUsername) {
  clearInterval(gameLoopInterval);
  const score = snake.length - 3;
  const message = disconnectedUsername 
    ? `Game over! Player ${disconnectedUsername} disconnected. Your score is ${score}.`
    : `Game Over! Your score is ${score}.`;
  document.getElementById('modalMessage').textContent = message;
  document.getElementById('modal').style.display = 'block';
  document.getElementById('playAgainButton').style.display = 'inline';
  document.getElementById('invitePlayersModalButton').style.display = 'none';
}

function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

function joinRoom(roomId) {
  socket.emit('joinRoom', roomId);
  document.getElementById('roomCreation').style.display = 'none';
  document.getElementById('roomWaiting').style.display = 'block';
}

function updateWaitingMessage() {
  const playersNeeded = targetPlayerCount - currentPlayers;
  document.getElementById('waitingMessage').textContent = `Waiting for ${playersNeeded} more player(s) to join...`;
}

function setupGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];
  currentDirection = 'right';
  document.addEventListener('keydown', handleKeydown);
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
  }
  requestAnimationFrame(gameLoop); // Use requestAnimationFrame for the game loop
  document.getElementById('controlButtons').style.display = 'block';
}

function handleKeydown(event) {
  const key = event.keyCode;
  if (directionChanged) return;
  let newDirection;
  if (directions[playerIndex]?.includes('up') && key === 38 && currentDirection !== 'down') {
    newDirection = 'up';
  } else if (directions[playerIndex]?.includes('down') && key === 40 && currentDirection !== 'up') {
    newDirection = 'down';
  } else if (directions[playerIndex]?.includes('left') && key === 37 && currentDirection !== 'right') {
    newDirection = 'left';
  } else if (directions[playerIndex]?.includes('right') && key === 39 && currentDirection !== 'left') {
    newDirection = 'right';
  }
  if (newDirection && newDirection !== currentDirection) {
    currentDirection = newDirection;
    directionChanged = true;
    socket.emit('directionChange', { roomId, direction: currentDirection });
    flashButton(newDirection);
  }
}

function flashButton(direction) {
  let buttonId;
  if (direction === 'up') buttonId = 'upButton';
  else if (direction === 'down') buttonId = 'downButton';
  else if (direction === 'left') buttonId = 'leftButton';
  else if (direction === 'right') buttonId = 'rightButton';
  const button = document.getElementById(buttonId);
  button.classList.add('active');
  setTimeout(() => {
    button.classList.remove('active');
  }, 200);
}

socket.on('updateSnake', (updatedSnake) => {
  snake = updatedSnake;
});

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
  if (head.x >= 20) head.x = 0;
  if (head.x < 0) head.x = 19;
  if (head.y >= 20) head.y = 0;
  if (head.y < 0) head.y = 19;
  for (let i = 1; i < snake.length; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) {
      gameOver();
      return;
    }
  }
  if (head.x === food.x && head.y === food.y) {
    snake.unshift(head);
    socket.emit('foodEaten', { roomId, snake });
  } else {
    snake.unshift(head);
    snake.pop();
  }
  directionChanged = false;
  socket.emit('updateSnake', { roomId, snake });
}

function drawGame() {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00FF00';
  ctx.strokeStyle = '#003300';
  ctx.lineWidth = 2;
  for (let segment of snake) {
    ctx.fillRect(segment.x * 20, segment.y * 20, 20, 20);
    ctx.strokeRect(segment.x * 20, segment.y * 20, 20, 20);
  }
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(food.x * 20, food.y * 20, 20, 20);
}

function gameLoop(timestamp) {
  if (!lastUpdateTime) lastUpdateTime = timestamp;
  const deltaTime = timestamp - lastUpdateTime;

  if (deltaTime > snakeSpeed) {
    updateGame();
    lastUpdateTime = timestamp;
  }

  drawGame();
  requestAnimationFrame(gameLoop);
}

function getPlayerDirections(playerIndex, targetPlayerCount) {
  if (targetPlayerCount === 1) {
    return ['up', 'down', 'left', 'right'];
  } else if (targetPlayerCount === 2) {
    const directions = [['up', 'down'], ['left', 'right']];
    return directions[playerIndex];
  } else if (targetPlayerCount === 4) {
    const directions = [['up'], ['right'], ['down'], ['left']];
    return directions[playerIndex];
  }
  return [];
}

function displayPlayerDirections() {
  const playerDirectionsDiv = document.getElementById('playerDirections');
  const playerDirections = getPlayerDirections(playerIndex, targetPlayerCount);
  console.log('Displaying player directions:', playerDirections);
  if (playerDirections && playerDirections.length > 0) {
    const directionsList = playerDirections.join(', ');
    playerDirectionsDiv.textContent = `You control: ${directionsList}`;
    playerDirectionsDiv.style.display = 'block';
  } else {
    console.log('No directions available for the player index:', playerIndex);
    playerDirectionsDiv.textContent = 'No directions available';
  }
}
