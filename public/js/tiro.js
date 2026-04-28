const canvasTiro = document.createElement('canvas');
const ctxTiro = canvasTiro.getContext('2d');
canvasTiro.width = 600;
canvasTiro.height = 400;
canvasTiro.style.cssText = "background:#0d0208; border:4px solid #39FF14; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let tiroRoomId = null;
let tiroRole = "";
let isTiroActive = false;

let myTiroScore = 0;
let oppTiroScore = 0;
let round = 1;
const maxRounds = 10;

// Flechas
let myArrow = { x: 40, y: 200, angle: 0, isFlying: false, hasShot: false };
let oppArrow = { x: 40, y: 200, angle: 0, isFlying: false, hasShot: false };

let targetY = 200; 
let wind = 0;

function startTiro(roomId, isHost) {
    tiroRoomId = roomId.toString();
    tiroRole = isHost ? 'host' : 'guest';
    isTiroActive = true;
    myTiroScore = 0; oppTiroScore = 0; round = 1;
    
    resetRoundState();

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasTiro);
    setupTiroControls(container);

    if (isHost) {
        wind = (Math.random() - 0.5) * 4;
        broadcastTiro();
    }
    renderTiro();
}

// --- COMUNICACIÓN ---
socket.off('sync');
socket.on('sync', (data) => {
    if (!isTiroActive || data.type !== 'tiro_sync') return;

    // Sincronizar rival
    oppTiroScore = data.score;
    oppArrow.angle = data.angle;
    oppArrow.isFlying = data.isFlying;
    oppArrow.hasShot = data.hasShot;
    if (data.isFlying) { oppArrow.x = data.arrowX; oppArrow.y = data.arrowY; }
    
    if (tiroRole === 'guest') wind = data.wind;

    // Lógica de avance de ronda: Si AMBOS han disparado y las flechas no están volando
    if (myArrow.hasShot && oppArrow.hasShot && !myArrow.isFlying && !oppArrow.isFlying) {
        setTimeout(nextRound, 1500);
    }
});

function broadcastTiro() {
    socket.emit('sync', {
        roomId: tiroRoomId,
        type: 'tiro_sync',
        score: myTiroScore,
        angle: myArrow.angle,
        isFlying: myArrow.isFlying,
        arrowX: myArrow.x,
        arrowY: myArrow.y,
        hasShot: myArrow.hasShot,
        wind: wind,
        role: tiroRole
    });
}

// --- LÓGICA ---
function updateTiro() {
    if (myArrow.isFlying) {
        myArrow.x += 12;
        myArrow.y += Math.sin(myArrow.angle) * 10 + wind;

        let dist = Math.abs(myArrow.y - targetY);
        if (myArrow.x >= 240) {
            myArrow.isFlying = false;
            myArrow.hasShot = true;
            if (dist < 40) myTiroScore += Math.max(10, Math.floor((40 - dist) * 2.5));
            broadcastTiro();
        }
    } else if (!myArrow.hasShot) {
        myArrow.angle = Math.sin(Date.now() / 600) * 0.5;
        broadcastTiro();
    }
}

function nextRound() {
    if (round < maxRounds) {
        round++;
        resetRoundState();
        if (tiroRole === 'host') {
            wind = (Math.random() - 0.5) * 4;
            broadcastTiro();
        }
    } else {
        endTiro();
    }
}

function resetRoundState() {
    myArrow.isFlying = false; myArrow.hasShot = false; myArrow.x = 40; myArrow.y = 200;
    oppArrow.isFlying = false; oppArrow.hasShot = false; oppArrow.x = 40; oppArrow.y = 200;
}

function renderTiro() {
    if (!isTiroActive) return;
    updateTiro();
    ctxTiro.fillStyle = "#0d0208";
    ctxTiro.fillRect(0, 0, 600, 400);

    drawField(0, myTiroScore, "TÚ", myArrow);
    drawField(300, oppTiroScore, "RIVAL", oppArrow);

    // Separador
    ctxTiro.strokeStyle = "#39FF14"; ctxTiro.lineWidth = 2;
    ctxTiro.beginPath(); ctxTiro.moveTo(300, 0); ctxTiro.lineTo(300, 400); ctxTiro.stroke();

    // Mensaje de espera
    if (myArrow.hasShot && !oppArrow.hasShot) {
        ctxTiro.fillStyle = "yellow"; ctxTiro.font = "10px Arial";
        ctxTiro.fillText("ESPERANDO DISPARO RIVAL...", 60, 380);
    }

    requestAnimationFrame(renderTiro);
}

function drawField(offset, score, label, arrow) {
    const targetX = offset + 240;
    const colors = ["#FFF", "#000", "#00F", "#F00", "#FF0"];
    for (let i = 0; i < 5; i++) {
        ctxTiro.beginPath(); ctxTiro.fillStyle = colors[i];
        ctxTiro.arc(targetX, targetY, 40 - (i * 8), 0, Math.PI * 2); ctxTiro.fill();
    }

    ctxTiro.save();
    ctxTiro.translate(offset + arrow.x, arrow.y);
    ctxTiro.rotate(arrow.angle);
    ctxTiro.fillStyle = (label === "TÚ") ? "#39FF14" : "#FF00FF";
    ctxTiro.fillRect(0, -2, -35, 4);
    ctxTiro.fillStyle = "red";
    ctxTiro.beginPath(); ctxTiro.moveTo(0,0); ctxTiro.lineTo(-10,-6); ctxTiro.lineTo(-10,6); ctxTiro.fill();
    ctxTiro.restore();

    ctxTiro.fillStyle = "white"; ctxTiro.font = "bold 13px Arial";
    ctxTiro.fillText(`${label}: ${score}`, offset + 15, 30);
    if (label === "TÚ") {
        ctxTiro.font = "11px Arial";
        ctxTiro.fillText(`Viento: ${wind.toFixed(1)} | Ronda: ${round}/${maxRounds}`, offset + 15, 50);
    }
}

function setupTiroControls(cont) {
    const btn = document.createElement('div');
    btn.innerHTML = "TAP PARA DISPARAR";
    btn.style.cssText = "width:90%; height:70px; background:#222; border:3px solid #39FF14; color:#fff; display:flex; align-items:center; justify-content:center; margin:10px auto; border-radius:15px; font-weight:bold; user-select:none;";
    btn.onclick = () => { if (!myArrow.isFlying && !myArrow.hasShot) myArrow.isFlying = true; };
    btn.ontouchstart = (e) => { e.preventDefault(); if (!myArrow.isFlying && !myArrow.hasShot) myArrow.isFlying = true; };
    cont.appendChild(btn);
}

function endTiro() {
    isTiroActive = false;
    let msg = myTiroScore > oppTiroScore ? "¡GANASTE EL DUELO!" : (myTiroScore < oppTiroScore ? "EL RIVAL GANA..." : "¡EMPATE!");
    alert(`FIN DEL JUEGO\nTu: ${myTiroScore} | Rival: ${oppTiroScore}\n${msg}`);
    window.location.reload();
}
