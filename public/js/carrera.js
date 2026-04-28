const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400; canvasRacing.height = 600;
canvasRacing.style.cssText = "background:#000; border:4px solid #FF00FF; display:block; margin:auto; max-width:95vw; height:auto; touch-action:none;";

let racingRoomId = "";
let racingRole = "";
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

    if (isHost) {
        setInterval(() => {
            if(isRacingActive) obstacles.push({ x: Math.random() * 320 + 20, y: -50 });
        }, 950);
    }
    renderRacing();
}

// ÚNICO ESCUCHADOR DE RED
socket.on('sync', (data) => {
    if (!isRacingActive) return;
    if (data.type === 'move') {
        if (data.role === 'host') carHost.x = data.x;
        else carGuest.x = data.x;
    }
    if (data.type === 'obs' && racingRole === 'guest') {
        obstacles = data.list;
    }
    if (data.type === 'hit') {
        const c = (data.role === 'host') ? carHost : carGuest;
        c.stun = 40; c.crashes = data.total;
    }
});

function movePlayer(dir) {
    if (!isRacingActive) return;
    let my = (racingRole === 'host') ? carHost : carGuest;
    if (my.stun > 0) return;
    if (dir === "left" && my.x > 20) my.x -= 30;
    if (dir === "right" && my.x < 340) my.x += 30;
    
    socket.emit('sync', { roomId: racingRoomId, type: 'move', x: my.x, role: racingRole });
}

function renderRacing() {
    if (!isRacingActive) return;
    ctxRacing.clearRect(0, 0, 400, 600);

    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += 6);
        obstacles = obstacles.filter(o => o.y < 650);
        socket.emit('sync', { roomId: racingRoomId, type: 'obs', list: obstacles });
    }

    obstacles.forEach(o => {
        ctxRacing.fillStyle = "red";
        ctxRacing.fillRect(o.x, o.y, 40, 40);
        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + 40 > o.x && my.y < o.y + 40 && my.y + 70 > o.y) {
            my.stun = 40; my.crashes++;
            socket.emit('sync', { roomId: racingRoomId, type: 'hit', role: racingRole, total: my.crashes });
        }
    });

    drawCar(carHost); drawCar(carGuest);
    
    // HUD
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "12px Arial";
    ctxRacing.fillText(`YO: ${racingRole === 'host' ? carHost.crashes : carGuest.crashes} | RIVAL: ${racingRole === 'host' ? carGuest.crashes : carHost.crashes}`, 10, 20);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { c.stun--; if (Math.floor(Date.now() / 100) % 2 === 0) return; }
    ctxRacing.fillStyle = c.color;
    ctxRacing.fillRect(c.x, c.y, 40, 70);
}

function setupMobileControls(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:center; gap:25px; padding:20px;";
    const btn = "width:85px; height:85px; font-size:35px; background:#222; color:#fff; border:3px solid #FF00FF; border-radius:20px;";
    const bl = document.createElement('button'); bl.innerText = "◀️"; bl.style.cssText = btn;
    const br = document.createElement('button'); br.innerText = "▶️"; br.style.cssText = btn;
    bl.ontouchstart = (e) => { e.preventDefault(); movePlayer("left"); };
    br.ontouchstart = (e) => { e.preventDefault(); movePlayer("right"); };
    box.appendChild(bl); box.appendChild(br);
    cont.appendChild(box);
}
