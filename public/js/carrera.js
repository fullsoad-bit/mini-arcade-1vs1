const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400; 
canvasRacing.height = 600;
canvasRacing.style.border = "4px solid #FF00FF";
canvasRacing.style.display = "block"; 
canvasRacing.style.margin = "20px auto";
canvasRacing.style.boxShadow = "0 0 20px #FF00FF";

let racingRoomId = null;
let racingRole = "spectator"; 
let isRacingActive = false;

const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 }; 
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 }; 

let obstacles = [];
let particles = [];
let roadOffset = 0;
let racingSpeed = 8; 
let timeLeft = 60; // Reducido a 60s para hacerlo más dinámico
let timerInterval, obstacleInterval;

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
            color: "#FF3131"
        };
        obstacles.push(obs);
        socket.emit('spawn_obstacle', { roomId: racingRoomId, obs: obs });
    }
}

function drawRoad() {
    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, canvasRacing.width, canvasRacing.height);
    ctxRacing.strokeStyle = "#00F3FF";
    ctxRacing.lineWidth = 5;
    ctxRacing.beginPath();
    ctxRacing.moveTo(15, 0); ctxRacing.lineTo(15, 600);
    ctxRacing.moveTo(385, 0); ctxRacing.lineTo(385, 600);
    ctxRacing.stroke();

    ctxRacing.setLineDash([40, 40]);
    ctxRacing.lineDashOffset = -roadOffset;
    ctxRacing.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctxRacing.beginPath();
    ctxRacing.moveTo(200, 0); ctxRacing.lineTo(200, 600);
    ctxRacing.stroke();
    ctxRacing.setLineDash([]);
}

function drawCar(car) {
    if (car.stun > 0) {
        car.stun--;
        if (Math.floor(Date.now() / 100) % 2 === 0) return;
    }
    ctxRacing.save();
    ctxRacing.shadowBlur = 15;
    ctxRacing.shadowColor = car.color;
    ctxRacing.fillStyle = car.color;
    ctxRacing.fillRect(car.x, car.y, carW, carH);
    ctxRacing.fillStyle = "#FFF";
    ctxRacing.fillRect(car.x + 5, car.y - 5, 8, 5);
    ctxRacing.fillRect(car.x + carW - 13, car.y - 5, 8, 5);
    ctxRacing.restore();
}

function renderRacing() {
    if (!isRacingActive) return;

    drawRoad();

    obstacles.forEach((obs, index) => {
        obs.y += racingSpeed;
        ctxRacing.fillStyle = obs.color;
        ctxRacing.fillRect(obs.x, obs.y, 40, 40);

        let myCar = (racingRole === 'host') ? carHost : carGuest;
        if (myCar.stun <= 0 && 
            myCar.x < obs.x + 40 && myCar.x + carW > obs.x &&
            myCar.y < obs.y + 40 && myCar.y + carH > obs.y) {
            
            myCar.stun = 50; 
            myCar.crashes++;
            createExplosion(myCar.x, myCar.y, myCar.color);
            socket.emit('game_event', { 
                roomId: racingRoomId, type: 'stun', role: racingRole, crashes: myCar.crashes 
            });
        }
        if (obs.y > canvasRacing.height) obstacles.splice(index, 1);
    });

    particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        ctxRacing.fillStyle = p.color;
        ctxRacing.fillRect(p.x, p.y, 3, 3);
        if(p.life <= 0) particles.splice(i, 1);
    });

    drawCar(carHost);
    drawCar(carGuest);

    ctxRacing.font = "12px 'Press Start 2P'";
    ctxRacing.fillStyle = "#FFF";
    ctxRacing.fillText(`TIME: ${timeLeft}s`, 20, 40);
    ctxRacing.fillStyle = carHost.color;
    ctxRacing.fillText(`P1:${carHost.crashes}`, 20, 70);
    ctxRacing.fillStyle = carGuest.color;
    ctxRacing.fillText(`P2:${carGuest.crashes}`, 280, 70);

    roadOffset += racingSpeed;
    requestAnimationFrame(renderRacing);
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    
    let msg = "";
    if(carHost.crashes < carGuest.crashes) msg = "¡P1 GANA POR AGILIDAD!";
    else if(carGuest.crashes < carHost.crashes) msg = "¡P2 GANA POR AGILIDAD!";
    else msg = "¡EMPATE!";

    alert(msg);
    window.location.reload();
}

// --- ESCUCHA DE RED ---
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (data.game === 'carrera') {
            if (data.role === 'host') carHost.x = data.x;
            else carGuest.x = data.x;
        }
    });

    socket.on('new_obstacle', (data) => {
        if (racingRole === 'guest') obstacles.push(data.obs);
    });

    socket.on('opponent_event', (data) => {
        if(data.type === 'stun') {
            let car = (data.role === 'host') ? carHost : carGuest;
            car.stun = 50;
            car.crashes = data.crashes;
            createExplosion(car.x, car.y, car.color);
        }
    });
}

window.addEventListener("keydown", (e) => {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;
    
    if (e.key === "ArrowLeft" && myCar.x > 30) myCar.x -= 20;
    if (e.key === "ArrowRight" && myCar.x < canvasRacing.width - 70) myCar.x += 20;
    
    socket.emit('player_move', { 
        roomId: racingRoomId, 
        game: 'carrera',
        x: myCar.x, 
        role: racingRole 
    });
});

function startRacing(roomId, isHost) {
    racingRoomId = roomId;
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    obstacles = [];
    particles = [];
    carHost.crashes = 0;
    carGuest.crashes = 0;

    timerInterval = setInterval(() => { 
        timeLeft--; 
        if (timeLeft <= 0) endRacing();
    }, 1000);

    if (isHost) {
        obstacleInterval = setInterval(spawnObstacle, 800);
    }

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);
    renderRacing();
}
