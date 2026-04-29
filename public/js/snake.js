const canvasS = document.createElement('canvas');
const ctxS = canvasS.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = 20; 
canvasS.width = 400;
canvasS.height = 400;
canvasS.style.cssText = "background:#050505; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let snakeRoomId = null;
let snakeRole = ""; 
let isSnakeActive = false;

let p1 = { body: [{x:5, y:10}], dir: {x:1, y:0}, nextDir: {x:1, y:0}, score: 0, color: "#39FF14" };
let p2 = { body: [{x:14, y:10}], dir: {x:-1, y:0}, nextDir: {x:-1, y:0}, score: 0, color: "#FF00FF" };
let food = { x: 10, y: 10 };
let snakeGameInterval;

function startSnake(roomId, isHost) {
    snakeRoomId = roomId.toString();
    snakeRole = isHost ? 'host' : 'guest';
    isSnakeActive = true;

    p1.score = 0; p2.score = 0;
    resetMatch();

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const hud = document.createElement('div');
    hud.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:12px; margin-bottom:10px;";
    hud.id = "snake-hud";
    container.appendChild(hud);
    container.appendChild(canvasS);
    
    setupTouchControls(); // Control por deslizamiento
    setupSnakeButtons(container); // Botones de respaldo

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isSnakeActive) return;
        if (data.type === 'snake_sync') {
            if (snakeRole === 'host') {
                p2.body = data.pBody;
            } else {
                p1.body = data.pBody;
                food = data.food;
                p1.score = data.p1Score;
                p2.score = data.p2Score;
            }
        }
        if (data.type === 'snake_gameover') {
            alert(data.msg);
            resetMatch();
        }
    });

    if (snakeGameInterval) clearInterval(snakeGameInterval);
    snakeGameInterval = setInterval(gameLoop, 130); // Velocidad ajustada
}

function resetMatch() {
    p1.body = [{x:5, y:10}, {x:4, y:10}, {x:3, y:10}]; 
    p1.dir = {x:1, y:0}; p1.nextDir = {x:1, y:0};
    
    p2.body = [{x:14, y:10}, {x:15, y:10}, {x:16, y:10}]; 
    p2.dir = {x:-1, y:0}; p2.nextDir = {x:-1, y:0};
    
    if (snakeRole === 'host') spawnFood();
}

function spawnFood() {
    food = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
    };
}

function gameLoop() {
    if (!isSnakeActive) return;

    let my = (snakeRole === 'host') ? p1 : p2;
    my.dir = my.nextDir;
    
    let head = my.body[0];
    let newHead = { x: head.x + my.dir.x, y: head.y + my.dir.y };

    // --- EFECTO TÚNEL (Paredes infinitas) ---
    if (newHead.x < 0) newHead.x = TILE_COUNT - 1;
    if (newHead.x >= TILE_COUNT) newHead.x = 0;
    if (newHead.y < 0) newHead.y = TILE_COUNT - 1;
    if (newHead.y >= TILE_COUNT) newHead.y = 0;

    // Colisión con cuerpos
    let allParts = [...p1.body, ...p2.body];
    if (allParts.some(p => p.x === newHead.x && p.y === newHead.y)) {
        return gameOver("¡COLISIÓN!");
    }

    my.body.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
        if (snakeRole === 'host') { p1.score++; spawnFood(); } 
        else { p2.score++; }
    } else {
        my.body.pop();
    }

    socket.emit('sync', {
        roomId: snakeRoomId, type: 'snake_sync',
        pBody: my.body, food: food,
        p1Score: p1.score, p2Score: p2.score
    });

    draw();
}

function gameOver(reason) {
    if (snakeRole === 'host') {
        let winMsg = (p1.score > p2.score) ? "GANÓ VERDE" : (p2.score > p1.score ? "GANÓ ROSA" : "EMPATE");
        socket.emit('sync', { roomId: snakeRoomId, type: 'snake_gameover', msg: reason + " " + winMsg });
        alert(reason + " " + winMsg);
        resetMatch();
    }
}

function draw() {
    ctxS.fillStyle = "#050505";
    ctxS.fillRect(0, 0, canvasS.width, canvasS.height);

    // Comida Neón
    ctxS.fillStyle = "#FF3131";
    ctxS.shadowBlur = 10; ctxS.shadowColor = "red";
    ctxS.fillRect(food.x * GRID_SIZE + 2, food.y * GRID_SIZE + 2, GRID_SIZE-4, GRID_SIZE-4);
    ctxS.shadowBlur = 0;

    // Dibujar Serpientes
    const drawSnake = (snake) => {
        snake.body.forEach((p, i) => {
            ctxS.fillStyle = i === 0 ? "#fff" : snake.color;
            ctxS.fillRect(p.x * GRID_SIZE, p.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
        });
    };
    drawSnake(p1); drawSnake(p2);

    document.getElementById('snake-hud').innerText = `P1: ${p1.score} | P2: ${p2.score}`;
}

function changeDir(nx, ny) {
    let my = (snakeRole === 'host') ? p1 : p2;
    // Bloquear giro 180 grados
    if (nx !== -my.dir.x || ny !== -my.dir.y) {
        my.nextDir = { x: nx, y: ny };
    }
}

// CONTROL POR DESLIZAMIENTO (SWIPE)
function setupTouchControls() {
    let startX, startY;
    canvasS.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, {passive: false});

    canvasS.addEventListener('touchmove', e => {
        if (!startX || !startY) return;
        e.preventDefault();
        let diffX = startX - e.touches[0].clientX;
        let diffY = startY - e.touches[0].clientY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 0) changeDir(-1, 0); else changeDir(1, 0);
        } else {
            if (diffY > 0) changeDir(0, -1); else changeDir(0, 1);
        }
        startX = null; startY = null;
    }, {passive: false});
}

function setupSnakeButtons(cont) {
    const dpad = document.createElement('div');
    dpad.style.cssText = "display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; width:150px; margin:10px auto;";
    const btnS = "height:45px; background:#222; border:1px solid #39FF14; color:#fff; border-radius:8px; font-size:18px;";
    
    const layout = [
        {t:"", x:0, y:0, s:true}, {t:"▲", x:0, y:-1}, {t:"", x:0, y:0, s:true},
        {t:"◀", x:-1, y:0}, {t:"▼", x:0, y:1}, {t:"▶", x:1, y:0}
    ];

    layout.forEach(b => {
        const btn = document.createElement('button');
        if (b.s) btn.style.visibility = "hidden";
        else {
            btn.innerText = b.t; btn.style.cssText = btnS;
            btn.onclick = () => changeDir(b.x, b.y);
        }
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
