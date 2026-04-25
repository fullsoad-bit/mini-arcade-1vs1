// Usamos una variable para no duplicar el canvas si se reinicia
let canvas = document.querySelector('#game-canvas');
if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
}
const ctx = canvas.getContext('2d');

canvas.width = 600; 
canvas.height = 400;
canvas.style.border = "4px solid #39FF14";
canvas.style.display = "block"; 
canvas.style.margin = "20px auto";
canvas.style.backgroundColor = "black";

let currentRoomId = null;
let role = "spectator"; 

const paddleWidth = 10, paddleHeight = 80;
let user = { x: 0, y: 160, score: 0 };
let opponent = { x: 590, y: 160, score: 0 };

const INITIAL_SPEED = 4;
const SPEED_INCREMENT = 1.03; 
let ball = { x: 300, y: 200, speedX: INITIAL_SPEED, speedY: INITIAL_SPEED, radius: 7 };

function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Línea central
    ctx.strokeStyle = "#333";
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.setLineDash([]);

    // Paletas (Verde para el jugador local, Rosa para el remoto)
    ctx.fillStyle = "#39FF14"; ctx.fillRect(user.x, user.y, paddleWidth, paddleHeight);
    ctx.fillStyle = "#FF00FF"; ctx.fillRect(opponent.x, opponent.y, paddleWidth, paddleHeight);

    // Pelota
    ctx.fillStyle = "#FFF";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();

    // Marcador
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillStyle = "#FFF";
    if (role === 'host') {
        ctx.fillText(user.score, 150, 50);
        ctx.fillText(opponent.score, 450, 50);
    } else {
        ctx.fillText(opponent.score, 150, 50);
        ctx.fillText(user.score, 450, 50);
    }
}

// Escuchar movimiento del mouse
canvas.addEventListener("mousemove", (evt) => {
    let rect = canvas.getBoundingClientRect();
    let root = document.documentElement;
    let mouseY = evt.clientY - rect.top - root.scrollTop;
    user.y = mouseY - paddleHeight / 2;

    // Limitar paleta dentro del canvas
    if (user.y < 0) user.y = 0;
    if (user.y > canvas.height - paddleHeight) user.y = canvas.height - paddleHeight;

    if (currentRoomId && socket) {
        socket.emit('player_move', { roomId: currentRoomId, y: user.y });
    }
});

// Escuchar actualizaciones del oponente
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => { 
        opponent.y = data.y; 
    });

    socket.on('ball_update', (data) => {
        if (role === 'guest') {
            ball.x = data.x;
            ball.y = data.y;
            user.score = data.scoreGuest;
            opponent.score = data.scoreHost;
            checkWinner();
        }
    });
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedX = (ball.speedX > 0 ? -INITIAL_SPEED : INITIAL_SPEED);
    ball.speedY = INITIAL_SPEED * (Math.random() > 0.5 ? 1 : -1);
}

function checkWinner() {
    if (user.score >= 5 || opponent.score >= 5) {
        let win = user.score >= 5;
        alert(win ? "¡VICTORIA!" : "DERROTA");
        window.location.reload();
    }
}

function update() {
    if (role === 'host') { 
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        // Rebote paredes superior/inferior
        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
            ball.speedY = -ball.speedY;
        }

        // Colisión Paleta Izquierda (Host)
        if (ball.x - ball.radius < user.x + paddleWidth && ball.y > user.y && ball.y < user.y + paddleHeight) {
            ball.speedX = Math.abs(ball.speedX) * SPEED_INCREMENT;
            ball.speedY *= SPEED_INCREMENT;
        }

        // Colisión Paleta Derecha (Guest)
        if (ball.x + ball.radius > opponent.x && ball.y > opponent.y && ball.y < opponent.y + paddleHeight) {
            ball.speedX = -Math.abs(ball.speedX) * SPEED_INCREMENT;
            ball.speedY *= SPEED_INCREMENT;
        }

        // Goles
        if (ball.x < 0) { 
            opponent.score++; 
            resetBall(); 
        }
        if (ball.x > canvas.width) { 
            user.score++; 
            resetBall(); 
        }

        // Sincronizar con el Guest
        socket.emit('ball_sync', { 
            roomId: currentRoomId, 
            x: ball.x, 
            y: ball.y,
            scoreHost: user.score,
            scoreGuest: opponent.score
        });
        checkWinner();
    }
}

function gameLoop() {
    if (!currentRoomId) return;
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function startPingPong(roomId, isHost) {
    currentRoomId = roomId;
    role = isHost ? 'host' : 'guest';
    
    // Configurar posiciones iniciales según rol
    if (role === 'guest') { 
        user.x = 590; 
        opponent.x = 0; 
    } else { 
        user.x = 0; 
        opponent.x = 590; 
    }

    // Insertar el juego sin borrar todo el body para no perder el socket
    const container = document.getElementById('game-container');
    container.innerHTML = `
        <h2 style="color:var(--neon-pink); font-family:'Press Start 2P'; font-size:12px; margin-top:20px;">
            MODO: ${role.toUpperCase()} | PRIMERO A 5
        </h2>
    `;
    container.appendChild(canvas);
    
    gameLoop();
}
