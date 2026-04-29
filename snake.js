const canvasS = document.createElement('canvas');
const ctxS = canvasS.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = 20; // 20x20 = 400px
canvasS.width = 400;
canvasS.height = 400;
canvasS.style.cssText = "background:#050505; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none;";

let snakeRoomId = null;
let snakeRole = ""; 
let isSnakeActive = false;

// Jugadores
let p1 = { body: [{x:5, y:10}], dir: {x:1, y:0}, score: 0, color: "#39FF14" };
let p2 = { body: [{x:14, y:10}], dir: {x:-1, y:0}, score: 0, color: "#FF00FF" };
let food = { x: 10, y: 10 };

let snakeGameInterval;

function startSnake(roomId, isHost) {
    snakeRoomId = roomId.toString();
    snakeRole = isHost ? 'host' : 'guest';
    isSnakeActive = true;

    // Reset inicial
    resetMatch();
    p1.score = 0; p2.score = 0;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const hud = document.createElement('div');
    hud.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:10px; margin-bottom:10px;";
    hud.id = "snake-hud";
    container.appendChild(hud);
    container.appendChild(canvasS);
    
    setupSnakeControls(container);

    // Red
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
    snakeGameInterval = setInterval(gameLoop, 150);
}

function resetMatch() {
    p1.body = [{x:5, y:10}]; p1.dir = {x:1, y:0};
    p2.body = [{x:14, y:10}]; p2.dir = {x:-1, y:0};
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
    
    // Calcular nueva cabeza
    let newHead = { x: my.body[0].x + my.dir.x, y: my.body[0].y + my.dir.y };

    // 1. Chocar con paredes
    if (newHead.x < 0 || newHead.x >= TILE_COUNT || newHead.y < 0 || newHead.y >= TILE_COUNT) {
        return gameOver("¡Chocaste con la pared!");
    }

    // 2. Chocar con uno mismo o el rival
    let allParts = [...p1.body, ...p2.body];
    if (allParts.some(part => part.x === newHead.x && part.y === newHead.y)) {
        return gameOver("¡Colisión detectada!");
    }

    my.body.unshift(newHead);

    // 3. Comer fruta
    if (newHead.x === food.x && newHead.y === food.y) {
        if (snakeRole === 'host') {
            p1.score++;
            spawnFood();
        } else {
            p2.score++;
        }
    } else {
        my.body.pop();
    }

    // Sincronizar
    socket.emit('sync', {
        roomId: snakeRoomId,
        type: 'snake_sync',
        pBody: my.body,
        food: food,
        p1Score: p1.score,
        p2Score: p2.score
    });

    draw();
}

function gameOver(reason) {
    if (snakeRole === 'host') {
        let msg = reason + (p1.score > p2.score ? " Ganó P1" : " Ganó P2");
        socket.emit('sync', { roomId: snakeRoomId, type: 'snake_gameover', msg: msg });
        alert(msg);
        resetMatch();
    }
}

function draw() {
    ctxS.fillStyle = "#050505";
    ctxS.fillRect(0, 0, canvasS.width, canvasS.height);

    // Dibujar Fruta
    ctxS.fillStyle = "red";
    ctxS.beginPath();
    ctxS.arc(food.x * GRID_SIZE + 10, food.y * GRID_SIZE + 10, 8, 0, Math.PI*2);
    ctxS.fill();

    // Dibujar Snakes
    p1.body.forEach((part, i) => {
        ctxS.fillStyle = i === 0 ? "#fff" : p1.color;
        ctxS.fillRect(part.x * GRID_SIZE, part.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
    });

    p2.body.forEach((part, i) => {
        ctxS.fillStyle = i === 0 ? "#fff" : p2.color;
        ctxS.fillRect(part.x * GRID_SIZE, part.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
    });

    document.getElementById('snake-hud').innerText = `P1: ${p1.score} | P2: ${p2.score}`;
}

function changeDir(nx, ny) {
    let my = (snakeRole === 'host') ? p1 : p2;
    // Evitar que gire 180 grados sobre sí mismo
    if (nx !== -my.dir.x || ny !== -my.dir.y) {
        my.dir = { x: nx, y: ny };
    }
}

function setupSnakeControls(cont) {
    const dpad = document.createElement('div');
    dpad.style.cssText = "display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; width:180px; margin:15px auto;";
    
    const btns = [
        {t:"", x:0, y:0, s:true}, {t:"▲", x:0, y:-1}, {t:"", x:0, y:0, s:true},
        {t:"◀", x:-1, y:0}, {t:"▼", x:0, y:1}, {t:"▶", x:1, y:0}
    ];

    btns.forEach(b => {
        const btn = document.createElement('button');
        if (b.s) { btn.style.visibility = "hidden"; }
        else {
            btn.innerText = b.t;
            btn.style.cssText = "height:50px; background:#222; border:2px solid #39FF14; color:#fff; border-radius:10px; font-size:20px;";
            btn.onclick = () => changeDir(b.x, b.y);
        }
        dpad.appendChild(btn);
    });
    cont.appendChild(dpad);
}

window.addEventListener("keydown", e => {
    if (!isSnakeActive) return;
    if (e.key === "ArrowUp") changeDir(0, -1);
    if (e.key === "ArrowDown") changeDir(0, 1);
    if (e.key === "ArrowLeft") changeDir(-1, 0);
    if (e.key === "ArrowRight") changeDir(1, 0);
});
