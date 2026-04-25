// js/carrera.js (VERSIÓN MEJORADA)

const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400; 
canvasRacing.height = 600;
canvasRacing.style.border = "4px solid #FF00FF";
canvasRacing.style.display = "block"; 
canvasRacing.style.margin = "20px auto";
canvasRacing.style.boxShadow = "0 0 20px #FF00FF"; // Glow exterior

let racingRoomId = null;
let racingRole = "spectator"; 
let isRacingActive = false;

// --- CONFIGURACIÓN DE AUTOS ---
const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0, lightColor: "rgba(57, 255, 20, 0.5)" }; 
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0, lightColor: "rgba(255, 0, 255, 0.5)" }; 

let obstacles = [];
let particles = []; // Sistema de partículas
let roadOffset = 0;
let racingSpeed = 8; 
let timeLeft = 120; 
let timerInterval, obstacleInterval;

// --- SISTEMA DE PARTÍCULAS ---
function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x + 20, y: y + 20,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 20,
            color: color
        });
    }
}

function spawnObstacle() {
    if (racingRole === 'host' && isRacingActive) {
        const obs = {
            x: Math.random() * (canvasRacing.width - 60) + 30,
            y: -50,
            id: Date.now() + Math.random(),
            color: "#FF3131"
        };
        obstacles.push(obs);
        socket.emit('spawn_obstacle', { roomId: racingRoomId, obs: obs });
    }
}

function drawRoad() {
    // Fondo asfalto
    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, canvasRacing.width, canvasRacing.height);

    // Líneas laterales de neón
    ctxRacing.strokeStyle = "#00F3FF";
    ctxRacing.lineWidth = 5;
    ctxRacing.beginPath();
    ctxRacing.moveTo(15, 0); ctxRacing.lineTo(15, 600);
    ctxRacing.moveTo(385, 0); ctxRacing.lineTo(385, 600);
    ctxRacing.stroke();

    // Líneas discontinuas centrales
    ctxRacing.setLineDash([40, 40]);
    ctxRacing.lineDashOffset = -roadOffset;
    ctxRacing.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctxRacing.beginPath();
    ctxRacing.moveTo(200, 0); ctxRacing.lineTo(200, 600);
    ctxRacing.stroke();
    ctxRacing.setLineDash([]); // Reset
}

function drawCar(car) {
    if (car.stun > 0) {
        car.stun--;
        if (Math.floor(Date.now() / 100) % 2 === 0) return;
    }

    ctxRacing.save();
    // Efecto de brillo (Glow)
    ctxRacing.shadowBlur = 15;
    ctxRacing.shadowColor = car.color;

    // Cuerpo del auto
    ctxRacing.fillStyle = car.color;
    ctxRacing.fillRect(car.x, car.y, carW, carH);
    
    // Luces / Faros
    ctxRacing.fillStyle = "#FFF";
    ctxRacing.fillRect(car.x + 5, car.y - 5, 8, 5);
    ctxRacing.fillRect(car.x + carW - 13, car.y - 5, 8, 5);

    // Alerón
    ctxRacing.fillStyle = "rgba(0,0,0,0.5)";
    ctxRacing.fillRect(car.x - 5, car.y + carH - 10, carW + 10, 5);

    ctxRacing.restore();
}

function renderRacing() {
    if (!isRacingActive) return;

    drawRoad();

    // Actualizar y dibujar obstáculos
    obstacles.forEach((obs, index) => {
        obs.y += racingSpeed;
        
        // Dibujo obstáculo con glow
        ctxRacing.shadowBlur = 10;
        ctxRacing.shadowColor = obs.color;
        ctxRacing.fillStyle = obs.color;
        ctxRacing.fillRect(obs.x, obs.y, 40, 40);
        ctxRacing.shadowBlur = 0; // Reset glow

        let myCar = (racingRole === 'host') ? carHost : carGuest;
        
        if (myCar.stun <= 0 && 
            myCar.x < obs.x + 40 && myCar.x + carW > obs.x &&
            myCar.y < obs.y + 40 && myCar.y + carH > obs.y) {
            
            myCar.stun = 50; 
            myCar.crashes++;
            createExplosion(myCar.x, myCar.y, myCar.color);
            socket.emit('player_stunned', { 
                roomId: racingRoomId, role: racingRole, totalCrashes: myCar.crashes 
            });
        }
        if (obs.y > canvasRacing.height) obstacles.splice(index, 1);
    });

    // Dibujar Partículas
    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        ctxRacing.fillStyle = p.color;
        ctxRacing.fillRect(p.x, p.y, 3, 3);
        if(p.life <= 0) particles.splice(i, 1);
    });

    drawCar(carHost);
    drawCar(carGuest);

    // --- HUD ---
    ctxRacing.font = "12px 'Press Start 2P'";
    ctxRacing.fillStyle = "#FFF";
    ctxRacing.fillText(`TIEMPO: ${timeLeft}s`, 20, 40);
    
    ctxRacing.font = "10px 'Press Start 2P'";
    ctxRacing.fillStyle = carHost.color;
    ctxRacing.fillText(`P1:${carHost.crashes}`, 20, 70);
    
    ctxRacing.fillStyle = carGuest.color;
    ctxRacing.fillText(`P2:${carGuest.crashes}`, 300, 70);

    updateRacing();
    requestAnimationFrame(renderRacing);
}

function updateRacing() {
    roadOffset += racingSpeed;
    if (timeLeft % 10 === 0 && racingSpeed < 18) racingSpeed += 0.005; 
    if (timeLeft <= 0) endGame();
}

function endGame() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);

    let finalMsg = "";
    if (carHost.crashes < carGuest.crashes) {
        finalMsg = (racingRole === 'host') ? "GANASTE - MÁS ÁGIL" : "PERDISTE - DEMASIADOS CHOQUES";
    } else if (carGuest.crashes < carHost.crashes) {
        finalMsg = (racingRole === 'guest') ? "GANASTE - MÁS ÁGIL" : "PERDISTE - DEMASIADOS CHOQUES";
    } else {
        finalMsg = "EMPATE TÉCNICO";
    }

    alert(`FIN DE LA CARRERA\n\n${finalMsg}`);
    location.reload();
}

// --- ESCUCHA DE RED (Se mantiene igual) ---
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (data.role === 'host') carHost.x = data.x;
        else carGuest.x = data.x;
    });

    socket.on('new_obstacle', (data) => {
        if (racingRole === 'guest') obstacles.push(data.obs);
    });

    socket.on('opponent_stunned', (data) => {
        let car = (data.role === 'host') ? carHost : carGuest;
        car.stun = 50;
        car.crashes = data.totalCrashes;
        createExplosion(car.x, car.y, car.color);
    });
}

window.addEventListener("keydown", (e) => {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;
    if (e.key === "ArrowLeft" && myCar.x > 30) myCar.x -= 20;
    if (e.key === "ArrowRight" && myCar.x < canvasRacing.width - 70) myCar.x += 20;
    socket.emit('player_move', { roomId: racingRoomId, x: myCar.x, role: racingRole });
});

function startRacing(roomId, isHost) {
    racingRoomId = roomId;
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    timerInterval = setInterval(() => { if (timeLeft > 0) timeLeft--; }, 1000);
    if (isHost) obstacleInterval = setInterval(spawnObstacle, 800);
    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);
    renderRacing();
}
