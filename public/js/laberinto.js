const canvasL = document.createElement('canvas');
const ctxL = canvasL.getContext('2d');

canvasL.width = 400;
canvasL.height = 400;
canvasL.style.cssText = "background:#0d0208; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let mazeRoomId = null;
let mazeRole = ""; 
let isMazeActive = false;

// Configuración de Jugadores
// Posiciones originales: P1 arriba-izquierda, P2 abajo-derecha
const POS_ORIGINAL = { p1: {x: 60, y: 60}, p2: {x: 340, y: 340} };

let player1 = { x: POS_ORIGINAL.p1.x, y: POS_ORIGINAL.p1.y, score: 0, role: "presa", speed: 4 };
let player2 = { x: POS_ORIGINAL.p2.x, y: POS_ORIGINAL.p2.y, score: 0, role: "cazador", speed: 4 };
let timerPrey = 15; // Ahora son 15 segundos
let mazeTimerInterval;

let berry = { x: -100, y: -100, active: false };
let speedTimeout = null;

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
    setupContinuousControls(container);

    if (isHost) {
        if (mazeTimerInterval) clearInterval(mazeTimerInterval);
        mazeTimerInterval = setInterval(logicTick, 1000);
        spawnBerry();
    }
    
    renderMaze();
}

function resetPositions() {
    player1.x = POS_ORIGINAL.p1.x;
    player1.y = POS_ORIGINAL.p1.y;
    player2.x = POS_ORIGINAL.p2.x;
    player2.y = POS_ORIGINAL.p2.y;
    player1.speed = 4;
    player2.speed = 4;
    timerPrey = 15;
    if (speedTimeout) clearTimeout(speedTimeout);
}

// --- COMUNICACIÓN ---
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
        checkWinCondition();
    }
});

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

// --- LÓGICA ---
function logicTick() {
    if (timerPrey > 0) {
        timerPrey--;
    } else {
        // La presa escapó
        if (player1.role === "presa") player1.score++; else player2.score++;
        checkWinCondition();
        swapRoles();
    }
    broadcastMaze();
}

function swapRoles() {
    let temp = player1.role;
    player1.role = player2.role;
    player2.role = temp;
    resetPositions();
    spawnBerry();
    broadcastMaze(true);
}

function checkWinCondition() {
    if (player1.score >= 3 || player2.score >= 3) {
        isMazeActive = false;
        clearInterval(mazeTimerInterval);
        let winner = player1.score >= 3 ? "JUGADOR 1" : "JUGADOR 2";
        setTimeout(() => {
            alert(`🏆 ¡PARTIDA TERMINADA! 🏆\nGanador: ${winner}\n\nPuntaje: ${player1.score} - ${player2.score}`);
            window.location.reload();
        }, 100);
    }
}

function spawnBerry() {
    berry = { x: Math.floor(Math.random() * 8 + 1) * TILE_SIZE + 20, y: Math.floor(Math.random() * 8 + 1) * TILE_SIZE + 20, active: true };
}

function moveLogic(dx, dy) {
    if (!isMazeActive) return;
    let my = (mazeRole === 'host') ? player1 : player2;
    
    let nextX = my.x + (dx * my.speed);
    let nextY = my.y + (dy * my.speed);

    const margin = 12;
    let checkPoints = [
        {x: nextX - margin, y: nextY - margin},
        {x: nextX + margin, y: nextY - margin},
        {x: nextX - margin, y: nextY + margin},
        {x: nextX + margin, y: nextY + margin}
    ];

    let canMove = checkPoints.every(p => {
        let gx = Math.floor(p.x / TILE_SIZE);
        let gy = Math.floor(p.y / TILE_SIZE);
        return mazeLayout[gy] && mazeLayout[gy][gx] === 0;
    });

    if (canMove) {
        my.x = nextX;
        my.y = nextY;
    }

    // Colisión entre ellos (Solo el Host detecta capturas)
    if (mazeRole === 'host') {
        let dist = Math.sqrt(Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2));
        if (dist < 28) {
            if (player1.role === "cazador") player1.score++; else player2.score++;
            checkWinCondition();
            if (isMazeActive) swapRoles();
        }
    }

    // Colisión con Fruta
    if (berry.active) {
        let dF = Math.sqrt(Math.pow(my.x - berry.x, 2) + Math.pow(my.y - berry.y, 2));
        if (dF < 22) {
            berry.active = false;
            my.speed = 6.5;
            if (speedTimeout) clearTimeout(speedTimeout);
            speedTimeout = setTimeout(() => { my.speed = 4; }, 5000);
        }
    }
    broadcastMaze();
}

function renderMaze() {
    if (!isMazeActive) return;
    ctxL.fillStyle = "#0d0208";
    ctxL.fillRect(0, 0, 400, 400);

    // Dibujar paredes neón
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

    drawEmoji(player1);
    drawEmoji(player2);

    // HUD Actualizado
    ctxL.fillStyle = "rgba(0,0,0,0.7)";
    ctxL.fillRect(0,0,400,35);
    ctxL.fillStyle = "white";
    ctxL.font = "bold 13px Arial";
    ctxL.fillText(`🐁 ESCAPE: ${timerPrey}s`, 10, 22);
    ctxL.fillText(`P1: ${player1.score}/3 | P2: ${player2.score}/3`, 270, 22);

    requestAnimationFrame(renderMaze);
}

function drawEmoji(p) {
    ctxL.save();
    if (p.speed > 4) {
        ctxL.shadowBlur = 15;
        ctxL.shadowColor = "yellow";
    }
    ctxL.font = "30px Arial";
    ctxL.textAlign = "center";
    ctxL.textBaseline = "middle";
    let icon = p.role === "cazador" ? "🐱" : "🐭";
    ctxL.fillText(icon, p.x, p.y);
    ctxL.restore();
}

function setupContinuousControls(cont) {
    const d = document.createElement('div');
    d.style.cssText = "display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; width:210px; margin:15px auto;";
    
    const moveData = [
        {txt: "", dx: 0, dy: 0, skip: true}, {txt: "▲", dx: 0, dy: -1}, {txt: "", dx: 0, dy: 0, skip: true},
        {txt: "◀", dx: -1, dy: 0}, {txt: "▼", dx: 0, dy: 1}, {txt: "▶", dx: 1, dy: 0}
    ];

    moveData.forEach(m => {
        const btn = document.createElement('div');
        if (m.skip) {
            btn.style.visibility = "hidden";
        } else {
            btn.innerHTML = m.txt;
            btn.style.cssText = "width:65px; height:65px; background:#222; border:2px solid #39FF14; color:white; border-radius:15px; display:flex; align-items:center; justify-content:center; font-size:25px; user-select:none; touch-action:none;";
            
            let interval;
            const start = (e) => { 
                e.preventDefault(); 
                if(!interval) interval = setInterval(() => moveLogic(m.dx, m.dy), 20); 
            };
            const stop = () => { 
                clearInterval(interval); 
                interval = null; 
            };

            btn.addEventListener('touchstart', start);
            btn.addEventListener('touchend', stop);
            btn.addEventListener('mousedown', start);
            btn.addEventListener('mouseup', stop);
            btn.addEventListener('mouseleave', stop);
        }
        d.appendChild(btn);
    });
    cont.appendChild(d);
}
