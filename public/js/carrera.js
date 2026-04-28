const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

const baseWidth = 400;
const baseHeight = 600;
canvasRacing.width = baseWidth;
canvasRacing.height = baseHeight;
canvasRacing.style.cssText = "background:#0d0208; border:4px solid #FF00FF; display:block; margin:10px auto; max-width:95vw; max-height:65vh; touch-action:none; border-radius:10px;";

let racingRoomId = null;
let racingRole = "spectator"; 
let isRacingActive = false;

const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };

let obstacles = [];
let racingSpeed = 7;
let timeLeft = 60;
let timerInterval, obstacleInterval;

function startRacing(roomId, isHost) {
    console.log("Sincronizando juego en sala:", roomId);
    racingRoomId = roomId; 
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    
    // Reset de posiciones iniciales
    carHost.x = 100; carHost.crashes = 0; carHost.stun = 0;
    carGuest.x = 260; carGuest.crashes = 0; carGuest.stun = 0;
    obstacles = [];
    timeLeft = 60;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    // Detectar si es móvil para poner botones
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        setupMobileControls(container);
    }

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        if (timeLeft > 0) timeLeft--; 
        else endRacing();
    }, 1000);

    if (isHost) {
        if (obstacleInterval) clearInterval(obstacleInterval);
        obstacleInterval = setInterval(() => {
            if(isRacingActive) {
                const newObs = { x: Math.random() * 310 + 20, y: -50 };
                obstacles.push(newObs);
            }
        }, 850);
    }

    renderRacing();
}

// --- ESCUCHADORES DE RED (EVENTOS ENTRANTES) ---
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (!isRacingActive) return;
        if (data.role === 'host') carHost.x = data.x;
        else carGuest.x = data.x;
    });

    socket.on('broadcast', (data) => {
        if (!isRacingActive) return;

        // RECIBIR OBSTÁCULOS (Solo para el Guest)
        if (data.type === 'sync_obs' && racingRole === 'guest') {
            obstacles = data.list;
        }

        // RECIBIR CHOQUES (Ambos jugadores se enteran)
        if (data.type === 'collision') {
            const victim = (data.role === 'host') ? carHost : carGuest;
            victim.stun = 50;
            victim.crashes = data.total;
        }
    });
}

function movePlayer(dir) {
    if (!isRacingActive) return;
    let my = (racingRole === 'host') ? carHost : carGuest;
    if (my.stun > 0) return;

    if (dir === "left" && my.x > 15) my.x -= 25;
    if (dir === "right" && my.x < 345) my.x += 25;

    // Emitir mi posición a mi rival
    socket.emit('player_move', { 
        roomId: racingRoomId, 
        x: my.x, 
        role: racingRole 
    });
}

function renderRacing() {
    if (!isRacingActive) return;
    ctxRacing.clearRect(0, 0, baseWidth, baseHeight);
    
    // El Host gestiona el movimiento de obstáculos y lo comparte
    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += racingSpeed);
        obstacles = obstacles.filter(o => o.y < 650);
        
        socket.emit('broadcast', { 
            roomId: racingRoomId, 
            type: 'sync_obs', 
            list: obstacles 
        });
    }

    // Dibujar obstáculos y detectar mi propio choque
    obstacles.forEach(o => {
        ctxRacing.fillStyle = "#FF3131";
        ctxRacing.shadowBlur = 10;
        ctxRacing.shadowColor = "#FF3131";
        ctxRacing.fillRect(o.x, o.y, 40, 40);
        ctxRacing.shadowBlur = 0;

        let my = (racingRole === 'host') ? carHost : carGuest;
        // Colisión simple por caja
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + 40 > o.x && my.y < o.y + 40 && my.y + 70 > o.y) {
            my.stun = 50;
            my.crashes++;
            // Aviso al rival que choqué
            socket.emit('broadcast', { 
                roomId: racingRoomId, 
                type: 'collision', 
                role: racingRole, 
                total: my.crashes 
            });
        }
    });

    drawCar(carHost);
    drawCar(carGuest);

    // Interfaz de Usuario (Puntajes)
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 15px Arial";
    ctxRacing.fillText(`⏳ ${timeLeft}s`, 10, 25);
    ctxRacing.fillText(`YO: ${(racingRole==='host'?carHost.crashes:carGuest.crashes)}`, 10, 50);
    ctxRacing.fillText(`RIVAL: ${(racingRole==='host'?carGuest.crashes:carHost.crashes)}`, 10, 75);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { 
        c.stun--; 
        if (Math.floor(Date.now() / 100) % 2 === 0) return; // Efecto parpadeo
    }
    ctxRacing.fillStyle = c.color;
    ctxRacing.shadowBlur = 15;
    ctxRacing.shadowColor = c.color;
    ctxRacing.fillRect(c.x, c.y, 40, 70);
    ctxRacing.shadowBlur = 0;
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    alert(`FIN DE LA CARRERA\nChoques propios: ${racingRole==='host'?carHost.crashes:carGuest.crashes}`);
    window.location.reload();
}

function setupMobileControls(cont) {
    const d = document.createElement('div');
    d.style.cssText = "display:flex; justify-content:space-between; width:90%; margin:15px auto;";
    const bS = "width:48%; height:80px; background:rgba(57,255,20,0.15); border:3px solid #39FF14; color:white; font-size:40px; display:flex; align-items:center; justify-content:center; border-radius:15px; user-select:none; -webkit-tap-highlight-color:transparent;";
    
    const l = document.createElement('div'); l.innerHTML = "◀️"; l.style.cssText = bS;
    const r = document.createElement('div'); r.innerHTML = "▶️"; r.style.cssText = bS;

    l.ontouchstart = (e) => { e.preventDefault(); movePlayer("left"); };
    r.ontouchstart = (e) => { e.preventDefault(); movePlayer("right"); };
    
    // Soporte para clics (por si acaso)
    l.onclick = () => movePlayer("left");
    r.onclick = () => movePlayer("right");

    d.appendChild(l); d.appendChild(r);
    cont.appendChild(d);
}

window.addEventListener("keydown", (e) => {
    if(e.key === "ArrowLeft") movePlayer("left");
    if(e.key === "ArrowRight") movePlayer("right");
});
