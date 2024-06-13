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

  // Generate a unique identifier for the room
  const uniqueId = Date.now();
  roomId = `${uniqueId}`;

  console.log(`Creating room with ID: ${roomId} for ${targetPlayerCount} players`);
  socket.emit('createRoom', { roomId, targetPlayerCount, username });

  // Update the URL to include the unique room ID
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
  // Avoid displaying the waiting message if the game is about to start
  if (currentPlayers + 1 === targetPlayerCount) {
    document.getElementById('waitingMessage').style.display = 'none';
  }
  document.getElementById('roomWaiting').style.display = 'block';
  // No need to call displayPlayerDirections here as directions are not set yet
});

document.getElementById('invitePlayersButton').addEventListener('click', () => {
  const inviteLink = `${window.location.origin}?roomId=${roomId}`;

  console.log('Invite link:', inviteLink); // Debugging log

  navigator.clipboard.writeText(inviteLink).then(() => {
    const inviteMessage = document.getElementById('inviteMessage');
    inviteMessage.textContent = `Link copied!`;
    inviteMessage.style.visibility = 'visible';

    // Hide the message after 3 seconds
    setTimeout(() => {
      inviteMessage.style.visibility = 'hidden';
    }, 2000);
  }).catch(err => {
    console.error('Could not copy text: ', err); // Error handling for debugging
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
  console.log('Received playerJoined event with playerCount:', playerCount);
  currentPlayers = playerCount;
  console.log(`Player joined. Current players: ${currentPlayers}`);
  updateWaitingMessage();
  
  // Call displayPlayerDirections if playerIndex is already set
  if (typeof playerIndex !== 'undefined') {
    displayPlayerDirections();
  }
});

socket.on('setPlayerIndex', (index) => {
  playerIndex = index;
  console.log(`Player index set to: ${index}`);
  // Call displayPlayerDirections if directions are already received
  if (directions.length > 0) {
    displayPlayerDirections();
  }
});

socket.on('setTargetPlayerCount', (count) => {
  targetPlayerCount = count;
  console.log(`Target player count set to: ${targetPlayerCount}`);
  // Call displayPlayerDirections if directions are already received
  if (directions.length > 0) {
    displayPlayerDirections();
  }
});

socket.on('updateCountdown', (countdown) => {
  console.log(`Countdown: ${countdown}`);
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
  snake = initialSnake; // Initialize the snake with the initial state from the server
  console.log('Game started with directions: ', directions);
  document.getElementById('roomWaiting').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'block';
  document.getElementById('playerDirections').style.display = 'none'; // Hide player directions
  setupGame();
});


socket.on('updateDirections', (updatedDirections) => {
  directions = updatedDirections;
  console.log('Updated directions received: ', directions);
  // Call displayPlayerDirections if playerIndex is already set
  if (typeof playerIndex !== 'undefined') {
    displayPlayerDirections();
  }
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

// Event listener for player disconnection
socket.on('playerDisconnected', ({ username, remainingPlayers, targetPlayerCount }) => {
  console.log(`Received playerDisconnected event: Player ${username} disconnected. Remaining players: ${remainingPlayers}`);
  gameOver(username); // Trigger game over with the disconnected player's username
});

// Event listener for player reconnection
socket.on('playerReconnected', ({ username, remainingPlayers, targetPlayerCount }) => {
  console.log(`Received playerReconnected event: Player ${username} reconnected. Remaining players: ${remainingPlayers}`);
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

// Pause game function
function pauseGame() {
  clearInterval(gameLoopInterval);
}

// Resume game function
function resumeGame() {
  gameLoopInterval = setInterval(gameLoop, 100);
}

// Show modal function
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

// Update modal function
function updateModal(message, countdown) {
  const messageElement = document.getElementById('modalMessage');
  const countdownElement = document.getElementById('countdown');

  messageElement.textContent = message;
  countdownElement.textContent = `Countdown: ${countdown}s`;
}

// Close modal function
function closeModal() {
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
}

// Game over function
function gameOver(disconnectedUsername) {
  clearInterval(gameLoopInterval);
  const score = snake.length - 3;
  const message = disconnectedUsername 
    ? `Game over! Player ${disconnectedUsername} disconnected. Your score is ${score}.`
    : `Game Over! Your score is ${score}.`;
  document.getElementById('modalMessage').textContent = message;
  document.getElementById('modal').style.display = 'block';
  document.getElementById('playAgainButton').style.display = 'inline';
  // Optionally, hide invite players button if you want
  document.getElementById('invitePlayersModalButton').style.display = 'none';
}

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
  // No need to call displayPlayerDirections here as directions are not set yet
}

function updateWaitingMessage() {
  console.log(`Target players: ${targetPlayerCount}, Current players: ${currentPlayers}`);
  const playersNeeded = targetPlayerCount - currentPlayers;
  document.getElementById('waitingMessage').textContent = `Waiting for ${playersNeeded} more player(s) to join...`;
}

function setupGame() {
  // Initialize the snake with 3 segments
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
  gameLoopInterval = setInterval(gameLoop, 100);

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

  if (newDirection && newDirection !== currentDirection) {
    currentDirection = newDirection;
    directionChanged = true;
    console.log(`Emitting directionChange: ${currentDirection}`);
    socket.emit('directionChange', { roomId, direction: currentDirection });
    flashButton(newDirection);
  }
}

function changeDirection(newDirection, buttonId) {
  if (directionChanged || newDirection === currentDirection) return; // Prevent changing direction twice in the same frame

  if (directions[playerIndex]?.includes(newDirection) && isValidDirection(newDirection)) {
    currentDirection = newDirection;
    directionChanged = true;
    console.log(`Emitting directionChange: ${currentDirection}`);
    socket.emit('directionChange', { roomId, direction: currentDirection });
    flashButton(buttonId);
  }
}

function isValidDirection(newDirection) {
  if (newDirection === 'up' && currentDirection !== 'down') return true;
  if (newDirection === 'down' && currentDirection !== 'up') return true;
  if (newDirection === 'left' && currentDirection !== 'right') return true;
  if (newDirection === 'right' && currentDirection !== 'left') return true;
  return false;
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
  
  // Emit the snake's position to the server
  socket.emit('updateSnake', { roomId, snake });
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
  console.log('Displaying player directions:', playerDirections); // Log current directions for debugging
  if (playerDirections && playerDirections.length > 0) {
    const directionsList = playerDirections.join(', ');
    playerDirectionsDiv.textContent = `You control: ${directionsList}`;
    playerDirectionsDiv.style.display = 'block';
  } else {
    console.log('No directions available for the player index:', playerIndex);
    playerDirectionsDiv.textContent = 'No directions available';
  }
}
