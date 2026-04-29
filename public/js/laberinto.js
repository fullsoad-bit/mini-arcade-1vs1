const canvasL = document.createElement('canvas');
const ctxL = canvasL.getContext('2d');

canvasL.width = 400;
canvasL.height = 400;
canvasL.style.cssText = "background:#0d0208; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let mazeRoomId = null;
let mazeRole = ""; 
let isMazeActive = false;

const POS_ORIGINAL = { p1: {x: 60, y: 60}, p2: {x: 340, y: 340} };

let player1 = { x: POS_ORIGINAL.p1.x, y: POS_ORIGINAL.p1.y, score: 0, role: "presa", speed: 4 };
let player2 = { x: POS_ORIGINAL.p2.x, y: POS_ORIGINAL.p2.y, score: 0, role: "cazador", speed: 4 };
let timerPrey = 15; 
let mazeTimerInterval;

let berry = { x: -100, y: -100, active: false };
let speedTimeout = null;

// JOYSTICK VARIABLES
let joystick = { active: false, baseX: 0, baseY: 0, stickX: 0, stickY: 0, dx: 0, dy: 0 };

const mazeLayout = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,1],
    [1,1,1,1,0,1,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,0,1],
    [1,1,1,1,1,1,1,1,1,1]
];
const TILE_SIZE = 40;

function startLaberinto(roomId, isHost) {
    mazeRoomId = roomId.toString();
    mazeRole = isHost ? 'host' : 'guest';
    isMazeActive = true;
    
    player1.score = 0;
    player2.score = 0;
    resetPositions();

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasL);
    
    // Iniciar nuevo sistema de Joystick
    setupJoystick(container);

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isMazeActive || data.type !== 'maze_sync') return;
        if (mazeRole === 'host') {
            player2.x = data.px; player2.y = data.py;
        } else {
            player1.x = data.px; player1.y = data.py;
            player1.role = data.p1Role; player2.role = data.p2Role;
            player1.score = data.p1Score; player2.score = data.p2Score;
            timerPrey = data.timer; berry = data.berry;
            if (data.reset) resetPositions();
        }
    });

    if (isHost) {
        if (mazeTimerInterval) clearInterval(mazeTimerInterval);
        mazeTimerInterval = setInterval(logicTick, 1000);
        spawnBerry();
    }
    
    renderMaze();
}

function resetPositions() {
    player1.x = POS_ORIGINAL.p1.x; player1.y = POS_ORIGINAL.p1.y;
    player2.x = POS_ORIGINAL.p2.x; player2.y = POS_ORIGINAL.p2.y;
    player1.speed = 4; player2.speed = 4;
    timerPrey = 15;
}

function broadcastMaze(didReset = false) {
    let my = (mazeRole === 'host') ? player1 : player2;
    socket.emit('sync', {
        roomId: mazeRoomId, type: 'maze_sync',
        px: my.x, py: my.y,
        p1Role: player1.role, p2Role: player2.role,
        p1Score: player1.score, p2Score: player2.score,
        timer: timerPrey, berry: berry, reset: didReset
    });
}

function logicTick() {
    if (!isMazeActive) return;
    if (timerPrey > 0) {
        timerPrey--;
    } else {
        if (player1.role === "presa") player1.score++; else player2.score++;
        swapRoles();
    }
    broadcastMaze();
    checkWinCondition();
}

function swapRoles() {
    player1.role = (player1.role === "cazador") ? "presa" : "cazador";
    player2.role = (player2.role === "cazador") ? "presa" : "cazador";
    resetPositions();
    spawnBerry();
    broadcastMaze(true);
}

function checkWinCondition() {
    if (player1.score >= 3 || player2.score >= 3) {
        isMazeActive = false;
        clearInterval(mazeTimerInterval);
        let winner = player1.score >= 3 ? "JUGADOR 1 (HOST)" : "JUGADOR 2 (GUEST)";
        alert(`🏆 ¡FIN DEL JUEGO! 🏆\n${winner}`);
        window.location.reload();
    }
}

function spawnBerry() {
    berry = { x: Math.floor(Math.random() * 8 + 1) * TILE_SIZE + 20, y: Math.floor(Math.random() * 8 + 1) * TILE_SIZE + 20, active: true };
}

// Bucle de movimiento suave
function updateMovement() {
    if (!isMazeActive || !joystick.active) return;

    let my = (mazeRole === 'host') ? player1 : player2;
    let nextX = my.x + (joystick.dx * my.speed);
    let nextY = my.y + (joystick.dy * my.speed);

    // Colisión mejorada con muros
    const margin = 12;
    const canMove = (nx, ny) => {
        let checkPoints = [{x: nx-margin, y: ny-margin}, {x: nx+margin, y: ny-margin}, {x: nx-margin, y: ny+margin}, {x: nx+margin, y: ny+margin}];
        return checkPoints.every(p => {
            let gx = Math.floor(p.x / TILE_SIZE);
            let gy = Math.floor(p.y / TILE_SIZE);
            return mazeLayout[gy] && mazeLayout[gy][gx] === 0;
        });
    };

    if (canMove(nextX, nextY)) {
        my.x = nextX; my.y = nextY;
    } else if (canMove(nextX, my.y)) {
        my.x = nextX; // Deslizar en X
    } else if (canMove(my.x, nextY)) {
        my.y = nextY; // Deslizar en Y
    }

    // Captura (Host detecta)
    if (mazeRole === 'host') {
        let dist = Math.sqrt(Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2));
        if (dist < 28) {
            if (player1.role === "cazador") player1.score++; else player2.score++;
            swapRoles();
        }
    }

    // Item velocidad
    if (berry.active) {
        let dF = Math.sqrt(Math.pow(my.x - berry.x, 2) + Math.pow(my.y - berry.y, 2));
        if (dF < 22) {
            berry.active = false;
            my.speed = 6.5;
            setTimeout(() => { my.speed = 4; }, 5000);
        }
    }
    broadcastMaze();
}

function renderMaze() {
    if (!isMazeActive) return;
    updateMovement();
    
    ctxL.fillStyle = "#0d0208";
    ctxL.fillRect(0, 0, 400, 400);

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if (mazeLayout[r][c] === 1) {
                ctxL.fillStyle = "#1a1a2e";
                ctxL.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                ctxL.strokeStyle = "#39FF14";
                ctxL.strokeRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    if (berry.active) {
        ctxL.font = "24px Arial";
        ctxL.fillText("🍓", berry.x - 12, berry.y + 10);
    }

    drawPlayer(player1);
    drawPlayer(player2);

    ctxL.fillStyle = "rgba(0,0,0,0.8)";
    ctxL.fillRect(0,0,400,35);
    ctxL.fillStyle = "white";
    ctxL.font = "bold 13px Arial";
    ctxL.fillText(`⏱️ ESCAPE: ${timerPrey}s | P1: ${player1.score} | P2: ${player2.score}`, 10, 22);

    requestAnimationFrame(renderMaze);
}

function drawPlayer(p) {
    ctxL.font = "30px Arial";
    ctxL.textAlign = "center";
    ctxL.textBaseline = "middle";
    ctxL.fillText(p.role === "cazador" ? "🐱" : "🐭", p.x, p.y);
}

// --- SISTEMA DE JOYSTICK ---
function setupJoystick(cont) {
    const joyContainer = document.createElement('div');
    joyContainer.style.cssText = "width:150px; height:150px; background:rgba(255,255,255,0.1); border:3px solid #39FF14; border-radius:50%; margin:20px auto; position:relative; touch-action:none;";
    
    const stick = document.createElement('div');
    stick.style.cssText = "width:60px; height:60px; background:#FF00FF; border-radius:50%; position:absolute; top:45px; left:45px; box-shadow:0 0 15px #FF00FF;";
    
    joyContainer.appendChild(stick);
    cont.appendChild(joyContainer);

    const handleTouch = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = joyContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let diffX = touch.clientX - centerX;
        let diffY = touch.clientY - centerY;
        let distance = Math.sqrt(diffX*diffX + diffY*diffY);
        let maxDist = 50;

        if (distance > maxDist) {
            diffX = (diffX / distance) * maxDist;
            diffY = (diffY / distance) * maxDist;
        }

        joystick.dx = diffX / maxDist;
        joystick.dy = diffY / maxDist;
        joystick.active = true;
        
        stick.style.transform = `translate(${diffX}px, ${diffY}px)`;
    };

    joyContainer.addEventListener('touchstart', handleTouch);
    joyContainer.addEventListener('touchmove', handleTouch);
    joyContainer.addEventListener('touchend', () => {
        joystick.active = false;
        joystick.dx = 0; joystick.dy = 0;
        stick.style.transform = `translate(0px, 0px)`;
    });
}
