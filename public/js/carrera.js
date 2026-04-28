const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400;
canvasRacing.height = 600;
canvasRacing.style.cssText = "background:#000; border:3px solid #FF00FF; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;
let obstacles = [];

let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };
let racingSpeed = 6;
let timeLeft = 60;
let timerInt, obsInt;

function startRacing(roomId, isHost) {
    if (!roomId) return alert("Error: Sala no encontrada");
    
    racingRoomId = roomId.toString();
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];
    timeLeft = 60;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    // Controles para Android/iOS
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        setupMobileControls(container);
    }

    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(() => {
        if (timeLeft > 0) timeLeft--;
        else endRacing();
    }, 1000);

    if (isHost) {
        if (obsInt) clearInterval(obsInt);
        obsInt = setInterval(() => {
            if(isRacingActive) obstacles.push({ x: Math.random() * 310 + 25, y: -50 });
        }, 900);
    }

    renderRacing();
}

// ESCUCHADORES DE RED
socket.on('opponent_move', (data) => {
    if (!isRacingActive) return;
    if (data.role === 'host') carHost.x = data.x;
    else carGuest.x = data.x;
});

socket.on('broadcast', (data) => {
    if (!isRacingActive) return;
    // Sincronizar obstáculos (Solo Guest)
    if (data.type === 'obs' && racingRole === 'guest') {
        obstacles = data.list;
    }
    // Sincronizar choques (Ambos)
    if (data.type === 'hit') {
        const target = (data.role === 'host') ? carHost : carGuest;
        target.stun = 40;
        target.crashes = data.total;
    }
});

function movePlayer(dir) {
    if (!isRacingActive) return;
    let my = (racingRole === 'host') ? carHost : carGuest;
    if (my.stun > 0) return;

    if (dir === "left" && my.x > 20) my.x -= 25;
    if (dir === "right" && my.x < 340) my.x += 25;

    socket.emit('player_move', { roomId: racingRoomId, x: my.x, role: racingRole });
}

function renderRacing() {
    if (!isRacingActive) return;
    ctxRacing.clearRect(0, 0, 400, 600);

    // Host mueve y transmite
    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += racingSpeed);
        obstacles = obstacles.filter(o => o.y < 650);
        socket.emit('broadcast', { roomId: racingRoomId, type: 'obs', list: obstacles });
    }

    // Dibujar y detectar colisión propia
    obstacles.forEach(o => {
        ctxRacing.fillStyle = "#FF0000";
        ctxRacing.fillRect(o.x, o.y, 40, 40);

        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + 40 > o.x && my.y < o.y + 40 && my.y + 70 > o.y) {
            my.stun = 40;
            my.crashes++;
            socket.emit('broadcast', { roomId: racingRoomId, type: 'hit', role: racingRole, total: my.crashes });
        }
    });

    drawCar(carHost);
    drawCar(carGuest);

    // Texto UI
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "16px Arial";
    ctxRacing.fillText(`⏱️ ${timeLeft}s`, 10, 25);
    ctxRacing.fillText(`P1 Choques: ${carHost.crashes}`, 10, 50);
    ctxRacing.fillText(`P2 Choques: ${carGuest.crashes}`, 10, 75);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { 
        c.stun--; 
        if (Math.floor(Date.now() / 100) % 2 === 0) return; 
    }
    ctxRacing.fillStyle = c.color;
    ctxRacing.fillRect(c.x, c.y, 40, 70);
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInt);
    clearInterval(obsInt);
    alert("CARRERA FINALIZADA");
    window.location.reload();
}

function setupMobileControls(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:15px;";
    const btnStyle = "width:45%; height:75px; background:#333; border:2px solid #39FF14; color:white; font-size:35px; border-radius:12px; touch-action:none;";
    
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
