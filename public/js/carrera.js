const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

const baseWidth = 400;
const baseHeight = 600;
canvasRacing.width = baseWidth;
canvasRacing.height = baseHeight;

// Estilo Neon optimizado para móviles
canvasRacing.style.cssText = "background:#0d0208; border:4px solid #FF00FF; display:block; margin:10px auto; max-width:90vw; height:auto; touch-action:none; box-shadow: 0 0 20px #FF00FF55;";

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;

const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };

let obstacles = [];
let racingSpeed = 6;
let timeLeft = 60;
let timerInterval, obstacleInterval;

function startRacing(roomId, isHost) {
    console.log("Iniciando Carrera Reforzada en sala:", roomId);
    racingRoomId = roomId.toString();
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];
    timeLeft = 60;
    carHost.crashes = 0; carGuest.crashes = 0;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    // Controles para Android
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) setupMobileControls(container);

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (timeLeft > 0) timeLeft--;
        else endRacing();
    }, 1000);

    if (isHost) {
        if (obstacleInterval) clearInterval(obstacleInterval);
        obstacleInterval = setInterval(() => {
            if(isRacingActive) obstacles.push({ x: Math.random() * 300 + 30, y: -50 });
        }, 900);
    }

    renderRacing();
}

// ESCUCHADOR DE RED ÚNICO (Canal Broadcast)
socket.on('broadcast', (data) => {
    if (!isRacingActive) return;

    // Sincronizar obstáculos (Solo el Invitado recibe)
    if (data.type === 'sync_obs' && racingRole === 'guest') {
        obstacles = data.list;
    }

    // Sincronizar movimientos del rival
    if (data.type === 'move') {
        if (data.role === 'host') carHost.x = data.x;
        else carGuest.x = data.x;
    }

    // Sincronizar choques
    if (data.type === 'hit') {
        const victim = (data.role === 'host') ? carHost : carGuest;
        victim.stun = 45;
        victim.crashes = data.total;
    }
});

function movePlayer(dir) {
    if (!isRacingActive) return;
    let my = (racingRole === 'host') ? carHost : carGuest;
    if (my.stun > 0) return;

    if (dir === "left" && my.x > 20) my.x -= 25;
    if (dir === "right" && my.x < 340) my.x += 25;

    // Emitir movimiento por broadcast
    socket.emit('broadcast', { 
        roomId: racingRoomId, 
        type: 'move', 
        x: my.x, 
        role: racingRole 
    });
}

function renderRacing() {
    if (!isRacingActive) return;
    
    // Limpiar pantalla
    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, 400, 600);

    // Solo el Host mueve y transmite
    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += racingSpeed);
        obstacles = obstacles.filter(o => o.y < 650);
        
        socket.emit('broadcast', { 
            roomId: racingRoomId, 
            type: 'sync_obs', 
            list: obstacles 
        });
    }

    // Dibujar y detectar colisión
    obstacles.forEach(o => {
        ctxRacing.fillStyle = "#FF3131";
        ctxRacing.fillRect(o.x, o.y, 40, 40);

        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + carW > o.x && my.y < o.y + 40 && my.y + carH > o.y) {
            my.stun = 45;
            my.crashes++;
            socket.emit('broadcast', { 
                roomId: racingRoomId, 
                type: 'hit', 
                role: racingRole, 
                total: my.crashes 
            });
        }
    });

    drawCar(carHost);
    drawCar(carGuest);

    // HUD
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 16px Arial";
    ctxRacing.fillText(`⏱️ ${timeLeft}s`, 15, 30);
    ctxRacing.fillText(`YO: ${racingRole==='host'?carHost.crashes:carGuest.crashes} | RIVAL: ${racingRole==='host'?carGuest.crashes:carHost.crashes}`, 15, 55);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { 
        c.stun--; 
        if (Math.floor(Date.now() / 100) % 2 === 0) return; 
    }
    ctxRacing.fillStyle = c.color;
    ctxRacing.fillRect(c.x, c.y, carW, carH);
}

function endRacing() {
    isRacingActive = false;
    alert("¡TIEMPO AGOTADO!");
    window.location.reload();
}

function setupMobileControls(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:20px;";
    
    const bS = "width:44%; height:80px; background:#FF00FF33; border:2px solid #FF00FF; color:white; font-size:35px; border-radius:15px; touch-action:none;";
    
    const btnL = document.createElement('button'); btnL.innerHTML = "◀️"; btnL.style.cssText = bS;
    const btnR = document.createElement('button'); btnR.innerHTML = "▶️"; btnR.style.cssText = bS;

    btnL.ontouchstart = (e) => { e.preventDefault(); movePlayer("left"); };
    btnR.ontouchstart = (e) => { e.preventDefault(); movePlayer("right"); };

    box.appendChild(btnL); box.appendChild(btnR);
    cont.appendChild(box);
}

window.addEventListener("keydown", (e) => {
    if(e.key === "ArrowLeft") movePlayer("left");
    if(e.key === "ArrowRight") movePlayer("right");
});
