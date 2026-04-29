const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400; canvasRacing.height = 600;
canvasRacing.style.cssText = "background:#000; border:4px solid #FF00FF; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;
let obstacles = [];

let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };
let racingSpeed = 7;
let timeLeft = 60;
let timerInt, obsInt;

// CAMBIO: El nombre ahora coincide con el index.html
function startCarrera(roomId, isHost) {
    if (!roomId) return console.error("Error: RoomId nulo");
    
    racingRoomId = roomId.toString();
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];
    timeLeft = 60;
    
    // Reiniciar posiciones y choques
    carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
    carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    // Título de modo
    const info = document.createElement('div');
    info.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:10px; margin-bottom:10px;";
    info.innerText = `MODO: ${racingRole.toUpperCase()}`;
    container.appendChild(info);
    
    container.appendChild(canvasRacing);

    if (/Android|iPhone/i.test(navigator.userAgent)) setupMobileControls(container);

    socket.off('sync'); 
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
            const target = (data.role === 'host') ? carHost : carGuest;
            target.stun = 40;
            target.crashes = data.total;
        }
    });

    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(() => {
        if (isRacingActive && timeLeft > 0) timeLeft--;
        else if (timeLeft <= 0) endRacing();
    }, 1000);

    if (isHost) {
        if (obsInt) clearInterval(obsInt);
        obsInt = setInterval(() => {
            if(isRacingActive) obstacles.push({ x: Math.random() * 310 + 25, y: -50 });
        }, 900);
    }

    // Iniciar el bucle de dibujo
    requestAnimationFrame(renderRacing);
}

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
    
    ctxRacing.fillStyle = "#000";
    ctxRacing.fillRect(0, 0, 400, 600);

    // Líneas de carretera para dar efecto de movimiento
    ctxRacing.strokeStyle = "#333";
    ctxRacing.setLineDash([20, 20]);
    ctxRacing.lineWidth = 5;
    ctxRacing.beginPath();
    ctxRacing.moveTo(200, 0); ctxRacing.lineTo(200, 600);
    ctxRacing.stroke();

    if (racingRole === 'host') {
        obstacles.forEach(o => o.y += racingSpeed);
        obstacles = obstacles.filter(o => o.y < 650);
        socket.emit('sync', { roomId: racingRoomId, type: 'obs', list: obstacles });
    }

    obstacles.forEach(o => {
        ctxRacing.fillStyle = "#FF0000"; // Obstáculos rojos
        ctxRacing.fillRect(o.x, o.y, 40, 40);
        
        // Colisión solo la detecta cada uno para su propio auto
        let my = (racingRole === 'host') ? carHost : carGuest;
        if (my.stun <= 0 && my.x < o.x + 40 && my.x + 40 > o.x && my.y < o.y + 40 && my.y + 70 > o.y) {
            my.stun = 40;
            my.crashes++;
            socket.emit('sync', { roomId: racingRoomId, type: 'hit', role: racingRole, total: my.crashes });
        }
    });

    drawCar(carHost);
    drawCar(carGuest);

    // UI de tiempo y choques
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 16px Arial";
    ctxRacing.fillText(`⏱️ Tiempo: ${timeLeft}s`, 10, 30);
    ctxRacing.fillStyle = "#39FF14";
    ctxRacing.fillText(`P1 (Host): ${carHost.crashes}`, 10, 55);
    ctxRacing.fillStyle = "#FF00FF";
    ctxRacing.fillText(`P2 (Guest): ${carGuest.crashes}`, 10, 80);

    requestAnimationFrame(renderRacing);
}

function drawCar(c) {
    if (c.stun > 0) { 
        c.stun--; 
        if (Math.floor(Date.now() / 100) % 2 === 0) return; 
    }
    ctxRacing.fillStyle = c.color;
    ctxRacing.fillRect(c.x, c.y, 40, 70);
    // Detalles del auto (luces)
    ctxRacing.fillStyle = "yellow";
    ctxRacing.fillRect(c.x + 5, c.y + 5, 5, 5);
    ctxRacing.fillRect(c.x + 30, c.y + 5, 5, 5);
}

function endRacing() {
    if (!isRacingActive) return;
    isRacingActive = false;
    clearInterval(timerInt);
    clearInterval(obsInt);
    
    let winner = "";
    if (carHost.crashes < carGuest.crashes) winner = "¡GANÓ EL HOST (VERDE)!";
    else if (carGuest.crashes < carHost.crashes) winner = "¡GANÓ EL GUEST (ROSA)!";
    else winner = "¡EMPATE!";
    
    alert(`FIN DE LA CARRERA\n${winner}\nHost: ${carHost.crashes} choques\nGuest: ${carGuest.crashes} choques`);
    window.location.reload();
}

function setupMobileControls(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:15px;";
    const btnStyle = "width:45%; height:75px; background:#222; border:2px solid #39FF14; color:white; font-size:35px; border-radius:12px; touch-action:none;";
    
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
