const canvasTiro = document.createElement('canvas');
const ctxTiro = canvasTiro.getContext('2d');

// Tamaño fijo para asegurar consistencia entre dispositivos
canvasTiro.width = 600;
canvasTiro.height = 400;
canvasTiro.style.cssText = "background:#0d0208; border:4px solid #39FF14; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none; border-radius:8px;";

let tiroRoomId = null;
let tiroRole = "spectator";
let isTiroActive = false;

let myTiroScore = 0;
let oppTiroScore = 0;
let round = 1;
const maxRounds = 10;

// Variables de juego
let myArrow = { x: 40, y: 200, angle: 0, power: 0, isFlying: false, isCharging: false };
let oppArrow = { x: 40, y: 200, angle: 0, power: 0, isFlying: false };
let targetY = 200; 
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

    // Controles táctiles
    setupTiroControls(container);

    if (isHost) {
        wind = (Math.random() - 0.5) * 3.5;
        syncTiro();
    }

    renderTiro();
}

// --- COMUNICACIÓN POR CANAL SYNC ---
socket.off('sync'); 
socket.on('sync', (data) => {
    if (!isTiroActive) return;

    if (data.type === 'tiro_data') {
        oppTiroScore = data.score;
        oppArrow.angle = data.angle;
        oppArrow.isFlying = data.isFlying;
        oppArrow.x = data.arrowX;
        oppArrow.y = data.arrowY;
        if (tiroRole === 'guest') wind = data.wind;
    }
});

function syncTiro() {
    socket.emit('sync', {
        roomId: tiroRoomId,
        type: 'tiro_data',
        score: myTiroScore,
        angle: myArrow.angle,
        isFlying: myArrow.isFlying,
        arrowX: myArrow.x,
        arrowY: myArrow.y,
        wind: wind,
        role: tiroRole
    });
}

// --- LÓGICA DE TIRO ---
function updateTiro() {
    if (myArrow.isFlying) {
        // Velocidad de vuelo de la flecha
        myArrow.x += 12; 
        myArrow.y += Math.sin(myArrow.angle) * 10 + wind;

        // Punto de colisión (Diana está en X=240 de cada mitad)
        let dist = Math.abs(myArrow.y - targetY);
        
        if (myArrow.x >= 240) {
            if (dist < 40) {
                // Puntos según cercanía al centro
                let points = Math.max(10, Math.floor((40 - dist) * 2.5));
                myTiroScore += points;
            }
            resetMyArrow();
        }
        syncTiro();
    } else {
        // Oscilación de la mira
        myArrow.angle = Math.sin(Date.now() / 600) * 0.5;
        syncTiro();
    }
}

function resetMyArrow() {
    myArrow.isFlying = false;
    myArrow.isCharging = false;
    myArrow.x = 40;
    myArrow.y = 200;
    round++;
    if (tiroRole === 'host') wind = (Math.random() - 0.5) * 4;
    if (round > maxRounds) setTimeout(endTiro, 1000);
}

// --- RENDERIZADO ---
function renderTiro() {
    if (!isTiroActive) return;
    updateTiro();

    // Fondo base
    ctxTiro.fillStyle = "#0d0208";
    ctxTiro.fillRect(0, 0, 600, 400);

    // Dibujar mitad izquierda (Jugador Local)
    drawField(0, myTiroScore, "TÚ", myArrow);
    
    // Dibujar mitad derecha (Rival)
    drawField(300, oppTiroScore, "RIVAL", oppArrow);

    // Línea divisoria Neon
    ctxTiro.strokeStyle = "#39FF14";
    ctxTiro.lineWidth = 4;
    ctxTiro.beginPath();
    ctxTiro.moveTo(300, 0); ctxTiro.lineTo(300, 400);
    ctxTiro.stroke();

    requestAnimationFrame(renderTiro);
}

function drawField(offsetX, score, name, arrowObj) {
    // 1. Dibujar Diana Centrada (Relativa a la mitad)
    const colors = ["#FFF", "#000", "#00F", "#F00", "#FF0"];
    const targetX = offsetX + 240; // 240 es la posición ideal dentro de los 300px
    
    for (let i = 0; i < 5; i++) {
        ctxTiro.beginPath();
        ctxTiro.fillStyle = colors[i];
        ctxTiro.arc(targetX, targetY, 40 - (i * 8), 0, Math.PI * 2);
        ctxTiro.fill();
        ctxTiro.strokeStyle = "#333";
        ctxTiro.stroke();
    }

    // 2. Dibujar Flecha
    ctxTiro.save();
    ctxTiro.translate(offsetX + arrowObj.x, arrowObj.y);
    ctxTiro.rotate(arrowObj.angle);
    
    // Cuerpo
    ctxTiro.fillStyle = (name === "TÚ") ? "#39FF14" : "#FF00FF";
    ctxTiro.fillRect(0, -2, -35, 4);
    
    // Punta
    ctxTiro.fillStyle = "red";
    ctxTiro.beginPath();
    ctxTiro.moveTo(0, 0); ctxTiro.lineTo(-10, -6); ctxTiro.lineTo(-10, 6);
    ctxTiro.fill();
    ctxTiro.restore();

    // 3. UI de Texto
    ctxTiro.fillStyle = "#FFF";
    ctxTiro.font = "bold 13px Arial";
    ctxTiro.fillText(`${name}: ${score}`, offsetX + 15, 30);
    
    if (name === "TÚ") {
        ctxTiro.font = "11px Arial";
        ctxTiro.fillText(`Viento: ${wind.toFixed(1)}`, offsetX + 15, 55);
        ctxTiro.fillText(`Ronda: ${round}/${maxRounds}`, offsetX + 15, 75);
    }
}

// --- CONTROLES MÓVILES ---
function setupTiroControls(cont) {
    const btn = document.createElement('div');
    btn.innerHTML = "MANTENER Y SOLTAR PARA DISPARAR";
    btn.style.cssText = "width:90%; height:80px; background:#222; border:3px solid #39FF14; color:#fff; display:flex; align-items:center; justify-content:center; margin:15px auto; border-radius:15px; font-weight:bold; font-family:sans-serif; user-select:none; touch-action:none;";

    const triggerShoot = (e) => {
        e.preventDefault();
        if (!myArrow.isFlying && isTiroActive) {
            myArrow.isFlying = true;
            syncTiro();
        }
    };

    btn.addEventListener('touchstart', triggerShoot);
    btn.addEventListener('mousedown', triggerShoot);

    cont.appendChild(btn);
}

function endTiro() {
    isTiroActive = false;
    alert(`FIN DEL DUELO\n\nTu puntuación: ${myTiroScore}\nRival: ${oppTiroScore}`);
    window.location.reload();
}
