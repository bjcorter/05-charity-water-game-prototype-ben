// Charity Water Game Prototype

// Get DOM elements
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMessage = document.getElementById('overlay-message');
const startBtn = document.getElementById('start-btn');
const gameBoard = document.getElementById('game-board');
const scoreSpan = document.getElementById('score');
const timerSpan = document.getElementById('timer');
const livesSpan = document.getElementById('lives');

// Get reset overlay and button, and win animation container
const resetOverlay = document.getElementById('reset-overlay');
const resetBtn = document.getElementById('reset-btn');
const winAnimation = document.getElementById('win-animation');

// Game settings
const boardSize = 30; // 30x30 grid (twice as large)
const wall = 1, empty = 0, water = 2, home = 3;
let board = [];
let player = { x: 1, y: 1, carrying: false };
let enemies = [];
let waters = [];
let homes = [];
let score = 0;
let timer = 0;
let lives = 3;
let intervalId = null;
let timerId = null;
let gameActive = false;

// Use a global maze variable
let maze = [];

// Generate a Pac-Man-like maze with multiple routes and loops
function generatePacmanMaze(size) {
    // Start with all walls
    const maze = [];
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            row.push(1);
        }
        maze.push(row);
    }

    // Carve out a grid of open cells with some loops
    for (let y = 1; y < size - 1; y += 2) {
        for (let x = 1; x < size - 1; x += 2) {
            maze[y][x] = 0; // Open cell
            // Randomly connect to right and down to make loops
            if (x + 2 < size - 1 && Math.random() > 0.2) {
                maze[y][x + 1] = 0;
            }
            if (y + 2 < size - 1 && Math.random() > 0.2) {
                maze[y + 1][x] = 0;
            }
        }
    }

    // Add some extra random openings for more routes
    for (let i = 0; i < size * 2; i++) {
        const x = 1 + Math.floor(Math.random() * (size - 2));
        const y = 1 + Math.floor(Math.random() * (size - 2));
        maze[y][x] = 0;
    }

    // Make sure borders are walls
    for (let i = 0; i < size; i++) {
        maze[0][i] = 1;
        maze[size - 1][i] = 1;
        maze[i][0] = 1;
        maze[i][size - 1] = 1;
    }

    return maze;
}

// Helper to deep copy the maze
function copyMaze() {
    // Always copy the current maze
    return maze.map(row => row.slice());
}

// Helper function to get all reachable empty cells from the player's start position
function getReachableCells(board, startX, startY) {
    const visited = Array.from({length: boardSize}, () => Array(boardSize).fill(false));
    const reachable = [];
    const queue = [];
    queue.push({x: startX, y: startY});
    visited[startY][startX] = true;

    while (queue.length > 0) {
        const {x, y} = queue.shift();
        reachable.push({x, y});
        // Check all four directions
        const dirs = [
            {dx: 0, dy: -1},
            {dx: 0, dy: 1},
            {dx: -1, dy: 0},
            {dx: 1, dy: 0}
        ];
        for (const dir of dirs) {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            if (
                nx >= 0 && nx < boardSize &&
                ny >= 0 && ny < boardSize &&
                !visited[ny][nx] &&
                board[ny][nx] === empty
            ) {
                visited[ny][nx] = true;
                queue.push({x: nx, y: ny});
            }
        }
    }
    return reachable;
}

// Place water cans and homes randomly on accessible empty cells
function placeWatersAndHomes() {
    waters = [];
    homes = [];
    // Get all reachable empty cells from player start
    const reachable = getReachableCells(board, 1, 1);
    // Shuffle reachable cells
    const shuffled = reachable.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let idx = 0;
    // Place 5 water cans
    let placedWaters = 0;
    while (placedWaters < 5 && idx < shuffled.length) {
        const {x, y} = shuffled[idx++];
        if (board[y][x] === empty && !(x === player.x && y === player.y)) {
            board[y][x] = water;
            waters.push({x, y});
            placedWaters++;
        }
    }
    // Place 5 homes
    let placedHomes = 0;
    while (placedHomes < 5 && idx < shuffled.length) {
        const {x, y} = shuffled[idx++];
        if (board[y][x] === empty && !(x === player.x && y === player.y)) {
            board[y][x] = home;
            homes.push({x, y});
            placedHomes++;
        }
    }
}

// Place enemies (dirty droplets) randomly on accessible empty cells
function placeEnemies() {
    enemies = [];
    // Get all reachable empty cells from player start
    const reachable = getReachableCells(board, 1, 1);
    // Shuffle reachable cells
    const shuffled = reachable.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let idx = 0;
    let placed = 0;
    while (placed < 3 && idx < shuffled.length) {
        const {x, y} = shuffled[idx++];
        if (board[y][x] === empty && !(x === player.x && y === player.y)) {
            enemies.push({x, y, dir: Math.floor(Math.random()*4)});
            placed++;
        }
    }
}

// Draw the board and all elements
function drawBoard() {
    gameBoard.innerHTML = '';
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            if (board[y][x] === wall) cell.classList.add('wall');
            if (board[y][x] === water) cell.classList.add('water');
            if (board[y][x] === home) cell.classList.add('home');
            // Place player
            if (player.x === x && player.y === y) {
                cell.classList.add('player');
                // Show if carrying water
                cell.title = player.carrying ? 'Carrying water' : 'Not carrying water';
            }
            // Place enemies
            for (const enemy of enemies) {
                if (enemy.x === x && enemy.y === y) {
                    cell.classList.add('enemy');
                }
            }
            gameBoard.appendChild(cell);
        }
    }
}

// Handle keyboard input for player movement (Arrow keys and WASD)
document.addEventListener('keydown', function(e) {
    // Prevent scrolling for arrow keys
    if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight'
    ) {
        e.preventDefault();
    }
    if (!gameActive) return;
    let dx = 0, dy = 0;
    // Arrow keys
    if (e.key === 'ArrowUp') dy = -1;
    if (e.key === 'ArrowDown') dy = 1;
    if (e.key === 'ArrowLeft') dx = -1;
    if (e.key === 'ArrowRight') dx = 1;
    // WASD keys
    if (e.key === 'w' || e.key === 'W') dy = -1;
    if (e.key === 's' || e.key === 'S') dy = 1;
    if (e.key === 'a' || e.key === 'A') dx = -1;
    if (e.key === 'd' || e.key === 'D') dx = 1;
    // Calculate new position
    const nx = player.x + dx;
    const ny = player.y + dy;
    // Check for wall
    if (board[ny] && board[ny][nx] !== undefined && board[ny][nx] !== wall) {
        player.x = nx;
        player.y = ny;

        // If player is not carrying water and steps on a water can
        if (board[ny][nx] === water && !player.carrying) {
            player.carrying = true; // Now carrying water
            board[ny][nx] = empty; // Remove water can from board
            // Remove from waters array
            waters = waters.filter(w => !(w.x === nx && w.y === ny));
        }

        // If player is carrying water and steps on a home
        if (board[ny][nx] === home && player.carrying) {
            player.carrying = false; // No longer carrying water
            score += 10; // Add points for delivery
            // Remove home from board
            board[ny][nx] = empty;
            homes = homes.filter(h => !(h.x === nx && h.y === ny));
            updateScore();
            // Check win condition: all water delivered and not carrying
            if (waters.length === 0 && player.carrying === false) {
                endGame(true);
            }
        }

        drawBoard();
    }
});

// Move enemies randomly
function moveEnemies() {
    for (const enemy of enemies) {
        // Try to move in current direction, else pick a new one
        let dirs = [
            {dx:0, dy:-1}, // up
            {dx:0, dy:1},  // down
            {dx:-1, dy:0}, // left
            {dx:1, dy:0}   // right
        ];
        let dir = dirs[enemy.dir];
        let nx = enemy.x + dir.dx;
        let ny = enemy.y + dir.dy;
        // If can't move, pick a new direction
        if (!board[ny] || board[ny][nx] === undefined || board[ny][nx] === wall) {
            enemy.dir = Math.floor(Math.random()*4);
        } else {
            enemy.x = nx;
            enemy.y = ny;
        }
        // Check collision with player
        if (enemy.x === player.x && enemy.y === player.y) {
            loseLife();
        }
    }
}

// Lose a life and reset player position
function loseLife() {
    lives--;
    updateLives();
    if (lives <= 0) {
        endGame(false);
        return;
    }
    // Reset player to start
    player.x = 1;
    player.y = 1;
    player.carrying = false;
    drawBoard();
}

// Update score display
function updateScore() {
    scoreSpan.textContent = `Score: ${score}`;
}

// Update timer display
function updateTimer() {
    timerSpan.textContent = `Time: ${timer}`;
}

// Update lives display
function updateLives() {
    livesSpan.textContent = `Lives: ${lives}`;
}

// Start the game
function startGame() {
    // Generate a new Pac-Man-like maze each time
    maze = generatePacmanMaze(boardSize); // set the global maze variable
    board = copyMaze();
    player = { x: 1, y: 1, carrying: false };
    score = 0;
    timer = 0;
    lives = 3;
    gameActive = true;
    updateScore();
    updateTimer();
    updateLives();
    placeWatersAndHomes();
    placeEnemies();
    drawBoard();
    overlay.style.display = 'none';
    // Start timer
    timerId = setInterval(() => {
        timer++;
        updateTimer();
    }, 1000);
    // Move enemies every 500ms
    intervalId = setInterval(() => {
        moveEnemies();
        drawBoard();
    }, 500);
}

// End the game (win or lose)
function endGame(win) {
    gameActive = false;
    clearInterval(intervalId);
    clearInterval(timerId);
    overlay.style.display = 'flex';
    if (win) {
        overlayTitle.textContent = 'You Win!';
        // Bonus score for fast time
        let bonus = Math.max(0, 50 - timer);
        score += bonus;
        overlayMessage.textContent = `All water delivered! Final Score: ${score} (Bonus: ${bonus})\nTime: ${timer}s`;
        startBtn.textContent = 'Play Again';
        // Show win animation
        showWinAnimation();
    } else {
        overlayTitle.textContent = 'Game Over';
        overlayMessage.textContent = `You lost all your lives.\nFinal Score: ${score}\nTime: ${timer}s`;
        startBtn.textContent = 'Play Again';
    }
    // After a short delay, show the reset overlay to play again
    setTimeout(() => {
        overlay.style.display = 'none';
        resetOverlay.style.display = 'flex';
    }, 1500);
}

// Show win animation (simple bouncing droplet)
function showWinAnimation() {
    winAnimation.innerHTML = '<div class="droplet"></div>';
    winAnimation.style.display = 'flex';
    // Hide animation after 2 seconds
    setTimeout(() => {
        winAnimation.style.display = 'none';
        winAnimation.innerHTML = '';
    }, 2000);
}

// Reset button event
resetBtn.onclick = function() {
    resetOverlay.style.display = 'none';
    startGame();
};

// Start button event
startBtn.onclick = startGame;

// Show overlay at start
overlay.style.display = 'flex';

// Initial draw (for debugging)
drawBoard();

// Start button event
startBtn.onclick = startGame;

// Show overlay at start
overlay.style.display = 'flex';

// Initial draw (for debugging)
drawBoard();
// Show overlay at start
overlay.style.display = 'flex';

// Initial draw (for debugging)
drawBoard();

