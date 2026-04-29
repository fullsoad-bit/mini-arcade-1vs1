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
let joystick = { active: false, dx: 0, dy: 0 };

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
    setupJoystick(container);

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isMazeActive) return;

        if (data.type === 'maze_sync') {
            if (mazeRole === 'host') {
                player2.x = data.px; player2.y = data.py;
            } else {
                player1.x = data.px; player1.y = data.py;
                player1.role = data.p1Role; player2.role = data.p2Role;
                player1.score = data.p1Score; player2.score = data.p2Score;
                timerPrey = data.timer; berry = data.berry;
                if (data.reset) resetPositions();
            }
        }
        
        // CORRECCIÓN: Escuchar el final del juego siendo Guest
        if (data.type === 'maze_end') {
            showEndMessage(data.winner);
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
    if (mazeRole === 'host' && (player1.score >= 3 || player2.score >= 3)) {
        let winnerName = player1.score >= 3 ? "JUGADOR 1 (HOST)" : "JUGADOR 2 (GUEST)";
        socket.emit('sync', { roomId: mazeRoomId, type: 'maze_end', winner: winnerName });
        showEndMessage(winnerName);
    }
}

// CORRECCIÓN: Función de fin de juego para ambos
function showEndMessage(winner) {
    isMazeActive = false;
    clearInterval(mazeTimerInterval);
    setTimeout(() => {
        alert(`🏆 ¡PARTIDA TERMINADA! 🏆\nGanador: ${winner}`);
        window.location.reload();
    }, 100);
}

// CORRECCIÓN: Spawn solo en caminos (ceros)
function spawnBerry() {
    let validSpots = [];
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            if (mazeLayout[r][c] === 0) validSpots.push({c, r});
        }
    }
    let spot = validSpots[Math.floor(Math.random() * validSpots.length)];
    berry = { 
        x: spot.c * TILE_SIZE + 20, 
        y: spot.r * TILE_SIZE + 20, 
        active: true 
    };
}

function updateMovement() {
    if (!isMazeActive || !joystick.active) return;

    let my = (mazeRole === 'host') ? player1 : player2;
    let nextX = my.x + (joystick.dx * my.speed);
    let nextY = my.y + (joystick.dy * my.speed);

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
    } else {
        if (canMove(nextX, my.y)) my.x = nextX;
        if (canMove(my.x, nextY)) my.y = nextY;
    }

    if (mazeRole === 'host') {
        let dist = Math.sqrt(Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2));
        if (dist < 28) {
            if (player1.role === "cazador") player1.score++; else player2.score++;
            swapRoles();
        }
    }

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

function broadcastMaze(didReset = false) {
    if (mazeRole === 'host' || !didReset) {
        let my = (mazeRole === 'host') ? player1 : player2;
        socket.emit('sync', {
            roomId: mazeRoomId, type: 'maze_sync',
            px: my.x, py: my.y,
            p1Role: player1.role, p2Role: player2.role,
            p1Score: player1.score, p2Score: player2.score,
            timer: timerPrey, berry: berry, reset: didReset
        });
    }
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
    ctxL.fillText(`⏱️ ${timerPrey}s | P1: ${player1.score} | P2: ${player2.score}`, 10, 22);

    requestAnimationFrame(renderMaze);
}

function drawPlayer(p) {
    ctxL.font = "30px Arial";
    ctxL.textAlign = "center";
    ctxL.textBaseline = "middle";
    ctxL.fillText(p.role === "cazador" ? "🐱" : "🐭", p.x, p.y);
}

function setupJoystick(cont) {
    const joyContainer = document.createElement('div');
    joyContainer.style.cssText = "width:120px; height:120px; background:rgba(255,255,255,0.1); border:2px solid #39FF14; border-radius:50%; margin:15px auto; position:relative; touch-action:none;";
    
    const stick = document.createElement('div');
    stick.style.cssText = "width:50px; height:50px; background:#FF00FF; border-radius:50%; position:absolute; top:35px; left:35px; box-shadow:0 0 10px #FF00FF;";
    
    joyContainer.appendChild(stick);
    cont.appendChild(joyContainer);

    const handleTouch = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = joyContainer.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        
        let dx = t.clientX - cx;
        let dy = t.clientY - cy;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let max = 40;

        if (dist > max) {
            dx = (dx / dist) * max;
            dy = (dy / dist) * max;
        }

        joystick.dx = dx / max;
        joystick.dy = dy / max;
        joystick.active = true;
        stick.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    joyContainer.addEventListener('touchstart', handleTouch);
    joyContainer.addEventListener('touchmove', handleTouch);
    joyContainer.addEventListener('touchend', () => {
        joystick.active = false;
        joystick.dx = 0; joystick.dy = 0;
        stick.style.transform = `translate(0px, 0px)`;
    });
}
