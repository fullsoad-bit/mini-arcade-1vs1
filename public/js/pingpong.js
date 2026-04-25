const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 600; 
canvas.height = 400;
canvas.style.border = "4px solid #39FF14";
canvas.style.display = "block"; 
canvas.style.margin = "20px auto";

let currentRoomId = null;
let role = "spectator"; 

const paddleWidth = 10, paddleHeight = 80;
let user = { x: 0, y: 160, score: 0 };
let opponent = { x: 590, y: 160, score: 0 };

// Configuraciones de velocidad y límites
const INITIAL_SPEED = 5;
const SPEED_INCREMENT = 1.05; // 5% de aumento
let ball = { x: 300, y: 200, speedX: INITIAL_SPEED, speedY: INITIAL_SPEED, radius: 7 };

function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Línea central
    ctx.strokeStyle = "#333";
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();

    // Paletas
    ctx.fillStyle = "#39FF14"; ctx.fillRect(user.x, user.y, paddleWidth, paddleHeight);
    ctx.fillStyle = "#FF00FF"; ctx.fillRect(opponent.x, opponent.y, paddleWidth, paddleHeight);

    // Pelota
    ctx.fillStyle = "#FFF";
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();

    // Marcador Retro
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillStyle = "#FFF";
    // El puntaje se dibuja relativo al rol
    if (role === 'host') {
        ctx.fillText(user.score, 150, 50);
        ctx.fillText(opponent.score, 450, 50);
    } else {
        ctx.fillText(opponent.score, 150, 50);
        ctx.fillText(user.score, 450, 50);
    }
}

canvas.addEventListener("mousemove", (evt) => {
    let rect = canvas.getBoundingClientRect();
    user.y = evt.clientY - rect.top - paddleHeight / 2;
    if (currentRoomId) {
        socket.emit('player_move', { roomId: currentRoomId, y: user.y });
    }
});

socket.on('opponent_move', (data) => { opponent.y = data.y; });

socket.on('ball_update', (data) => {
    if (role === 'guest') {
        ball.x = data.x;
        ball.y = data.y;
        user.score = data.scoreGuest;
        opponent.score = data.scoreHost;
        checkWinner();
    }
});

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    // Invertir dirección y resetear a velocidad inicial
    ball.speedX = (ball.speedX > 0 ? -INITIAL_SPEED : INITIAL_SPEED);
    ball.speedY = INITIAL_SPEED;
}

function checkWinner() {
    if (user.score >= 5 || opponent.score >= 5) {
        let winner = user.score >= 5 ? "¡GANASTE!" : "EL RIVAL GANA";
        alert(winner);
        location.reload(); // Reinicia al menú
    }
}

function update() {
    if (role === 'host') { 
        ball.x += ball.speedX;
        ball.y += ball.speedY;

        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) ball.speedY = -ball.speedY;

        // Colisión Paleta Izquierda (Host)
        if (ball.x - ball.radius < user.x + paddleWidth && ball.y > user.y && ball.y < user.y + paddleHeight) {
            ball.speedX = Math.abs(ball.speedX) * SPEED_INCREMENT; // Aumenta 5%
            ball.speedY *= SPEED_INCREMENT;
        }

        // Colisión Paleta Derecha (Guest)
        if (ball.x + ball.radius > opponent.x && ball.y > opponent.y && ball.y < opponent.y + paddleHeight) {
            ball.speedX = -Math.abs(ball.speedX) * SPEED_INCREMENT; // Aumenta 5%
            ball.speedY *= SPEED_INCREMENT;
        }

        // Puntajes
        if (ball.x < 0) { 
            opponent.score++; 
            resetBall(); 
            checkWinner();
        }
        if (ball.x > canvas.width) { 
            user.score++; 
            resetBall(); 
            checkWinner();
        }

        socket.emit('ball_sync', { 
            roomId: currentRoomId, 
            x: ball.x, 
            y: ball.y,
            scoreHost: user.score,
            scoreGuest: opponent.score
        });
    }
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

function startPingPong(roomId, isHost) {
    currentRoomId = roomId;
    role = isHost ? 'host' : 'guest';
    if (role === 'guest') { user.x = 590; opponent.x = 0; } 
    else { user.x = 0; opponent.x = 590; }

    document.body.innerHTML = `<h2 style="color:var(--neon-pink); text-align:center; font-size:10px;">PRIMERO A 5 PUNTOS GANA</h2>`;
    document.body.appendChild(canvas);
    gameLoop();
}
