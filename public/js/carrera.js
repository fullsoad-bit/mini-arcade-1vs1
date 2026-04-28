const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

const baseWidth = 400;
const baseHeight = 600;
canvasRacing.width = baseWidth;
canvasRacing.height = baseHeight;
canvasRacing.style.backgroundColor = "#0d0208";
canvasRacing.style.border = "4px solid #FF00FF";
canvasRacing.style.display = "block";
canvasRacing.style.margin = "10px auto";
canvasRacing.style.maxWidth = "95vw";
canvasRacing.style.maxHeight = "70vh";
canvasRacing.style.touchAction = "none";

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
        obstacleInterval = setInterval(spawnObstacle, 900);
    }

    renderRacing();
}

// ESCUCHADORES DE RED
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (isRacingActive) {
            if (data.role === 'host') carHost.x = data.x;
            else carGuest.x = data.x;
        }
    });

    socket.on('opponent_event', (data) => {
        if (!isRacingActive) return;

        // El Invitado recibe la lista de obstáculos del Host
        if (data.type === 'sync_obstacles' && racingRole === 'guest') {
            obstacles = data.obsList;
        }

        // Sincronizar choques para que ambos vean la explosión/stun
        if (data.type === 'stun') {
            const targetCar = (data.role === 'host') ? carHost : carGuest;
            targetCar.stun = 50;
            targetCar.crashes = data.crashes;
        }
    });
}

function spawnObstacle() {
    if (racingRole === 'host' && isRacingActive) {
        const obs = { x: Math.random() * 300 + 40, y: -50, color: "#FF3131" };
        obstacles.push(obs);
    }
}

function movePlayer(dir) {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;

    if (dir === "left" && myCar.x > 15) myCar.x -= 20;
    if (dir === "right" && myCar.x < 345) myCar.x += 20;

    socket.emit('player_move', { roomId: racingRoomId, x: myCar.x, role: racingRole });
}

function renderRacing() {
    if (!isRacingActive) return;

    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, baseWidth, baseHeight);
    
    // Lógica del Host: Mueve y envía
    if (racingRole === 'host') {
        obstacles.forEach(obs => obs.y += racingSpeed);
        obstacles = obstacles.filter(obs => obs.y < baseHeight + 50);
        
        // ENVÍO CRÍTICO: El Host manda sus posiciones al Guest
        socket.emit('game_event', {
            roomId: racingRoomId,
            type: 'sync_obstacles',
            obsList: obstacles
        });
    }

    // Dibujar Obstáculos
    obstacles.forEach((obs) => {
        ctxRacing.fillStyle = obs.color;
        ctxRacing.fillRect(obs.x, obs.y, 40, 40);

        // Cada uno detecta su propio choque y avisa
        let myCar = (racingRole === 'host') ? carHost : carGuest;
        if (myCar.stun <= 0 && 
            myCar.x < obs.x + 40 && myCar.x + carW > obs.x &&
            myCar.y < obs.y + 40 && myCar.y + carH > obs.y) {
            
            myCar.stun = 50; 
            myCar.crashes++;
            socket.emit('game_event', { 
                roomId: racingRoomId, type: 'stun', role: racingRole, crashes: myCar.crashes 
            });
        }
    });

    drawCar(carHost);
    drawCar(carGuest);

    // HUD
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 16px Monospace";
    ctxRacing.fillText(`⏱️ ${timeLeft}s`, 20, 30);
    ctxRacing.fillText(`🚀 TU: ${(racingRole==='host'?carHost.crashes:carGuest.crashes)} | RIVAL: ${(racingRole==='host'?carGuest.crashes:carHost.crashes)}`, 20, 55);

    roadOffset += racingSpeed;
    requestAnimationFrame(renderRacing);
}

function drawCar(car) {
    if (car.stun > 0) {
        car.stun--;
        if (Math.floor(Date.now() / 100) % 2 === 0) return;
    }
    ctxRacing.fillStyle = car.color;
    ctxRacing.fillRect(car.x, car.y, carW, carH);
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    alert(`FIN! Choques: ${racingRole === 'host' ? carHost.crashes : carGuest.crashes}`);
    window.location.reload();
}

window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") movePlayer("left");
    if (e.key === "ArrowRight") movePlayer("right");
});

function setupMobileControls(container) {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = "display:flex; justify-content:space-between; width:95vw; margin:10px auto;";

    const btnStyle = `width:46%; height:75px; background:rgba(255,0,255,0.2); border:2px solid #FF00FF; border-radius:10px; color:white; font-size:30px; display:flex; align-items:center; justify-content:center; user-select:none; -webkit-tap-highlight-color:transparent;`;

    const btnL = document.createElement('div'); btnL.innerHTML = "◀️"; btnL.style.cssText = btnStyle;
    const btnR = document.createElement('div'); btnR.innerHTML = "▶️"; btnR.style.cssText = btnStyle;

    let moveInt;
    const start = (d) => { movePlayer(d); moveInt = setInterval(() => movePlayer(d), 100); };
    const stop = () => clearInterval(moveInt);

    btnL.addEventListener('touchstart', (e) => { e.preventDefault(); start("left"); });
    btnL.addEventListener('touchend', stop);
    btnR.addEventListener('touchstart', (e) => { e.preventDefault(); start("right"); });
    btnR.addEventListener('touchend', stop);

    controlsDiv.appendChild(btnL);
    controlsDiv.appendChild(btnR);
    container.appendChild(controlsDiv);
}
