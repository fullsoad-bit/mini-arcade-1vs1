const canvasS = document.createElement('canvas');
const ctxS = canvasS.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = 20; 
canvasS.width = 400; canvasS.height = 400;
canvasS.style.cssText = "background:#050505; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let snakeRoomId = null;
let snakeRole = ""; 
let isSnakeActive = false;

// Iniciamos con 0 choques. Al llegar a 5 se pierde.
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
    
    const hud = document.createElement('div');
    hud.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:10px; margin-bottom:10px; line-height:1.5;";
    hud.id = "snake-hud";
    container.appendChild(hud);
    container.appendChild(canvasS);
    
    setupTouchControls();
    setupSnakeButtons(container);

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
    snakeGameInterval = setInterval(gameLoop, 130);
}

function resetMatch() {
    // Posiciones iniciales seguras (Esquinas opuestas)
    p1.body = [{x:2, y:2}, {x:1, y:2}, {x:0, y:2}]; 
    p1.dir = {x:1, y:0}; p1.nextDir = {x:1, y:0};
    
    p2.body = [{x:17, y:17}, {x:18, y:17}, {x:19, y:17}]; 
    p2.dir = {x:-1, y:0}; p2.nextDir = {x:-1, y:0};
    
    if (snakeRole === 'host') spawnFruit();
}

function spawnFruit() {
    const isStrawberry = Math.random() < 0.2; // 20% de probabilidad de frutilla
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

    // Colisión
    let allParts = [...p1.body, ...p2.body];
    if (allParts.some(p => p.x === newHead.x && p.y === newHead.y)) {
        my.crashes++;
        if (my.crashes >= 5) return endGame();
        
        if (snakeRole === 'host') {
            socket.emit('sync', { roomId: snakeRoomId, type: 'snake_reset' });
            resetMatch();
        }
        return;
    }

    my.body.unshift(newHead);

    // Comer fruta
    if (newHead.x === currentFruit.x && newHead.y === currentFruit.y) {
        if (currentFruit.isSpecial) my.powerUp = 30; // Efecto visual por 30 frames
        
        if (snakeRole === 'host') {
            spawnFruit();
        }
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

    // Dibujar Fruta (Emoji)
    ctxS.font = "16px Arial";
    ctxS.textAlign = "center";
    ctxS.textBaseline = "middle";
    ctxS.fillText(currentFruit.type, currentFruit.x * GRID_SIZE + 10, currentFruit.y * GRID_SIZE + 10);

    // Dibujar Serpientes
    const drawSnake = (s) => {
        s.body.forEach((p, i) => {
            if (s.powerUp > 0) {
                ctxS.fillStyle = (Math.floor(Date.now()/50)%2==0) ? "gold" : s.color;
                ctxS.shadowBlur = 10; ctxS.shadowColor = "gold";
            } else {
                ctxS.fillStyle = i === 0 ? "#fff" : s.color;
                ctxS.shadowBlur = 0;
            }
            ctxS.fillRect(p.x * GRID_SIZE, p.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
        });
        ctxS.shadowBlur = 0;
    };
    drawSnake(p1); drawSnake(p2);

    document.getElementById('snake-hud').innerHTML = 
        `<span style="color:#39FF14">P1: ${p1.crashes}/5</span> | <span style="color:#FF00FF">P2: ${p2.crashes}/5</span><br>¡EL QUE LLEGA A 5 PIERDE!`;
}

function endGame() {
    isSnakeActive = false;
    clearInterval(snakeGameInterval);
    let loser = (p1.crashes >= 5) ? "JUGADOR 1 (VERDE)" : "JUGADOR 2 (ROSA)";
    alert(`FIN DEL JUEGO\nPerdió: ${loser}\n¡Demasiados choques!`);
    window.location.reload();
}

function changeDir(nx, ny) {
    let my = (snakeRole === 'host') ? p1 : p2;
    if (nx !== -my.dir.x || ny !== -my.dir.y) {
        my.nextDir = { x: nx, y: ny };
    }
}

function setupTouchControls() {
    let startX, startY;
    canvasS.addEventListener('touchstart', e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, {passive:false});
    canvasS.addEventListener('touchmove', e => {
        if (!startX || !startY) return;
        e.preventDefault();
        let dx = startX - e.touches[0].clientX;
        let dy = startY - e.touches[0].clientY;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) changeDir(-1, 0); else changeDir(1, 0);
        } else {
            if (dy > 0) changeDir(0, -1); else changeDir(0, 1);
        }
        startX = null; startY = null;
    }, {passive:false});
}

function setupSnakeButtons(cont) {
    const dpad = document.createElement('div');
    dpad.style.cssText = "display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; width:150px; margin:10px auto;";
    const btnS = "height:45px; background:#222; border:1px solid #39FF14; color:#fff; border-radius:8px; font-size:18px;";
    const layout = [{t:"",x:0,y:0,s:true},{t:"▲",x:0,y:-1},{t:"",x:0,y:0,s:true},{t:"◀",x:-1,y:0},{t:"▼",x:0,y:1},{t:"▶",x:1,y:0}];
    layout.forEach(b => {
        const btn = document.createElement('button');
        if (b.s) btn.style.visibility = "hidden";
        else { btn.innerText = b.t; btn.style.cssText = btnS; btn.onclick = () => changeDir(b.x, b.y); }
        dpad.appendChild(btn);
    });
    cont.appendChild(dpad);
}

window.addEventListener("keydown", e => {
    if (e.key === "ArrowUp") changeDir(0, -1);
    if (e.key === "ArrowDown") changeDir(0, 1);
    if (e.key === "ArrowLeft") changeDir(-1, 0);
    if (e.key === "ArrowRight") changeDir(1, 0);
});
