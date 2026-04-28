// 1. Declarar variables globales
const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

// Configuración responsiva
const baseWidth = 400;
const baseHeight = 600;
canvasRacing.width = baseWidth;
canvasRacing.height = baseHeight;
canvasRacing.style.backgroundColor = "#0d0208";
canvasRacing.style.border = "4px solid #FF00FF";
canvasRacing.style.display = "block";
canvasRacing.style.margin = "10px auto";
canvasRacing.style.maxWidth = "95vw"; // No se sale de la pantalla en móviles
canvasRacing.style.maxHeight = "70vh";
canvasRacing.style.touchAction = "none"; // Evita que la pantalla se mueva al tocar

let racingRoomId = null;
let racingRole = "spectator";
let isRacingActive = false;

const carW = 40, carH = 70;
let carHost = { x: 100, y: 480, color: "#39FF14", stun: 0, crashes: 0 };
let carGuest = { x: 260, y: 480, color: "#FF00FF", stun: 0, crashes: 0 };

let obstacles = [];
let roadOffset = 0;
let racingSpeed = 8;
let timeLeft = 60;
let timerInterval, obstacleInterval;

// Detectar si es móvil
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 2. Función de inicio
function startRacing(roomId, isHost) {
    console.log("Iniciando Carrera 2D Adaptada...");
    racingRoomId = roomId;
    racingRole = isHost ? 'host' : 'guest';
    isRacingActive = true;

    obstacles = [];
    timeLeft = 60;
    carHost.crashes = 0;
    carGuest.crashes = 0;

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    container.appendChild(canvasRacing);

    // Crear controles si es móvil
    if (isMobile) {
        setupMobileControls(container);
    }

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

// 3. Lógica de Red
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
        if (data.type === 'stun') {
            let car = (data.role === 'host') ? carHost : carGuest;
            car.stun = 50;
            car.crashes = data.crashes;
        }
    });
}

// 4. Funciones de Juego
function spawnObstacle() {
    if (racingRole === 'host' && isRacingActive) {
        const obs = { x: Math.random() * (baseWidth - 60) + 30, y: -50, color: "#FF3131" };
        obstacles.push(obs);
        socket.emit('spawn_obstacle', { roomId: racingRoomId, obs: obs });
    }
}

function movePlayer(dir) {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;

    if (dir === "left" && myCar.x > 20) myCar.x -= 25;
    if (dir === "right" && myCar.x < (baseWidth - carW - 20)) myCar.x += 25;

    socket.emit('player_move', {
        roomId: racingRoomId, game: 'carrera', x: myCar.x, role: racingRole
    });
}

function renderRacing() {
    if (!isRacingActive) return;

    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, canvasRacing.width, canvasRacing.height);

    // Líneas de carretera
    ctxRacing.strokeStyle = "#FFF";
    ctxRacing.setLineDash([20, 20]);
    ctxRacing.lineDashOffset = -roadOffset;
    ctxRacing.beginPath();
    ctxRacing.moveTo(baseWidth / 2, 0);
    ctxRacing.lineTo(baseWidth / 2, baseHeight);
    ctxRacing.stroke();

    obstacles.forEach((obs, index) => {
        obs.y += racingSpeed;
        ctxRacing.fillStyle = obs.color;
        ctxRacing.shadowBlur = 10;
        ctxRacing.shadowColor = obs.color;
        ctxRacing.fillRect(obs.x, obs.y, 40, 40);
        ctxRacing.shadowBlur = 0;

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

    // Eliminar obstáculos fuera de pantalla
    obstacles = obstacles.filter(o => o.y < baseHeight + 50);

    drawCar(carHost);
    drawCar(carGuest);

    // UI de Tiempo y Choques
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "20px Monospace";
    ctxRacing.fillText(`TIEMPO: ${timeLeft}s`, 20, 30);
    ctxRacing.fillText(`CHOQUES: ${(racingRole === 'host' ? carHost.crashes : carGuest.crashes)}`, 20, 60);

    roadOffset += racingSpeed;
    requestAnimationFrame(renderRacing);
}

function drawCar(car) {
    if (car.stun > 0) {
        car.stun--;
        if (Math.floor(Date.now() / 100) % 2 === 0) return;
    }
    ctxRacing.fillStyle = car.color;
    ctxRacing.shadowBlur = 15;
    ctxRacing.shadowColor = car.color;
    ctxRacing.fillRect(car.x, car.y, carW, carH);
    ctxRacing.shadowBlur = 0;
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    alert(`FIN! Choques totales: ${racingRole === 'host' ? carHost.crashes : carGuest.crashes}`);
    window.location.reload();
}

// --- CONTROLES (PC y MÓVIL) ---

// Teclado PC
window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") movePlayer("left");
    if (e.key === "ArrowRight") movePlayer("right");
});

// Controles Táctiles Android
function setupMobileControls(container) {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.display = "flex";
    controlsDiv.style.justifyContent = "space-between";
    controlsDiv.style.width = "95vw";
    controlsDiv.style.margin = "10px auto";

    const btnStyle = `
        width: 45%;
        height: 80px;
        background: rgba(255, 0, 255, 0.3);
        border: 2px solid #FF00FF;
        border-radius: 10px;
        color: white;
        font-size: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    `;

    const btnLeft = document.createElement('div');
    btnLeft.innerHTML = "◀️";
    btnLeft.style.cssText = btnStyle;

    const btnRight = document.createElement('div');
    btnRight.innerHTML = "▶️";
    btnRight.style.cssText = btnStyle;

    // Eventos Touch
    let moveInterval;
    
    const startMoving = (dir) => {
        movePlayer(dir);
        moveInterval = setInterval(() => movePlayer(dir), 100);
    };
    
    const stopMoving = () => clearInterval(moveInterval);

    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); startMoving("left"); });
    btnLeft.addEventListener('touchend', stopMoving);
    
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); startMoving("right"); });
    btnRight.addEventListener('touchend', stopMoving);

    controlsDiv.appendChild(btnLeft);
    controlsDiv.appendChild(btnRight);
    container.appendChild(controlsDiv);
}

