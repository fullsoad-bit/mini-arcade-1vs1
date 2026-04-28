// 1. Configuración del Canvas y Variables Globales
const canvasRacing = document.createElement('canvas');
const ctxRacing = canvasRacing.getContext('2d');

const baseWidth = 400;
const baseHeight = 600;
canvasRacing.width = baseWidth;
canvasRacing.height = baseHeight;
canvasRacing.style.backgroundColor = "#0d0208";
canvasRacing.style.border = "4px solid #FF00FF";
canvasRacing.style.display = "block";
canvasRacing.style.margin = "10px auto";
canvasRacing.style.maxWidth = "95vw";
canvasRacing.style.maxHeight = "70vh";
canvasRacing.style.touchAction = "none";

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
let timerInterval, obstacleInterval, syncInterval;

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// 2. Función de Inicio
function startRacing(roomId, isHost) {
    console.log("Iniciando Carrera 2D Multijugador...");
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

    if (isMobile) setupMobileControls(container);

    // Cronómetro
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => { 
        if (timeLeft > 0) timeLeft--; 
        else endRacing();
    }, 1000);

    // LÓGICA EXCLUSIVA DEL HOST (Servidor local)
    if (isHost) {
        if (obstacleInterval) clearInterval(obstacleInterval);
        obstacleInterval = setInterval(spawnObstacle, 800);

        // Sincronización: El Host envía la posición de todos los obstáculos al Guest
        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(() => {
            if(isRacingActive) {
                socket.emit('game_event', {
                    roomId: racingRoomId,
                    type: 'sync_obstacles',
                    obsList: obstacles
                });
            }
        }, 50); // 20 veces por segundo para suavidad
    }

    renderRacing();
}

// 3. Comunicación por Sockets
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        if (data.game === 'carrera') {
            if (data.role === 'host') carHost.x = data.x;
            else carGuest.x = data.x;
        }
    });

    socket.on('opponent_event', (data) => {
        // El Guest recibe los obstáculos del Host
        if (data.type === 'sync_obstacles' && racingRole === 'guest') {
            obstacles = data.obsList;
        }
        // Manejo de choques y stuns
        if(data.type === 'stun') {
            let car = (data.role === 'host') ? carHost : carGuest;
            car.stun = 50;
            car.crashes = data.crashes;
        }
    });
}

// 4. Funciones de Lógica de Juego
function spawnObstacle() {
    if (racingRole === 'host' && isRacingActive) {
        const obs = { x: Math.random() * 300 + 50, y: -50, color: "#FF3131" };
        obstacles.push(obs);
    }
}

function movePlayer(dir) {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;

    if (dir === "left" && myCar.x > 20) myCar.x -= 20;
    if (dir === "right" && myCar.x < 340) myCar.x += 20;

    socket.emit('player_move', { 
        roomId: racingRoomId, game: 'carrera', x: myCar.x, role: racingRole 
    });
}

function renderRacing() {
    if (!isRacingActive) return;

    // Fondo y carretera
    ctxRacing.fillStyle = "#0d0208";
    ctxRacing.fillRect(0, 0, baseWidth, baseHeight);
    
    // Solo el HOST calcula el movimiento de los obstáculos
    if (racingRole === 'host') {
        obstacles.forEach(obs => obs.y += racingSpeed);
        obstacles = obstacles.filter(obs => obs.y < baseHeight + 50);
    }

    // Dibujar Obstáculos (Ambos jugadores)
    obstacles.forEach((obs) => {
        ctxRacing.fillStyle = obs.color;
        ctxRacing.shadowBlur = 10;
        ctxRacing.shadowColor = obs.color;
        ctxRacing.fillRect(obs.x, obs.y, 40, 40);
        ctxRacing.shadowBlur = 0;

        // Colisión individual
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

    // Dibujar autos con efecto neon
    drawCar(carHost);
    drawCar(carGuest);

    // Interfaz de usuario (HUD)
    ctxRacing.fillStyle = "white";
    ctxRacing.font = "bold 18px Monospace";
    ctxRacing.fillText(`⏱️ ${timeLeft}s`, 20, 30);
    ctxRacing.fillText(`💥 YO: ${racingRole === 'host' ? carHost.crashes : carGuest.crashes}`, 20, 55);
    ctxRacing.fillText(`🏎️ RIVAL: ${racingRole === 'host' ? carGuest.crashes : carHost.crashes}`, 20, 80);

    roadOffset += racingSpeed;
    requestAnimationFrame(renderRacing);
}

function drawCar(car) {
    if (car.stun > 0) {
        car.stun--;
        if (Math.floor(Date.now() / 100) % 2 === 0) return;
    }
    ctxRacing.shadowBlur = 15;
    ctxRacing.shadowColor = car.color;
    ctxRacing.fillStyle = car.color;
    ctxRacing.fillRect(car.x, car.y, carW, carH);
    ctxRacing.shadowBlur = 0;
}

function endRacing() {
    isRacingActive = false;
    clearInterval(timerInterval);
    clearInterval(obstacleInterval);
    clearInterval(syncInterval);
    alert(`CARRERA TERMINADA\nChoques: ${racingRole === 'host' ? carHost.crashes : carGuest.crashes}`);
    window.location.reload();
}

// 5. Controles (Teclado y Táctil)
window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") movePlayer("left");
    if (e.key === "ArrowRight") movePlayer("right");
});

function setupMobileControls(container) {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = "display:flex; justify-content:space-between; width:95vw; margin:10px auto;";

    const btnStyle = `
        width: 45%; height: 70px; background: rgba(255, 0, 255, 0.2);
        border: 2px solid #FF00FF; border-radius: 15px; color: white;
        font-size: 30px; display: flex; align-items: center; justify-content: center;
        user-select: none; -webkit-tap-highlight-color: transparent;
    `;

    const btnLeft = document.createElement('div');
    btnLeft.innerHTML = "◀️";
    btnLeft.style.cssText = btnStyle;

    const btnRight = document.createElement('div');
    btnRight.innerHTML = "▶️";
    btnRight.style.cssText = btnStyle;

    // Manejo de toque continuo
    let moveInterval;
    const start = (dir) => { movePlayer(dir); moveInterval = setInterval(() => movePlayer(dir), 80); };
    const stop = () => clearInterval(moveInterval);

    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); start("left"); });
    btnLeft.addEventListener('touchend', stop);
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); start("right"); });
    btnRight.addEventListener('touchend', stop);

    controlsDiv.appendChild(btnLeft);
    controlsDiv.appendChild(btnRight);
    container.appendChild(controlsDiv);
}
