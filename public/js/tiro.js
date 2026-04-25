const canvasTiro = document.createElement('canvas');
const ctxTiro = canvasTiro.getContext('2d');
canvasTiro.width = 600;
canvasTiro.height = 400;
canvasTiro.style.border = "4px solid #39FF14";
canvasTiro.style.display = "block";
canvasTiro.style.margin = "20px auto";
canvasTiro.style.boxShadow = "0 0 20px rgba(57, 255, 20, 0.3)";

let tiroRoomId = null;
let tiroRole = "spectator";
let isTiroActive = false;

let myTiroScore = 0;
let oppTiroScore = 0;
let round = 1;
const maxRounds = 10;

let arrow = { x: 50, y: 200, angle: 0, power: 0, isFlying: false };
let target = { x: 520, y: 200, radius: 40 };
let wind = 0;
let spacePressed = false;

function drawTarget(x, y) {
    const colors = ["#FFF", "#000", "#00F", "#F00", "#FF0"];
    for (let i = 0; i < 5; i++) {
        ctxTiro.beginPath();
        ctxTiro.fillStyle = colors[i];
        ctxTiro.arc(x, y, target.radius - (i * 8), 0, Math.PI * 2);
        ctxTiro.fill();
        ctxTiro.strokeStyle = "#444";
        ctxTiro.stroke();
    }
}

function drawArrow(x, y, angle) {
    ctxTiro.save();
    ctxTiro.translate(x, y);
    ctxTiro.rotate(angle);
    
    // Cuerpo de la flecha
    ctxTiro.strokeStyle = "#EEE";
    ctxTiro.lineWidth = 3;
    ctxTiro.beginPath();
    ctxTiro.moveTo(0, 0);
    ctxTiro.lineTo(-35, 0);
    ctxTiro.stroke();
    
    // Punta
    ctxTiro.fillStyle = "#FF3131";
    ctxTiro.beginPath();
    ctxTiro.moveTo(0, 0);
    ctxTiro.lineTo(-10, -5);
    ctxTiro.lineTo(-10, 5);
    ctxTiro.fill();
    
    ctxTiro.restore();
}

function updateTiro() {
    if (arrow.isFlying) {
        arrow.x += Math.cos(arrow.angle) * arrow.power;
        arrow.y += Math.sin(arrow.angle) * arrow.power + wind;

        let dist = Math.sqrt(Math.pow(arrow.x - target.x, 2) + Math.pow(arrow.y - target.y, 2));
        
        if (dist < target.radius || arrow.x > canvasTiro.width || arrow.y < 0 || arrow.y > canvasTiro.height) {
            if (dist < target.radius) {
                let points = Math.max(10, Math.floor((target.radius - dist) * 2.5));
                myTiroScore += points;
                syncTiroData();
            }
            resetArrow();
            nextRound();
        }
    } else {
        arrow.angle = Math.sin(Date.now() / 600) * 0.6;
        if (spacePressed) {
            arrow.power += 0.25;
            if (arrow.power > 18) arrow.power = 18;
        }
    }
}

function renderTiro() {
    if (!isTiroActive) return;

    ctxTiro.fillStyle = "#0d0208";
    ctxTiro.fillRect(0, 0, canvasTiro.width, canvasTiro.height);

    // Dibujar Diana
    drawTarget(target.x, target.y);

    // Dibujar Flecha
    drawArrow(arrow.x, arrow.y, arrow.angle);

    // HUD
    ctxTiro.fillStyle = "#FFF";
    ctxTiro.font = "10px 'Press Start 2P'";
    ctxTiro.fillText(`RONDA: ${round}/${maxRounds}`, 20, 35);
    
    // Indicador de Viento
    ctxTiro.fillStyle = wind > 0 ? "#FF00FF" : "#39FF14";
    ctxTiro.fillText(`VIENTO: ${wind > 0 ? '↓' : '↑'} ${Math.abs(wind).toFixed(1)}`, 20, 60);
    
    ctxTiro.fillStyle = "#39FF14";
    ctxTiro.fillText(`TU: ${myTiroScore}`, 440, 35);
    ctxTiro.fillStyle = "#FF00FF";
    ctxTiro.fillText(`RIVAL: ${oppTiroScore}`, 440, 60);

    // Barra de Potencia
    if (spacePressed) {
        ctxTiro.fillStyle = "#333";
        ctxTiro.fillRect(150, 360, 300, 15);
        ctxTiro.fillStyle = "yellow";
        ctxTiro.fillRect(150, 360, (arrow.power / 18) * 300, 15);
    } else if (!arrow.isFlying) {
        ctxTiro.fillStyle = "rgba(255,255,255,0.5)";
        ctxTiro.fillText("DEJA PRESIONADO ESPACIO", 160, 375);
    }

    updateTiro();
    requestAnimationFrame(renderTiro);
}

function resetArrow() {
    arrow.isFlying = false;
    arrow.x = 50;
    arrow.y = 200;
    arrow.power = 0;
    spacePressed = false;
}

function nextRound() {
    round++;
    if (tiroRole === 'host') {
        wind = (Math.random() - 0.5) * 3.5;
        syncTiroData();
    }
    if (round > maxRounds) setTimeout(endTiro, 500);
}

function syncTiroData() {
    if (tiroRoomId && typeof socket !== 'undefined') {
        socket.emit('target_sync', { 
            roomId: tiroRoomId, 
            score: myTiroScore, 
            wind: wind,
            role: tiroRole 
        });
    }
}

if (typeof socket !== 'undefined') {
    socket.on('target_update', (data) => {
        oppTiroScore = data.score;
        if (tiroRole === 'guest') wind = data.wind;
    });
}

window.addEventListener("keydown", (e) => {
    if (!isTiroActive || arrow.isFlying) return;
    if (e.code === "Space") spacePressed = true;
});

window.addEventListener("keyup", (e) => {
    if (!isTiroActive || arrow.isFlying) return;
    if (e.code === "Space") {
        spacePressed = false;
        arrow.isFlying = true;
    }
});

function endTiro() {
    isTiroActive = false;
    let result = myTiroScore > oppTiroScore ? "¡ERES UN ROBIN HOOD!" : (myTiroScore < oppTiroScore ? "SUERTE PARA LA PRÓXIMA" : "¡EMPATE!");
    alert(`RESULTADO FINAL\nTu: ${myTiroScore} | Rival: ${oppTiroScore}\n\n${result}`);
    window.location.reload();
}

function startTiro(roomId, isHost) {
    tiroRoomId = roomId;
    tiroRole = isHost ? 'host' : 'guest';
    isTiroActive = true;
    myTiroScore = 0;
    oppTiroScore = 0;
    round = 1;
    wind = isHost ? (Math.random() - 0.5) * 2 : 0;
    
    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasTiro);
    renderTiro();
}
