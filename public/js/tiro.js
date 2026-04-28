const canvasTiro = document.createElement('canvas');
const ctxTiro = canvasTiro.getContext('2d');

// Ajuste de tamaño para pantalla dividida
canvasTiro.width = 600;
canvasTiro.height = 400;
canvasTiro.style.cssText = "background:#0d0208; border:4px solid #39FF14; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let tiroRoomId = null;
let tiroRole = "spectator";
let isTiroActive = false;

let myTiroScore = 0;
let oppTiroScore = 0;
let round = 1;
const maxRounds = 10;

// Estados de flechas (Mía y Rival)
let myArrow = { x: 40, y: 200, angle: 0, power: 0, isFlying: false, isCharging: false };
let oppArrow = { x: 40, y: 200, angle: 0, power: 0, isFlying: false };

let targetY = 200; // Diana compartida (posición Y)
let wind = 0;

function startTiro(roomId, isHost) {
    tiroRoomId = roomId.toString();
    tiroRole = isHost ? 'host' : 'guest';
    isTiroActive = true;
    myTiroScore = 0;
    oppTiroScore = 0;
    round = 1;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasTiro);

    // Botón de disparo para Android
    setupTiroControls(container);

    if (isHost) {
        wind = (Math.random() - 0.5) * 3;
        syncTiro();
    }

    renderTiro();
}

// --- COMUNICACIÓN ---
socket.on('sync', (data) => {
    if (!isTiroActive) return;

    if (data.type === 'tiro_sync') {
        oppTiroScore = data.score;
        oppArrow.angle = data.angle;
        oppArrow.isFlying = data.isFlying;
        if (tiroRole === 'guest') wind = data.wind;
        
        // Si la flecha rival vuela, actualizamos su posición para el espejo
        if (data.isFlying) {
            oppArrow.x = data.arrowX;
            oppArrow.y = data.arrowY;
        }
    }
});

function syncTiro() {
    socket.emit('sync', {
        roomId: tiroRoomId,
        type: 'tiro_sync',
        score: myTiroScore,
        angle: myArrow.angle,
        isFlying: myArrow.isFlying,
        arrowX: myArrow.x,
        arrowY: myArrow.y,
        wind: wind,
        role: tiroRole
    });
}

// --- LÓGICA ---
function updateTiro() {
    if (myArrow.isFlying) {
        myArrow.x += Math.cos(myArrow.angle) * 12;
        myArrow.y += Math.sin(myArrow.angle) * 12 + wind;

        // Colisión con Diana (X=260 en mitad izquierda)
        let dist = Math.sqrt(Math.pow(myArrow.x - 260, 2) + Math.pow(myArrow.y - targetY, 2));
        
        if (myArrow.x >= 260 || myArrow.y < 0 || myArrow.y > 400) {
            if (dist < 40) {
                myTiroScore += Math.max(10, Math.floor((40 - dist) * 3));
            }
            resetMyArrow();
        }
        syncTiro();
    } else {
        // Oscilación de puntería
        myArrow.angle = Math.sin(Date.now() / 500) * 0.5;
        if (myArrow.isCharging) {
            myArrow.power += 0.5;
            if (myArrow.power > 20) myArrow.power = 20;
        }
        syncTiro();
    }
}

function resetMyArrow() {
    myArrow.isFlying = false;
    myArrow.isCharging = false;
    myArrow.x = 40;
    myArrow.y = 200;
    myArrow.power = 0;
    round++;
    if (tiroRole === 'host') wind = (Math.random() - 0.5) * 4;
    if (round > maxRounds) setTimeout(endTiro, 1000);
}

// --- DIBUJO ---
function renderTiro() {
    if (!isTiroActive) return;
    updateTiro();

    // Fondo
    ctxTiro.fillStyle = "#0d0208";
    ctxTiro.fillRect(0, 0, 600, 400);

    // Línea Divisoria (Neon)
    ctxTiro.strokeStyle = "#39FF14";
    ctxTiro.lineWidth = 4;
    ctxTiro.beginPath(); ctxTiro.moveTo(300, 0); ctxTiro.lineTo(300, 400); ctxTiro.stroke();

    // LADO IZQUIERDO (YO)
    drawField(0, myTiroScore, "TÚ", myArrow);
    
    // LADO DERECHO (RIVAL) - Espejo
    drawField(300, oppTiroScore, "RIVAL", oppArrow);

    requestAnimationFrame(renderTiro);
}

function drawField(offsetX, score, name, arrowObj) {
    // Diana
    const colors = ["#FFF", "#000", "#00F", "#F00", "#FF0"];
    for (let i = 0; i < 5; i++) {
        ctxTiro.beginPath();
        ctxTiro.fillStyle = colors[i];
        ctxTiro.arc(offsetX + 260, targetY, 40 - (i * 8), 0, Math.PI * 2);
        ctxTiro.fill();
    }

    // Flecha
    ctxTiro.save();
    ctxTiro.translate(offsetX + arrowObj.x, arrowObj.y);
    ctxTiro.rotate(arrowObj.angle);
    ctxTiro.fillStyle = name === "TÚ" ? "#39FF14" : "#FF00FF";
    ctxTiro.fillRect(0, -2, -30, 4); // Cuerpo
    ctxTiro.fillStyle = "red";
    ctxTiro.beginPath(); ctxTiro.moveTo(0,0); ctxTiro.lineTo(-8, -5); ctxTiro.lineTo(-8, 5); ctxTiro.fill(); // Punta
    ctxTiro.restore();

    // UI
    ctxTiro.fillStyle = "#FFF";
    ctxTiro.font = "bold 12px Arial";
    ctxTiro.fillText(`${name}: ${score}`, offsetX + 20, 30);
    if (name === "TÚ") {
        ctxTiro.fillText(`Viento: ${wind.toFixed(1)}`, offsetX + 20, 50);
        ctxTiro.fillText(`Ronda: ${round}/${maxRounds}`, offsetX + 20, 70);
    }
}

function setupTiroControls(cont) {
    const btn = document.createElement('div');
    btn.innerHTML = "MANTENER PARA CARGAR Y SOLTAR";
    btn.style.cssText = "width:90%; height:80px; background:#222; border:3px solid #39FF14; color:#fff; display:flex; align-items:center; justify-content:center; margin:15px auto; border-radius:15px; font-weight:bold; user-select:none; touch-action:none;";

    const startCharge = (e) => {
        e.preventDefault();
        if (!myArrow.isFlying) myArrow.isCharging = true;
    };

    const releaseShoot = (e) => {
        e.preventDefault();
        if (myArrow.isCharging) {
            myArrow.isCharging = false;
            myArrow.isFlying = true;
        }
    };

    btn.addEventListener('touchstart', startCharge);
    btn.addEventListener('touchend', releaseShoot);
    
    // Soporte para PC
    window.onkeydown = (e) => { if(e.code === "Space") myArrow.isCharging = true; };
    window.onkeyup = (e) => { if(e.code === "Space") { myArrow.isCharging = false; myArrow.isFlying = true; } };

    cont.appendChild(btn);
}

function endTiro() {
    isTiroActive = false;
    alert(`FIN! Score: ${myTiroScore} | Rival: ${oppTiroScore}`);
    window.location.reload();
}
