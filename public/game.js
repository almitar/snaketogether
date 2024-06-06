const socket = io();
let directions = [];

document.getElementById('createRoomButton').addEventListener('click', () => {
  const roomId = document.getElementById('roomIdInput').value;
  socket.emit('createRoom', roomId);
});

document.getElementById('joinRoomButton').addEventListener('click', () => {
  const roomId = document.getElementById('roomIdInput').value;
  socket.emit('joinRoom', roomId);
});

socket.on('startGame', (playerDirections) => {
  directions = playerDirections;
  setupGame();
});

socket.on('updateDirection', (direction) => {
  // Update snake direction
});

function setupGame() {
  let snake = [{x: 0, y: 0}];
  let direction = 'right';

  function updateGame() {
    // Update snake position based on direction
    // Check for collisions
  }

  function drawGame() {
    // Draw the game state
  }

  function keyPressed() {
    // Handle key presses based on assigned directions
    if (directions.includes('up') && keyCode === UP_ARROW) {
      direction = 'up';
      socket.emit('directionChange', direction);
    }
    // Similar for other directions
  }

  function gameLoop() {
    updateGame();
    drawGame();
  }

  setInterval(gameLoop, 100);
}
