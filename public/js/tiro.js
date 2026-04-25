// js/tiro.js

const canvasTiro = document.createElement('canvas');
const ctxTiro = canvasTiro.getContext('2d');
canvasTiro.width = 600;
canvasTiro.height = 400;
canvasTiro.style.border = "4px solid #39FF14";
canvasTiro.style.display = "block";
canvasTiro.style.margin = "20px auto";

let tiroRoomId = null;
let tiroRole = "spectator";
let isTiroActive = false;

// Variables de juego
let myTiroScore = 0;
let oppTiroScore = 0;
let round = 1;
const maxRounds = 10;

// Flecha y arco
let arrow = { x: 50, y: 200, angle: 0, power: 0, isFlying: false };
let target = { x: 500, y: 200, radius: 40 };
let wind = 0;

function renderTiro() {
    if (!isTiroActive) return;

    // Fondo
    ctxTiro.fillStyle = "#0d0208";
    ctxTiro.fillRect(0, 0, canvasTiro.width, canvasTiro.height);

    // Dibujar Diana (Target)
    drawTarget(target.x, target.y);

    // Dibujar Flecha
    drawArrow(arrow.x, arrow.y, arrow.angle);

    // HUD Neón
    ctxTiro.fillStyle = "#FFF";
    ctxTiro.font = "10px 'Press Start 2P'";
    ctxTiro.fillText(`RONDA: ${round}/${maxRounds}`, 20, 30);
    ctxTiro.fillText(`VIENTO: ${wind.toFixed(1)}`, 20, 50);
    
    ctxTiro.fillStyle = "#39FF14";
    ctxTiro.fillText(`TU: ${myTiroScore}`, 450, 30);
    ctxTiro.fillStyle = "#FF00FF";
    ctxTiro.fillText(`RIVAL: ${oppTiroScore}`, 450, 50);

    if (!arrow.isFlying) {
        ctxTiro.fillStyle = "yellow";
        ctxTiro.fillText("MANTÉN ESPACIO PARA POTENCIA", 150, 380);
    }

    updateTiro();
    requestAnimationFrame(renderTiro);
}

function drawTarget(x, y) {
    const colors = ["white", "black", "blue", "red", "yellow"];
    for (let i = 0; i < 5; i++) {
        ctxTiro.beginPath();
        ctxTiro.fillStyle = colors[i];
        ctxTiro.arc(x, y, target.radius - (i * 7), 0, Math.PI * 2);
        ctxTiro.fill();
    }
}

function drawArrow(x, y, angle) {
    ctxTiro.save();
    ctxTiro.translate(x, y);
    ctxTiro.rotate(angle);
    ctxTiro.strokeStyle = "white";
    ctxTiro.lineWidth = 3;
    ctxTiro.beginPath();
    ctxTiro.moveTo(0, 0);
    ctxTiro.lineTo(-30, 0);
    ctxTiro.stroke();
    ctxTiro.restore();
}

function updateTiro() {
    if (arrow.isFlying) {
        arrow.x += Math.cos(arrow.angle) * arrow.power;
        arrow.y += Math.sin(arrow.angle) * arrow.power + wind; // Efecto del viento

        // Verificar impacto
        let dist = Math.sqrt(Math.pow(arrow.x - target.x, 2) + Math.pow(arrow.y - target.y, 2));
        
        if (dist < target.radius || arrow.x > 600) {
            if (dist < target.radius) {
                let points = Math.floor(50 - dist);
                myTiroScore += points;
                socket.emit('player_move', { roomId: tiroRoomId, score: myTiroScore, role: tiroRole });
            }
            resetArrow();
            nextRound();
        }
    } else {
        // Apuntar
        arrow.angle = Math.sin(Date.now() / 500) * 0.5;
    }
}

function resetArrow() {
    arrow.isFlying = false;
    arrow.x = 50;
    arrow.y = 200;
    arrow.power = 0;
}

function nextRound() {
    round++;
    if (tiroRole === 'host') {
        wind = (Math.random() - 0.5) * 4;
        socket.emit('player_move', { roomId: tiroRoomId, wind: wind, type: 'wind_sync' });
    }
    if (round > maxRounds) endTiro();
}

// Controles
window.addEventListener("keydown", (e) => {
    if (!isTiroActive || arrow.isFlying) return;
    if (e.code === "Space") {
        arrow.power += 0.5;
        if (arrow.power > 15) arrow.power = 15;
    }
});

window.addEventListener("keyup", (e) => {
    if (!isTiroActive || arrow.isFlying) return;
    if (e.code === "Space") {
        arrow.isFlying = true;
    }
});

// Sincronización
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (data.type === 'wind_sync') {
            wind = data.wind;
        } else {
            oppTiroScore = data.score;
        }
    });
}

function endTiro() {
    isTiroActive = false;
    let msg = myTiroScore > oppTiroScore ? "¡PUNTERÍA DE ELITE! GANASTE" : "EL RIVAL TIENE MEJOR OJO";
    if (myTiroScore === oppTiroScore) msg = "¡EMPATE DE ARQUEROS!";
    alert(`FIN DE LAS 10 RONDAS\nTu: ${myTiroScore}\nRival: ${oppTiroScore}\n\n${msg}`);
    location.reload();
}

function startTiro(roomId, isHost) {
    tiroRoomId = roomId;
    tiroRole = isHost ? 'host' : 'guest';
    isTiroActive = true;
    
    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasTiro);
    renderTiro();
}
