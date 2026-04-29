const canvasS = document.createElement('canvas');
const ctxS = canvasS.getContext('2d');

const GRID_SIZE = 20;
const TILE_COUNT = 20; 
canvasS.width = 400; canvasS.height = 400;
canvasS.style.cssText = "background:#050505; border:4px solid #39FF14; display:block; margin:auto; max-width:90vw; height:auto; touch-action:none; cursor:pointer;";

let snakeRoomId = null;
let snakeRole = ""; 
let isSnakeActive = false;

let p1 = { body: [], dir: {x:1, y:0}, nextDir: {x:1, y:0}, crashes: 0, color: "#39FF14", powerUp: 0 };
let p2 = { body: [], dir: {x:-1, y:0}, nextDir: {x:-1, y:0}, crashes: 0, color: "#FF00FF", powerUp: 0 };

const FRUITS_TYPES = ["🍎", "🍒", "🍇", "🍊"];
let fruits = [];
let dynamite = null; 
let explosionEffect = null;
let snakeGameInterval;
const FRAME_RATE = 135;

function startSnake(roomId, isHost) {
    snakeRoomId = roomId.toString();
    snakeRole = isHost ? 'host' : 'guest';
    isSnakeActive = true;

    p1.crashes = 0; p2.crashes = 0;
    resetMatch();

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const hud = document.createElement('div');
    hud.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:12px; margin-bottom:10px;";
    hud.id = "snake-hud";
    
    container.appendChild(hud);
    container.appendChild(canvasS);
    
    setupAllControls();

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isSnakeActive) return;
        if (data.type === 'snake_sync') {
            if (snakeRole === 'guest') {
                p1.body = data.p1Body; p1.powerUp = data.p1Power;
                fruits = data.fruits; dynamite = data.dynamite;
                p1.crashes = data.p1Crashes; p2.crashes = data.p2Crashes;
            } else {
                p2.body = data.p2Body; p2.powerUp = data.p2Power;
            }
        }
        if (data.type === 'snake_reset') resetMatch();
        if (data.type === 'snake_boom') triggerExplosion(data.x, data.y);
        
        // RECIBIR FINAL DEL JUEGO
        if (data.type === 'snake_final') {
            executeEndGame(data.winnerRole);
        }
    });

    if (snakeGameInterval) clearInterval(snakeGameInterval);
    snakeGameInterval = setInterval(gameLoop, FRAME_RATE);
}

function resetMatch() {
    p1.body = [{x:2, y:2}, {x:1, y:2}, {x:0, y:2}]; p1.dir = {x:1, y:0}; p1.nextDir = {x:1, y:0}; p1.powerUp = 0;
    p2.body = [{x:17, y:17}, {x:18, y:17}, {x:19, y:17}]; p2.dir = {x:-1, y:0}; p2.nextDir = {x:-1, y:0}; p2.powerUp = 0;
    if (snakeRole === 'host') {
        fruits = []; for(let i=0; i<3; i++) spawnFruit();
        dynamite = null;
    }
}

function spawnFruit() {
    const isStraw = Math.random() < 0.15;
    fruits.push({
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT),
        type: isStraw ? "🍓" : FRUITS_TYPES[Math.floor(Math.random() * FRUITS_TYPES.length)],
        isSpecial: isStraw
    });
}

function gameLoop() {
    if (!isSnakeActive) return;
    let my = (snakeRole === 'host') ? p1 : p2;
    my.dir = my.nextDir;
    
    let head = my.body[0]; // Corrección de índice aplicada
    let newHead = { x: head.x + my.dir.x, y: head.y + my.dir.y };

    // Túnel
    if (newHead.x < 0) newHead.x = TILE_COUNT - 1;
    if (newHead.x >= TILE_COUNT) newHead.x = 0;
    if (newHead.y < 0) newHead.y = TILE_COUNT - 1;
    if (newHead.y >= TILE_COUNT) newHead.y = 0;

    let rival = (snakeRole === 'host') ? p2 : p1;
    let hitSelf = my.body.some(p => p.x === newHead.x && p.y === newHead.y);
    let hitRival = rival.body.some(p => p.x === newHead.x && p.y === newHead.y);

    if ((hitSelf || hitRival) && my.powerUp <= 0) return reportCrash();

    my.body.unshift(newHead);

    let eatenIdx = fruits.findIndex(f => f.x === newHead.x && f.y === newHead.y);
    if (eatenIdx !== -1) {
        if (fruits[eatenIdx].isSpecial) my.powerUp = 6000;
        if (snakeRole === 'host') { fruits.splice(eatenIdx, 1); spawnFruit(); }
        else socket.emit('sync', { roomId: snakeRoomId, type: 'guest_ate', index: eatenIdx });
    } else {
        my.body.pop();
    }

    if (my.powerUp > 0) my.powerUp -= FRAME_RATE;
    
    if (snakeRole === 'host') {
        if (!dynamite && Math.random() < 0.02) {
            dynamite = { x: Math.floor(Math.random()*TILE_COUNT), y: Math.floor(Math.random()*TILE_COUNT), timer: 5 };
        }
        if (dynamite) {
            dynamite.timer -= (FRAME_RATE/1000);
            if (dynamite.timer <= 0) {
                socket.emit('sync', { roomId: snakeRoomId, type: 'snake_boom', x: dynamite.x, y: dynamite.y });
                triggerExplosion(dynamite.x, dynamite.y);
                dynamite = null;
            }
        }
    }

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
    explosionEffect = { x: ex, y: ey, timer: 10 };
    [p1, p2].forEach(s => {
        let isHit = s.body.some(p => Math.abs(p.x - ex) <= 1 && Math.abs(p.y - ey) <= 1);
        if (isHit && s.powerUp <= 0 && snakeRole === 'host') {
            s.crashes++;
            checkFinalScore();
        }
    });
}

function reportCrash() {
    if (snakeRole === 'host') {
        p1.crashes++;
        checkFinalScore();
    } else socket.emit('sync', { roomId: snakeRoomId, type: 'guest_crash' });
}

function checkFinalScore() {
    if (p1.crashes >= 5 || p2.crashes >= 5) {
        let winnerRole = (p1.crashes >= 5) ? 'guest' : 'host';
        socket.emit('sync', { roomId: snakeRoomId, type: 'snake_final', winnerRole: winnerRole });
        executeEndGame(winnerRole);
    } else {
        socket.emit('sync', { roomId: snakeRoomId, type: 'snake_reset' });
        resetMatch();
    }
}

function executeEndGame(winnerRole) {
    isSnakeActive = false;
    clearInterval(snakeGameInterval);
    
    let resultMessage = "";
    if (snakeRole === winnerRole) {
        resultMessage = "¡VICTORIA! 🏆\nEl rival chocó 5 veces.";
    } else {
        resultMessage = "¡DERROTA! 💀\nHas alcanzado los 5 choques.";
    }

    setTimeout(() => {
        alert(resultMessage);
        window.location.reload();
    }, 200);
}

socket.on('sync', (data) => {
    if (snakeRole === 'host' && data.type === 'guest_ate') { fruits.splice(data.index, 1); spawnFruit(); }
    if (snakeRole === 'host' && data.type === 'guest_crash') {
        p2.crashes++;
        checkFinalScore();
    }
});

function draw() {
    ctxS.fillStyle = "#050505";
    ctxS.fillRect(0, 0, 400, 400);
    fruits.forEach(f => {
        ctxS.font = "18px Arial"; ctxS.textAlign = "center";
        ctxS.fillText(f.type, f.x * GRID_SIZE + 10, f.y * GRID_SIZE + 15);
    });
    if (dynamite) {
        ctxS.font = "18px Arial";
        ctxS.fillText("🧨", dynamite.x * GRID_SIZE + 10, dynamite.y * GRID_SIZE + 15);
    }
    if (explosionEffect && explosionEffect.timer > 0) {
        ctxS.fillStyle = "rgba(255,165,0,0.6)";
        ctxS.fillRect((explosionEffect.x-1)*GRID_SIZE, (explosionEffect.y-1)*GRID_SIZE, GRID_SIZE*3, GRID_SIZE*3);
        explosionEffect.timer--;
    }
    const drawS = (s, col) => {
        s.body.forEach((p, i) => {
            ctxS.fillStyle = (s.powerUp > 0 && Math.floor(Date.now()/70)%2==0) ? "gold" : (i==0 ? "#fff" : col);
            ctxS.fillRect(p.x * GRID_SIZE, p.y * GRID_SIZE, GRID_SIZE-1, GRID_SIZE-1);
        });
    };
    drawS(p1, "#39FF14"); drawS(p2, "#FF00FF");
    document.getElementById('snake-hud').innerHTML = `P1: ${p1.crashes}/5 | P2: ${p2.crashes}/5 ${p1.powerUp>0 || p2.powerUp>0 ? '🌟' : ''}`;
}

function setupAllControls() {
    window.onkeydown = (e) => {
        if (e.key === "ArrowUp") changeDir(0, -1);
        if (e.key === "ArrowDown") changeDir(0, 1);
        if (e.key === "ArrowLeft") changeDir(-1, 0);
        if (e.key === "ArrowRight") changeDir(1, 0);
    };
    canvasS.onclick = (e) => {
        const rect = canvasS.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        if (y < 0.3) changeDir(0, -1);
        else if (y > 0.7) changeDir(0, 1);
        else if (x < 0.3) changeDir(-1, 0);
        else if (x > 0.7) changeDir(1, 0);
    };
    let sX, sY;
    canvasS.ontouchstart = (e) => { sX = e.touches[0].clientX; sY = e.touches[0].clientY; };
    canvasS.ontouchmove = (e) => {
        if (!sX || !sY) return;
        let dX = sX - e.touches[0].clientX, dY = sY - e.touches[0].clientY;
        if (Math.abs(dX) > 20 || Math.abs(dY) > 20) {
            if (Math.abs(dX) > Math.abs(dY)) {
                if (dX > 0) changeDir(-1, 0); else changeDir(1, 0);
            } else {
                if (dY > 0) changeDir(0, -1); else changeDir(0, 1);
            }
            sX = null; sY = null;
        }
    };
}

function changeDir(nx, ny) {
    let my = (snakeRole === 'host') ? p1 : p2;
    if (nx !== -my.dir.x || ny !== -my.dir.y) my.nextDir = { x: nx, y: ny };
}
