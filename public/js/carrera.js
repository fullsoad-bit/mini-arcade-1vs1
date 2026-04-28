const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

const baseWidth = 400;
const baseHeight = 600;
canvasRacing.width = baseWidth;
canvasRacing.height = baseHeight;
canvasRacing.style.cssText = "background:#0d0208; border:4px solid #FF00FF; display:block; margin:10px auto; max-width:90vw; max-height:70vh; touch-action:none;";

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;

const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };

let obstacles = [];
let roadOffset = 0;
let racingSpeed = 7;
let timeLeft = 60;
let timerInterval, obstacleInterval;

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function startRacing(roomId, isHost) {
    racingRoomId = roomId;
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];
    timeLeft = 60;
    carHost.crashes = 0;
    carGuest.crashes = 0;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    if (isMobile) setupMobileControls(container);

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        if (timeLeft > 0) timeLeft--; 
        else endRacing();
    }, 1000);

    if (isHost) {
        if (obstacleInterval) clearInterval(obstacleInterval);
        obstacleInterval = setInterval(() => {
            if(isRacingActive) obstacles.push({ x: Math.random() * 300 + 40, y: -50 });
        }, 900);
    }

    renderRacing();
}

// --- COMUNICACIÓN DE RED ---
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (data.role === 'host') carHost.x = data.x;
        else carGuest.x = data.x;
    });

    socket.on('broadcast', (data) => {
        if (!isRacingActive) return;
        // El Guest recibe obstáculos del Host
        if (data.type === 'sync_obs' && racingRole === 'guest') {
            obstacles = data.list;
        }
        // Ambos reciben aviso de choque
        if (data.type === 'collision') {
            const car = (data.role === 'host') ? carHost : carGuest;
            car.stun = 50;
            car.crashes = data.total;
        }
    });
}

function movePlayer(dir) {
    if (!isRacingActive) return;
    let my = (racingRole === 'host') ? carHost : carGuest;
    if (my.stun > 0) return;

    if (dir === "left" && my.x > 20) my.x -= 20;
    if (dir === "right" && my.x < 340) my.x += 20;

    socket.emit('player_move', { roomId: racingRoomId, x: my.x, role: racingRole });
}

function renderRacing() {
    if (!isRacingActive) return;
    ctxRacing.clearRect(0, 0, baseWidth, baseHeight);
    
    // El Host mueve obstáculos y los "transmite"
    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += racingSpeed);
        obstacles = obstacles.filter(o => o.y < 650);
        socket.emit('broadcast', { roomId: racingRoomId, type: 'sync_obs', list: obstacles });
    }

    // Dibujar y detectar colisión
    obstacles.forEach(o => {
        ctxRacing.fillStyle = "#FF3131";
        ctxRacing.fillRect(o.x, o.y, 40, 40);

        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + carW > o.x && my.y < o.y + 40 && my.y + carH > o.y) {
            my.stun = 50;
            my.crashes++;
            socket.emit('broadcast', { roomId: racingRoomId, type: 'collision', role: racingRole, total: my.crashes });
        }
    });

    drawCar(carHost);
    drawCar(carGuest);

    // HUD con puntajes sincronizados
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 16px Monospace";
    ctxRacing.fillText(`⏱️ ${timeLeft}s`, 15, 30);
    ctxRacing.fillText(`YO: ${racingRole==='host'?carHost.crashes:carGuest.crashes} | RIVAL: ${racingRole==='host'?carGuest.crashes:carHost.crashes}`, 15, 55);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { c.stun--; if (Math.floor(Date.now() / 100) % 2 === 0) return; }
    ctxRacing.fillStyle = c.color;
    ctxRacing.fillRect(c.x, c.y, carW, carH);
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    alert(`CARRERA FINALIZADA\nChoques propios: ${racingRole==='host'?carHost.crashes:carGuest.crashes}`);
    window.location.reload();
}

function setupMobileControls(cont) {
    const d = document.createElement('div');
    d.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:10px;";
    const bS = "width:45%; height:70px; background:#FF00FF33; border:2px solid #FF00FF; color:white; font-size:30px; display:flex; align-items:center; justify-content:center; border-radius:10px; user-select:none;";
    
    const l = document.createElement('div'); l.innerHTML = "◀️"; l.style.cssText = bS;
    const r = document.createElement('div'); r.innerHTML = "▶️"; r.style.cssText = bS;

    l.ontouchstart = (e) => { e.preventDefault(); movePlayer("left"); };
    r.ontouchstart = (e) => { e.preventDefault(); movePlayer("right"); };
    l.onclick = () => movePlayer("left");
    r.onclick = () => movePlayer("right");

    d.appendChild(l); d.appendChild(r);
    cont.appendChild(d);
}

window.addEventListener("keydown", (e) => {
    if(e.key === "ArrowLeft") movePlayer("left");
    if(e.key === "ArrowRight") movePlayer("right");
});
