const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

canvasRacing.width = 400;
canvasRacing.height = 600;
canvasRacing.style.cssText = "background:#0d0208; border:4px solid #FF00FF; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;

let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };
let obstacles = [];
let racingSpeed = 6;
let timeLeft = 60;
let timerInterval, obstacleInterval;

function startRacing(roomId, isHost) {
    console.log("Juego activado en sala:", roomId);
    racingRoomId = roomId;
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];
    timeLeft = 60;
    
    // Resetear coches
    carHost.crashes = 0; carGuest.crashes = 0;
    carHost.stun = 0; carGuest.stun = 0;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    // Controles para celulares Android
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        setupMobileButtons(container);
    }

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeLeft > 0) timeLeft--;
        else endRacing();
    }, 1000);

    if (isHost) {
        if (obstacleInterval) clearInterval(obstacleInterval);
        obstacleInterval = setInterval(() => {
            if(isRacingActive) obstacles.push({ x: Math.random() * 320 + 20, y: -50 });
        }, 1000);
    }

    renderRacing();
}

// RECIBIR DATOS DEL RIVAL
socket.on('opponent_move', (data) => {
    if (!isRacingActive) return;
    if (data.role === 'host') carHost.x = data.x;
    else carGuest.x = data.x;
});

socket.on('broadcast', (data) => {
    if (!isRacingActive) return;
    
    // Sincronizar obstáculos (Solo el Guest los recibe)
    if (data.type === 'obs' && racingRole === 'guest') {
        obstacles = data.list;
    }
    
    // Sincronizar choques (Ambos se enteran)
    if (data.type === 'hit') {
        const car = (data.role === 'host') ? carHost : carGuest;
        car.stun = 40;
        car.crashes = data.total;
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

    // El Host mueve y transmite los obstáculos
    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += racingSpeed);
        obstacles = obstacles.filter(o => o.y < 650);
        socket.emit('broadcast', { roomId: racingRoomId, type: 'obs', list: obstacles });
    }

    // Dibujar obstáculos y detectar choque propio
    obstacles.forEach(o => {
        ctxRacing.fillStyle = "#FF3131";
        ctxRacing.fillRect(o.x, o.y, 40, 40);

        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + 40 > o.x && my.y < o.y + 40 && my.y + 70 > o.y) {
            my.stun = 40;
            my.crashes++;
            socket.emit('broadcast', { roomId: racingRoomId, type: 'hit', role: racingRole, total: my.crashes });
        }
    });

    // Dibujar Coches
    drawCar(carHost);
    drawCar(carGuest);

    // Interfaz
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 14px Arial";
    ctxRacing.fillText(`TIEMPO: ${timeLeft}s`, 10, 25);
    ctxRacing.fillText(`YO: ${racingRole === 'host' ? carHost.crashes : carGuest.crashes} | RIVAL: ${racingRole === 'host' ? carGuest.crashes : carHost.crashes}`, 10, 50);

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
    alert("JUEGO TERMINADO");
    window.location.reload();
}

function setupMobileButtons(container) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; padding:15px;";
    
    const btnL = document.createElement('button');
    const btnR = document.createElement('button');
    btnL.innerHTML = "◀️"; btnR.innerHTML = "▶️";
    
    const style = "width:45%; height:80px; font-size:40px; background:#FF00FF33; border:2px solid #FF00FF; color:white; border-radius:10px;";
    btnL.style.cssText = style; btnR.style.cssText = style;

    btnL.ontouchstart = (e) => { e.preventDefault(); movePlayer("left"); };
    btnR.ontouchstart = (e) => { e.preventDefault(); movePlayer("right"); };
    
    box.appendChild(btnL); box.appendChild(btnR);
    container.appendChild(box);
}

window.addEventListener("keydown", (e) => {
    if(e.key === "ArrowLeft") movePlayer("left");
    if(e.key === "ArrowRight") movePlayer("right");
});
