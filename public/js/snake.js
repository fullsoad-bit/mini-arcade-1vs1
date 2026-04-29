const canvasS = document.createElement('canvas');
const ctxS = canvasS.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = 20; 
canvasS.width = 400; canvasS.height = 400;
canvasS.style.cssText = "background:#050505; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let snakeRoomId = null;
let snakeRole = ""; 
let isSnakeActive = false;

let p1 = { body: [], dir: {x:1, y:0}, nextDir: {x:1, y:0}, crashes: 0, color: "#39FF14", powerUp: 0 };
let p2 = { body: [], dir: {x:-1, y:0}, nextDir: {x:-1, y:0}, crashes: 0, color: "#FF00FF", powerUp: 0 };

const FRUITS_TYPES = ["🍎", "🍒", "🍇", "🍊"];
let fruits = []; // Lista de frutas activas
let dynamite = null; // {x, y, timer}

let snakeGameInterval;

function startSnake(roomId, isHost) {
    snakeRoomId = roomId.toString();
    snakeRole = isHost ? 'host' : 'guest';
    isSnakeActive = true;

    p1.crashes = 0; p2.crashes = 0;
    resetMatch();

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const help = document.createElement('div');
    help.style.cssText = "color:#39FF14; font-family:'Press Start 2P'; font-size:9px; margin-bottom:10px;";
    help.innerHTML = "SWIPE PARA MOVER | 🧨 CUIDADO CON LA DINAMITA";
    
    const hud = document.createElement('div');
    hud.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:12px; margin-bottom:10px;";
    hud.id = "snake-hud";
    
    container.appendChild(help);
    container.appendChild(hud);
    container.appendChild(canvasS);
    
    setupTouchControls();

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isSnakeActive) return;
        if (data.type === 'snake_sync') {
            if (snakeRole === 'guest') {
                p1.body = data.p1Body;
                p1.powerUp = data.p1Power;
                fruits = data.fruits;
                dynamite = data.dynamite;
                p1.crashes = data.p1Crashes;
                p2.crashes = data.p2Crashes;
            } else {
                p2.body = data.p2Body;
                p2.powerUp = data.p2Power;
            }
        }
        if (data.type === 'snake_reset') resetMatch();
        if (data.type === 'snake_boom') triggerExplosion(data.x, data.y);
    });

    if (snakeGameInterval) clearInterval(snakeGameInterval);
    snakeGameInterval = setInterval(gameLoop, 135);
}

function resetMatch() {
    p1.body = [{x:2, y:2}, {x:1, y:2}, {x:0, y:2}]; p1.dir = {x:1, y:0}; p1.nextDir = {x:1, y:0};
    p2.body = [{x:17, y:17}, {x:18, y:17}, {x:19, y:17}]; p2.dir = {x:-1, y:0}; p2.nextDir = {x:-1, y:0};
    if (snakeRole === 'host') {
        fruits = [];
        for(let i=0; i<3; i++) spawnFruit();
        dynamite = null;
    }
}

function spawnFruit() {
    const isStrawberry = Math.random() < 0.15;
    fruits.push({
        id: Math.random(),
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT),
        type: isStrawberry ? "🍓" : FRUITS_TYPES[Math.floor(Math.random() * FRUITS_TYPES.length)],
        isSpecial: isStrawberry
    });
}

function gameLoop() {
    if (!isSnakeActive) return;

    let my = (snakeRole === 'host') ? p1 : p2;
    my.dir = my.nextDir;
    let newHead = { x: my.body[0].x + my.dir.x, y: my.body[0].y + my.dir.y };

    // Túnel
    if (newHead.x < 0) newHead.x = TILE_COUNT - 1;
    if (newHead.x >= TILE_COUNT) newHead.x = 0;
    if (newHead.y < 0) newHead.y = TILE_COUNT - 1;
    if (newHead.y >= TILE_COUNT) newHead.y = 0;

    // Colisiones
    let rival = (snakeRole === 'host') ? p2 : p1;
    if (my.body.some(p => p.x === newHead.x && p.y === newHead.y) || 
        rival.body.some(p => p.x === newHead.x && p.y === newHead.y)) {
        return reportCrash();
    }

    my.body.unshift(newHead);

    // Comer Fruta (Cualquiera de las 3)
    let eatenIndex = fruits.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    if (eatenIndex !== -1) {
        if (fruits[eatenIndex].isSpecial) my.powerUp = 40;
        if (snakeRole === 'host') {
            fruits.splice(eatenIndex, 1);
            spawnFruit();
        } else {
            // El Guest avisa que comió para que el Host la borre
            socket.emit('sync', { roomId: snakeRoomId, type: 'guest_ate', index: eatenIndex });
        }
    } else {
        my.body.pop();
    }

    // Lógica Dinamita (Solo Host)
    if (snakeRole === 'host') {
        if (!dynamite && Math.random() < 0.02) {
            dynamite = { x: Math.floor(Math.random()*TILE_COUNT), y: Math.floor(Math.random()*TILE_COUNT), timer: 5 };
        }
        if (dynamite) {
            dynamite.timer -= 0.135; // Basado en el interval
            if (dynamite.timer <= 0) {
                socket.emit('sync', { roomId: snakeRoomId, type: 'snake_boom', x: dynamite.x, y: dynamite.y });
                triggerExplosion(dynamite.x, dynamite.y);
                dynamite = null;
            }
        }
    }

    if (my.powerUp > 0) my.powerUp--;

    socket.emit('sync', {
        roomId: snakeRoomId, type: 'snake_sync',
        p1Body: p1.body, p1Power: p1.powerUp,
        p2Body: p2.body, p2Power: p2.powerUp,
        fruits, dynamite,
        p1Crashes: p1.crashes, p2Crashes: p2.crashes
    });

    draw();
}

function triggerExplosion(ex, ey) {
    // Si la cabeza está a 1 casilla de distancia, es daño
    [p1, p2].forEach(s => {
        let head = s.body[0];
        if (Math.abs(head.x - ex) <= 1 && Math.abs(head.y - ey) <= 1) {
            if (snakeRole === 'host') {
                s.crashes++;
                if (s.crashes >= 5) endGame();
                else {
                    socket.emit('sync', { roomId: snakeRoomId, type: 'snake_reset' });
                    resetMatch();
                }
            }
        }
    });
    // Efecto visual rápido
    ctxS.fillStyle = "orange";
    ctxS.beginPath(); ctxS.arc(ex*GRID_SIZE+10, ey*GRID_SIZE+10, 40, 0, Math.PI*2); ctxS.fill();
}

function reportCrash() {
    if (snakeRole === 'host') {
        p1.crashes++;
        if (p1.crashes >= 5) endGame();
        else { socket.emit('sync', { roomId: snakeRoomId, type: 'snake_reset' }); resetMatch(); }
    } else {
        socket.emit('sync', { roomId: snakeRoomId, type: 'guest_crash' });
    }
}

// Escuchador extra para el Host
socket.on('sync', (data) => {
    if (snakeRole === 'host' && data.type === 'guest_ate') {
        fruits.splice(data.index, 1);
        spawnFruit();
    }
    if (snakeRole === 'host' && data.type === 'guest_crash') {
        p2.crashes++;
        if (p2.crashes >= 5) endGame();
        else { socket.emit('sync', { roomId: snakeRoomId, type: 'snake_reset' }); resetMatch(); }
    }
});

function draw() {
    ctxS.fillStyle = "#050505";
    ctxS.fillRect(0, 0, 400, 400);

    // Dibujar Frutas
    fruits.forEach(f => {
        ctxS.font = "18px Arial"; ctxS.textAlign = "center";
        ctxS.fillText(f.type, f.x * GRID_SIZE + 10, f.y * GRID_SIZE + 15);
    });

    // Dibujar Dinamita
    if (dynamite) {
        ctxS.font = "18px Arial";
        ctxS.fillText("🧨", dynamite.x * GRID_SIZE + 10, dynamite.y * GRID_SIZE + 15);
        ctxS.fillStyle = "red"; ctxS.font = "bold 10px Arial";
        ctxS.fillText(Math.ceil(dynamite.timer), dynamite.x * GRID_SIZE + 10, dynamite.y * GRID_SIZE - 5);
    }

    const drawS = (s, col) => {
        s.body.forEach((p, i) => {
            ctxS.fillStyle = (s.powerUp > 0 && Math.floor(Date.now()/70)%2==0) ? "gold" : (i==0 ? "#fff" : col);
            ctxS.fillRect(p.x * GRID_SIZE, p.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
        });
    };
    drawS(p1, "#39FF14"); drawS(p2, "#FF00FF");

    document.getElementById('snake-hud').innerHTML = 
        `<span style="color:#39FF14">P1: ${p1.crashes}/5</span> | <span style="color:#FF00FF">P2: ${p2.crashes}/5</span>`;
}

function endGame() {
    isSnakeActive = false;
    clearInterval(snakeGameInterval);
    let win = (p1.crashes < 5) ? "P1 (VERDE)" : "P2 (ROSA)";
    alert("FIN DE PARTIDA - GANADOR: " + win);
    window.location.reload();
}

function changeDir(nx, ny) {
    let my = (snakeRole === 'host') ? p1 : p2;
    if (nx !== -my.dir.x || ny !== -my.dir.y) my.nextDir = { x: nx, y: ny };
}

function setupTouchControls() {
    let sX, sY;
    canvasS.addEventListener('touchstart', e => { sX = e.touches[0].clientX; sY = e.touches[0].clientY; }, {passive:false});
    canvasS.addEventListener('touchmove', e => {
        if (!sX || !sY) return; e.preventDefault();
        let dX = sX - e.touches[0].clientX, dY = sY - e.touches[0].clientY;
        if (Math.abs(dX) > Math.abs(dY)) { if (dX > 0) changeDir(-1, 0); else changeDir(1, 0); }
        else { if (dY > 0) changeDir(0, -1); else changeDir(0, 1); }
        sX = null; sY = null;
    }, {passive:false});
}

window.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") changeDir(0, -1);
    if (e.key === "ArrowDown") changeDir(0, 1);
    if (e.key === "ArrowLeft") changeDir(-1, 0);
    if (e.key === "ArrowRight") changeDir(1, 0);
});
