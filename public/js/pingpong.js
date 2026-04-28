const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Ajuste para móviles: Si es celular, lo hacemos un poco más estrecho
const isMobileDevice = /Android|iPhone|iPad/i.test(navigator.userAgent);
canvas.width = isMobileDevice ? 400 : 600; 
canvas.height = 400;

canvas.style.cssText = "background:#000; border:4px solid #39FF14; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

let currentRoomId = null;
let role = "spectator"; 
let isGameActive = false;

const paddleWidth = 12, paddleHeight = 80;
let user = { x: 0, y: 160, score: 0 };
let opponent = { x: canvas.width - 12, y: 160, score: 0 };

const INITIAL_SPEED = 4;
let ball = { x: canvas.width / 2, y: 200, speedX: INITIAL_SPEED, speedY: INITIAL_SPEED, radius: 7 };

function startPingPong(roomId, isHost) {
    currentRoomId = roomId.toString();
    role = isHost ? 'host' : 'guest';
    isGameActive = true;

    // Posiciones según rol
    if (role === 'guest') { 
        user.x = canvas.width - paddleWidth; 
        opponent.x = 0; 
    } else { 
        user.x = 0; 
        opponent.x = canvas.width - paddleWidth; 
    }

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const title = document.createElement('h2');
    title.style.cssText = "color:var(--neon-pink); font-family:'Press Start 2P'; font-size:12px; margin:10px;";
    title.innerText = `MODO: ${role.toUpperCase()} | PRIMERO A 5`;
    container.appendChild(title);
    container.appendChild(canvas);

    if (isMobileDevice) setupMobileControls(container);

    // ESCUCHADOR DE RED ÚNICO (Canal sync)
    socket.off('sync'); // Limpiar previos
    socket.on('sync', (data) => {
        if (!isGameActive) return;

        // Recibir movimiento del rival
        if (data.type === 'p_move') {
            opponent.y = data.y;
        }

        // Recibir pelota y marcador (Solo el Guest recibe del Host)
        if (data.type === 'ball_sync' && role === 'guest') {
            ball.x = data.x;
            ball.y = data.y;
            // Invertimos la lógica del marcador para que el Guest vea su puntaje a la derecha
            user.score = data.scoreGuest;
            opponent.score = data.scoreHost;
        }
    });

    gameLoop();
}

function movePaddle(dir) {
    const speed = 30;
    if (dir === "up" && user.y > 0) user.y -= speed;
    if (dir === "down" && user.y < canvas.height - paddleHeight) user.y += speed;

    socket.emit('sync', { roomId: currentRoomId, type: 'p_move', y: user.y });
}

// Control por Mouse (PC)
canvas.addEventListener("mousemove", (evt) => {
    if (!isGameActive) return;
    let rect = canvas.getBoundingClientRect();
    let mouseY = (evt.clientY - rect.top) * (canvas.height / rect.height);
    user.y = mouseY - paddleHeight / 2;

    if (user.y < 0) user.y = 0;
    if (user.y > canvas.height - paddleHeight) user.y = canvas.height - paddleHeight;

    socket.emit('sync', { roomId: currentRoomId, type: 'p_move', y: user.y });
});

function update() {
    if (role === 'host') { 
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // Rebote techo y suelo
        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
            ball.speedY = -ball.speedY;
        }

        // Colisión Paleta Izquierda (Host)
        if (ball.x - ball.radius < user.x + paddleWidth && ball.y > user.y && ball.y < user.y + paddleHeight) {
            ball.speedX = Math.abs(ball.speedX) * 1.05;
        }

        // Colisión Paleta Derecha (Guest)
        if (ball.x + ball.radius > opponent.x && ball.y > opponent.y && ball.y < opponent.y + paddleHeight) {
            ball.speedX = -Math.abs(ball.speedX) * 1.05;
        }

        // Goles
        if (ball.x < 0) { opponent.score++; resetBall(); }
        if (ball.x > canvas.width) { user.score++; resetBall(); }

        // Enviar datos al Guest
        socket.emit('sync', { 
            roomId: currentRoomId, 
            type: 'ball_sync',
            x: ball.x, 
            y: ball.y,
            scoreHost: user.score,
            scoreGuest: opponent.score
        });

        if (user.score >= 5 || opponent.score >= 5) endPingPong();
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = (ball.speedX > 0 ? -INITIAL_SPEED : INITIAL_SPEED);
}

function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Red
    ctx.strokeStyle = "#333";
    ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();

    // Paletas
    ctx.fillStyle = "#39FF14"; ctx.fillRect(user.x, user.y, paddleWidth, paddleHeight);
    ctx.fillStyle = "#FF00FF"; ctx.fillRect(opponent.x, opponent.y, paddleWidth, paddleHeight);

    // Pelota
    ctx.fillStyle = "#FFF";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();

    // Marcador
    ctx.font = "20px Monospace";
    ctx.fillStyle = "#FFF";
    ctx.fillText(user.score, (canvas.width / 2) - 50, 50);
    ctx.fillText(opponent.score, (canvas.width / 2) + 30, 50);
}

function gameLoop() {
    if (!isGameActive) return;
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function endPingPong() {
    isGameActive = false;
    alert("PARTIDA TERMINADA");
    window.location.reload();
}

function setupMobileControls(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:15px;";
    const btnS = "width:45%; height:80px; background:#333; border:2px solid #39FF14; color:white; font-size:30px; border-radius:12px; touch-action:none;";
    
    const bU = document.createElement('button'); bU.innerHTML = "🔼"; bU.style.cssText = btnS;
    const bD = document.createElement('button'); bD.innerHTML = "🔽"; bD.style.cssText = btnS;

    bU.ontouchstart = (e) => { e.preventDefault(); movePaddle("up"); };
    bD.ontouchstart = (e) => { e.preventDefault(); movePaddle("down"); };

    box.appendChild(bU); box.appendChild(bD);
    cont.appendChild(box);
}
