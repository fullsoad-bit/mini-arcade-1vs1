const canvasS = document.createElement('canvas');
const ctxS = canvasS.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = 20; 
canvasS.width = 400; canvasS.height = 400;
canvasS.style.cssText = "background:#050505; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none; cursor:crosshair;";

let snakeRoomId = null;
let snakeRole = ""; 
let isSnakeActive = false;

let p1 = { body: [], dir: {x:1, y:0}, nextDir: {x:1, y:0}, crashes: 0, color: "#39FF14", powerUp: 0 };
let p2 = { body: [], dir: {x:-1, y:0}, nextDir: {x:-1, y:0}, crashes: 0, color: "#FF00FF", powerUp: 0 };

const FRUITS = ["🍎", "🍒", "🍇", "🍊"];
let currentFruit = { x: 10, y: 10, type: "🍎", isSpecial: false };

let snakeGameInterval;

function startSnake(roomId, isHost) {
    snakeRoomId = roomId.toString();
    snakeRole = isHost ? 'host' : 'guest';
    isSnakeActive = true;

    p1.crashes = 0; p2.crashes = 0;
    resetMatch();

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    // Panel de Instrucciones
    const help = document.createElement('div');
    help.style.cssText = "color:#39FF14; font-family:'Press Start 2P'; font-size:10px; margin-bottom:15px; background:rgba(57,255,20,0.1); padding:10px; border:1px solid #39FF14;";
    const isTouch = 'ontouchstart' in window;
    help.innerHTML = isTouch ? "📱 DESLIZA EL DEDO PARA GIRAR" : "⌨️ USA LAS FLECHAS DEL TECLADO";
    
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
            if (snakeRole === 'host') {
                p2.body = data.pBody;
                p2.powerUp = data.pPower;
            } else {
                p1.body = data.pBody;
                p1.powerUp = data.pPower;
                currentFruit = data.fruit;
                p1.crashes = data.p1Crashes;
                p2.crashes = data.p2Crashes;
            }
        }
        if (data.type === 'snake_reset') resetMatch();
    });

    if (snakeGameInterval) clearInterval(snakeGameInterval);
    snakeGameInterval = setInterval(gameLoop, 135);
}

function resetMatch() {
    p1.body = [{x:2, y:2}, {x:1, y:2}, {x:0, y:2}]; 
    p1.dir = {x:1, y:0}; p1.nextDir = {x:1, y:0};
    p2.body = [{x:17, y:17}, {x:18, y:17}, {x:19, y:17}]; 
    p2.dir = {x:-1, y:0}; p2.nextDir = {x:-1, y:0};
    if (snakeRole === 'host') spawnFruit();
}

function spawnFruit() {
    const isStrawberry = Math.random() < 0.2;
    currentFruit = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT),
        type: isStrawberry ? "🍓" : FRUITS[Math.floor(Math.random() * FRUITS.length)],
        isSpecial: isStrawberry
    };
}

function gameLoop() {
    if (!isSnakeActive) return;

    let my = (snakeRole === 'host') ? p1 : p2;
    my.dir = my.nextDir;
    
    let head = my.body[0];
    let newHead = { x: head.x + my.dir.x, y: head.y + my.dir.y };

    // Efecto Túnel
    if (newHead.x < 0) newHead.x = TILE_COUNT - 1;
    if (newHead.x >= TILE_COUNT) newHead.x = 0;
    if (newHead.y < 0) newHead.y = TILE_COUNT - 1;
    if (newHead.y >= TILE_COUNT) newHead.y = 0;

    // --- LÓGICA DE CHOQUE ---
    // Revisar contra mi cuerpo y el del rival
    let rival = (snakeRole === 'host') ? p2 : p1;
    let collisionSelf = my.body.some(p => p.x === newHead.x && p.y === newHead.y);
    let collisionRival = rival.body.some(p => p.x === newHead.x && p.y === newHead.y);

    if (collisionSelf || collisionRival) {
        my.crashes++;
        if (my.crashes >= 5) return endGame();
        
        // Notificar reinicio de ronda
        socket.emit('sync', { roomId: snakeRoomId, type: 'snake_reset' });
        resetMatch();
        return;
    }

    my.body.unshift(newHead);

    if (newHead.x === currentFruit.x && newHead.y === currentFruit.y) {
        if (currentFruit.isSpecial) my.powerUp = 40;
        if (snakeRole === 'host') spawnFruit();
    } else {
        my.body.pop();
    }

    if (my.powerUp > 0) my.powerUp--;

    socket.emit('sync', {
        roomId: snakeRoomId, type: 'snake_sync',
        pBody: my.body, pPower: my.powerUp,
        fruit: currentFruit,
        p1Crashes: p1.crashes, p2Crashes: p2.crashes
    });

    draw();
}

function draw() {
    ctxS.fillStyle = "#050505";
    ctxS.fillRect(0, 0, 400, 400);

    // Fruta
    ctxS.font = "18px Arial";
    ctxS.textAlign = "center";
    ctxS.fillText(currentFruit.type, currentFruit.x * GRID_SIZE + 10, currentFruit.y * GRID_SIZE + 14);

    const drawSnake = (s) => {
        s.body.forEach((p, i) => {
            if (s.powerUp > 0) {
                ctxS.fillStyle = (Math.floor(Date.now()/70)%2==0) ? "gold" : s.color;
            } else {
                ctxS.fillStyle = i === 0 ? "#fff" : s.color;
            }
            ctxS.fillRect(p.x * GRID_SIZE, p.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
        });
    };
    drawSnake(p1); drawSnake(p2);

    document.getElementById('snake-hud').innerHTML = 
        `<span style="color:#39FF14">P1: ${p1.crashes}/5</span> | <span style="color:#FF00FF">P2: ${p2.crashes}/5</span>`;
}

function endGame() {
    isSnakeActive = false;
    clearInterval(snakeGameInterval);
    let winner = (p1.crashes < 5 && p2.crashes >= 5) ? "¡GANÓ P1 (VERDE)!" : "¡GANÓ P2 (ROSA)!";
    alert(`FIN DE LA PARTIDA\n${winner}\nEl oponente chocó 5 veces.`);
    window.location.reload();
}

function changeDir(nx, ny) {
    let my = (snakeRole === 'host') ? p1 : p2;
    if (nx !== -my.dir.x || ny !== -my.dir.y) {
        my.nextDir = { x: nx, y: ny };
    }
}

function setupTouchControls() {
    let sX, sY;
    canvasS.addEventListener('touchstart', e => { sX = e.touches[0].clientX; sY = e.touches[0].clientY; }, {passive:false});
    canvasS.addEventListener('touchmove', e => {
        if (!sX || !sY) return;
        e.preventDefault();
        let dX = sX - e.touches[0].clientX;
        let dY = sY - e.touches[0].clientY;
        if (Math.abs(dX) > Math.abs(dY)) {
            if (dX > 0) changeDir(-1, 0); else changeDir(1, 0);
        } else {
            if (dY > 0) changeDir(0, -1); else changeDir(0, 1);
        }
        sX = null; sY = null;
    }, {passive:false});
}

window.addEventListener("keydown", e => {
    if (!isSnakeActive) return;
    if (e.key === "ArrowUp") changeDir(0, -1);
    if (e.key === "ArrowDown") changeDir(0, 1);
    if (e.key === "ArrowLeft") changeDir(-1, 0);
    if (e.key === "ArrowRight") changeDir(1, 0);
});
