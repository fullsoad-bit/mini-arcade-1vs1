const canvasL = document.createElement('canvas');
const ctxL = canvasL.getContext('2d');

canvasL.width = 400;
canvasL.height = 400;
canvasL.style.cssText = "background:#0d0208; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let mazeRoomId = null;
let mazeRole = ""; // "host" o "guest"
let isMazeActive = false;

// Configuración de Jugadores
let player1 = { x: 40, y: 40, color: "#39FF14", speed: 4, score: 0, role: "presa" };
let player2 = { x: 340, y: 340, color: "#FF00FF", speed: 4, score: 0, role: "cazador" };
let timerPrey = 20; // Cuenta regresiva de la presa
let mazeTimerInterval;

// Fruta (Power-up)
let berry = { x: -100, y: -100, active: false };
let speedTimeout = null;

// Laberinto (1 = pared, 0 = camino)
const mazeLayout = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,1,0,1],
    [1,1,1,0,1,1,0,1,0,1],
    [1,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1]
];
const TILE_SIZE = 40;

function startLaberinto(roomId, isHost) {
    mazeRoomId = roomId.toString();
    mazeRole = isHost ? 'host' : 'guest';
    isMazeActive = true;
    
    // Inicializar roles
    player1.role = "presa";
    player2.role = "cazador";
    timerPrey = 20;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasL);
    setupMazeControls(container);

    if (isHost) {
        mazeTimerInterval = setInterval(logicTick, 1000);
        spawnBerry();
    }
    
    renderMaze();
}

// --- COMUNICACIÓN ---
socket.on('sync', (data) => {
    if (!isMazeActive || data.type !== 'maze_sync') return;

    if (mazeRole === 'host') {
        player2.x = data.px;
        player2.y = data.py;
    } else {
        player1.x = data.px;
        player1.y = data.py;
        player1.role = data.p1Role;
        player2.role = data.p2Role;
        player1.score = data.p1Score;
        player2.score = data.p2Score;
        timerPrey = data.timer;
        berry = data.berry;
    }
});

function broadcastMaze() {
    let my = (mazeRole === 'host') ? player1 : player2;
    socket.emit('sync', {
        roomId: mazeRoomId,
        type: 'maze_sync',
        px: my.x, py: my.y,
        p1Role: player1.role, p2Role: player2.role,
        p1Score: player1.score, p2Score: player2.score,
        timer: timerPrey, berry: berry
    });
}

// --- LÓGICA ---
function logicTick() {
    if (timerPrey > 0) {
        timerPrey--;
    } else {
        // La presa escapó 20 segundos
        if (player1.role === "presa") player1.score++;
        else player2.score++;
        swapRoles();
    }
    broadcastMaze();
}

function swapRoles() {
    let temp = player1.role;
    player1.role = player2.role;
    player2.role = temp;
    timerPrey = 20;
    spawnBerry();
}

function spawnBerry() {
    berry = { x: Math.floor(Math.random() * 8 + 1) * TILE_SIZE + 10, y: Math.floor(Math.random() * 8 + 1) * TILE_SIZE + 10, active: true };
}

function movePlayer(dx, dy) {
    if (!isMazeActive) return;
    let my = (mazeRole === 'host') ? player1 : player2;
    
    let nextX = my.x + (dx * my.speed);
    let nextY = my.y + (dy * my.speed);

    // Colisión con paredes
    let gridX = Math.floor(nextX / TILE_SIZE);
    let gridY = Math.floor(nextY / TILE_SIZE);
    
    if (mazeLayout[gridY][gridX] === 0) {
        my.x = nextX;
        my.y = nextY;
    }

    // Colisión con el otro jugador (Captura)
    let dist = Math.sqrt(Math.pow(player1.x - player2.x, 2) + Math.pow(player1.y - player2.y, 2));
    if (dist < 25 && mazeRole === 'host') {
        if (player1.role === "cazador") player1.score++; else player2.score++;
        swapRoles();
    }

    // Colisión con Fruta 🍓
    if (berry.active) {
        let dF = Math.sqrt(Math.pow(my.x - berry.x, 2) + Math.pow(my.y - berry.y, 2));
        if (dF < 20) {
            berry.active = false;
            my.speed = 7;
            if (speedTimeout) clearTimeout(speedTimeout);
            speedTimeout = setTimeout(() => { my.speed = 4; }, 5000);
        }
    }
    broadcastMaze();
}

function renderMaze() {
    if (!isMazeActive) return;
    ctxL.clearRect(0, 0, 400, 400);

    // Dibujar Laberinto
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

    // Dibujar Fruta 🍓
    if (berry.active) {
        ctxL.font = "20px Arial";
        ctxL.fillText("🍓", berry.x - 10, berry.y + 10);
    }

    // Dibujar Jugadores
    drawPlayer(player1);
    drawPlayer(player2);

    // UI
    ctxL.fillStyle = "white";
    ctxL.font = "bold 12px Arial";
    ctxL.fillText(`TIEMPO PRESA: ${timerPrey}s`, 10, 20);
    ctxL.fillText(`P1: ${player1.score} | P2: ${player2.score}`, 280, 20);

    requestAnimationFrame(renderMaze);
}

function drawPlayer(p) {
    ctxL.beginPath();
    ctxL.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctxL.fillStyle = p.role === "cazador" ? "#FF00FF" : "#39FF14"; // Cazador Rosa, Presa Verde
    ctxL.fill();
    ctxL.strokeStyle = "white";
    ctxL.stroke();
    // Brillo si tiene velocidad
    if (p.speed > 4) {
        ctxL.shadowBlur = 15;
        ctxL.shadowColor = "yellow";
    } else { ctxL.shadowBlur = 0; }
}

function setupMazeControls(cont) {
    const d = document.createElement('div');
    d.style.cssText = "display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; width:200px; margin:10px auto;";
    const bS = "width:60px; height:60px; background:#222; border:2px solid #39FF14; color:white; border-radius:10px; font-size:20px;";
    
    const buttons = [
        {txt: "", style: "visibility:hidden"}, {txt: "▲", action: () => movePlayer(0, -1)}, {txt: "", style: "visibility:hidden"},
        {txt: "◀", action: () => movePlayer(-1, 0)}, {txt: "▼", action: () => movePlayer(0, 1)}, {txt: "▶", action: () => movePlayer(1, 0)}
    ];

    buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.innerHTML = b.txt;
        btn.style.cssText = bS + (b.style || "");
        if (b.action) {
            btn.ontouchstart = (e) => { e.preventDefault(); b.action(); };
            btn.onclick = b.action;
        }
        d.appendChild(btn);
    });
    cont.appendChild(d);
}
