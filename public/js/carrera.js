// 1. Declarar variables globales al principio para que siempre existan
const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');
canvasRacing.width = 400; 
canvasRacing.height = 600;
canvasRacing.style.border = "4px solid #FF00FF";
canvasRacing.style.display = "block"; 
canvasRacing.style.margin = "20px auto";

let racingRoomId = null;
let racingRole = "spectator"; 
let isRacingActive = false; // <-- Esto resuelve el error de la captura

const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 }; 
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 }; 

let obstacles = [];
let particles = [];
let roadOffset = 0;
let racingSpeed = 8; 
let timeLeft = 60; 
let timerInterval, obstacleInterval;

// 2. Definir la función de inicio que llama el index.html
function startRacing(roomId, isHost) {
    console.log("Iniciando Carrera 2D...");
    racingRoomId = roomId;
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;
    
    // Reset de estado
    obstacles = [];
    timeLeft = 60;
    carHost.crashes = 0;
    carGuest.crashes = 0;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    // Intervalos
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        if (timeLeft > 0) timeLeft--; 
        else endRacing();
    }, 1000);

    if (isHost) {
        if (obstacleInterval) clearInterval(obstacleInterval);
        obstacleInterval = setInterval(spawnObstacle, 800);
    }

    renderRacing();
}

// 3. Lógica de Red (Escuchadores)
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
        }
    });
}

// 4. Resto de funciones auxiliares
function spawnObstacle() {
    if (racingRole === 'host' && isRacingActive) {
        const obs = { x: Math.random() * 300 + 50, y: -50, color: "#FF3131" };
        obstacles.push(obs);
        socket.emit('spawn_obstacle', { roomId: racingRoomId, obs: obs });
    }
}

function renderRacing() {
    if (!isRacingActive) return;

    // Dibujar carretera
    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, canvasRacing.width, canvasRacing.height);
    
    // Dibujar obstáculos
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
            socket.emit('game_event', { 
                roomId: racingRoomId, type: 'stun', role: racingRole, crashes: myCar.crashes 
            });
        }
    });

    // Dibujar autos
    drawCar(carHost);
    drawCar(carGuest);

    roadOffset += racingSpeed;
    requestAnimationFrame(renderRacing);
}

function drawCar(car) {
    if (car.stun > 0) { car.stun--; if (Math.floor(Date.now() / 100) % 2 === 0) return; }
    ctxRacing.fillStyle = car.color;
    ctxRacing.fillRect(car.x, car.y, carW, carH);
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    alert("FIN DE LA CARRERA");
    window.location.reload();
}

// Controles
window.addEventListener("keydown", (e) => {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;
    
    if (e.key === "ArrowLeft" && myCar.x > 20) myCar.x -= 20;
    if (e.key === "ArrowRight" && myCar.x < 340) myCar.x += 20;
    
    socket.emit('player_move', { 
        roomId: racingRoomId, game: 'carrera', x: myCar.x, role: racingRole 
    });
});
