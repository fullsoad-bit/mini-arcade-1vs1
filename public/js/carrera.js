const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400; canvasRacing.height = 600;
canvasRacing.style.cssText = "background:#000; border:2px solid #FF00FF; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;
let obstacles = [];
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };

function startRacing(roomId, isHost) {
    racingRoomId = roomId.toString();
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    if (/Android|iPhone/i.test(navigator.userAgent)) setupMobileControls(container);

    if (isHost) setInterval(() => {
        if(isRacingActive) obstacles.push({ x: Math.random() * 320 + 20, y: -50 });
    }, 1000);

    renderRacing();
}

// ÚNICO ESCUCHADOR DE RED
socket.on('broadcast', (data) => {
    if (!isRacingActive) return;

    // Sincronizar movimientos del rival
    if (data.type === 'move') {
        if (data.role === 'host') carHost.x = data.x;
        else carGuest.x = data.x;
    }
    // Sincronizar obstáculos (Solo Guest)
    if (data.type === 'obs' && racingRole === 'guest') {
        obstacles = data.list;
    }
    // Sincronizar choques
    if (data.type === 'hit') {
        const c = (data.role === 'host') ? carHost : carGuest;
        c.stun = 40; c.crashes = data.total;
    }
});

function movePlayer(dir) {
    if (!isRacingActive) return;
    let my = (racingRole === 'host') ? carHost : carGuest;
    if (my.stun > 0) return;

    if (dir === "left" && my.x > 20) my.x -= 25;
    if (dir === "right" && my.x < 340) my.x += 25;

    // Enviamos el movimiento por broadcast
    socket.emit('broadcast', { roomId: racingRoomId, type: 'move', x: my.x, role: racingRole });
}

function renderRacing() {
    if (!isRacingActive) return;
    ctxRacing.clearRect(0, 0, 400, 600);

    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += 6);
        obstacles = obstacles.filter(o => o.y < 650);
        socket.emit('broadcast', { roomId: racingRoomId, type: 'obs', list: obstacles });
    }

    obstacles.forEach(o => {
        ctxRacing.fillStyle = "red";
        ctxRacing.fillRect(o.x, o.y, 40, 40);
        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + 40 > o.x && my.y < o.y + 40 && my.y + 70 > o.y) {
            my.stun = 40; my.crashes++;
            socket.emit('broadcast', { roomId: racingRoomId, type: 'hit', role: racingRole, total: my.crashes });
        }
    });

    drawCar(carHost); drawCar(carGuest);

    ctxRacing.fillStyle = "white";
    ctxRacing.font = "16px Arial";
    ctxRacing.fillText(`P1: ${carHost.crashes} | P2: ${carGuest.crashes}`, 10, 30);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { c.stun--; if (Math.floor(Date.now() / 100) % 2 === 0) return; }
    ctxRacing.fillStyle = c.color;
    ctxRacing.fillRect(c.x, c.y, 40, 70);
}

function endRacing() {
    isRacingActive = false;
    window.location.reload();
}

function setupMobileControls(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:15px;";
    const btnStyle = "width:45%; height:75px; background:#333; border:2px solid #FF00FF; color:white; font-size:30px; border-radius:12px;";
    const bL = document.createElement('button'); bL.innerHTML = "◀️"; bL.style.cssText = btnStyle;
    const bR = document.createElement('button'); bR.innerHTML = "▶️"; bR.style.cssText = btnStyle;
    bL.ontouchstart = (e) => { e.preventDefault(); movePlayer("left"); };
    bR.ontouchstart = (e) => { e.preventDefault(); movePlayer("right"); };
    box.appendChild(bL); box.appendChild(bR);
    cont.appendChild(box);
}

window.addEventListener("keydown", (e) => {
    if(e.key === "ArrowLeft") movePlayer("left");
    if(e.key === "ArrowRight") movePlayer("right");
});
