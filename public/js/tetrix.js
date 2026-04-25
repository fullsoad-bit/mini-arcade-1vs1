// js/tetrix.js

const canvasT = document.createElement('canvas');
const ctxT = canvasT.getContext('2d');
canvasT.width = 300;
canvasT.height = 600;
canvasT.style.border = "4px solid #FF00FF"; // Rosa neón
canvasT.style.display = "block";
canvasT.style.margin = "10px auto";

const ROW = 20;
const COL = 10;
const SQ = 30; 
const VACANTE = "#0d0208"; 

let tetrixRoomId = null;
let tetrixRole = "spectator";
let isTetrixActive = false;

let myScore = 0;
let opponentScore = 0;
let tetrixTimeLeft = 180; // 3 minutos
let tetrixGameInterval;
let tetrixTimerInterval;

// Tablero local
let board = [];
for (let r = 0; r < ROW; r++) {
    board[r] = Array(COL).fill(VACANTE);
}

function drawBoard() {
    for (let r = 0; r < ROW; r++) {
        for (let c = 0; c < COL; c++) {
            drawSquare(c, r, board[r][c]);
        }
    }
}

function drawSquare(x, y, color) {
    ctxT.fillStyle = color;
    ctxT.fillRect(x * SQ, y * SQ, SQ, SQ);
    ctxT.strokeStyle = "#111";
    ctxT.strokeRect(x * SQ, y * SQ, SQ, SQ);
}

const PIECES = [
    [ [[1,1,1,1]], "#00f0f0" ],
    [ [[1,1,1],[0,1,0]], "#a000f0" ],
    [ [[1,1,0],[0,1,1]], "#f00000" ],
    [ [[0,1,1],[1,1,0]], "#00f000" ],
    [ [[1,1],[1,1]], "#f0f000" ],
    [ [[1,1,1],[1,0,0]], "#f0a000" ],
    [ [[1,1,1],[0,0,1]], "#0000f0" ]
];

function randomPiece() {
    let r = Math.floor(Math.random() * PIECES.length);
    return { shape: PIECES[r][0], color: PIECES[r][1], x: 3, y: -2 };
}

let piece = randomPiece();

function moveDown() {
    if (!collision(0, 1, piece.shape)) {
        piece.y++;
    } else {
        lockPiece();
        piece = randomPiece();
    }
    renderTetrix();
}

function collision(dx, dy, shape) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            let newX = piece.x + c + dx;
            let newY = piece.y + r + dy;
            if (newX < 0 || newX >= COL || newY >= ROW) return true;
            if (newY < 0) continue;
            if (board[newY][newX] !== VACANTE) return true;
        }
    }
    return false;
}

function lockPiece() {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (!piece.shape[r][c]) continue;
            if (piece.y + r < 0) {
                // Si se llena el tablero, penalización de puntos pero sigue jugando
                myScore = Math.max(0, myScore - 500);
                resetBoard();
                syncScore();
                return;
            }
            board[piece.y + r][piece.x + c] = piece.color;
        }
    }
    checkLines();
}

function checkLines() {
    let linesCleared = 0;
    for (let r = 0; r < ROW; r++) {
        if (board[r].every(cell => cell !== VACANTE)) {
            board.splice(r, 1);
            board.unshift(Array(COL).fill(VACANTE));
            linesCleared++;
        }
    }
    if (linesCleared > 0) {
        myScore += linesCleared * 100 * linesCleared;
        syncScore();
    }
}

function resetBoard() {
    for (let r = 0; r < ROW; r++) board[r].fill(VACANTE);
}

function syncScore() {
    if (tetrixRoomId && typeof socket !== 'undefined') {
        socket.emit('player_move', { 
            roomId: tetrixRoomId, 
            score: myScore, 
            role: tetrixRole 
        });
    }
}

function renderTetrix() {
    if (!isTetrixActive) return;
    drawBoard();
    
    // Dibujar pieza actual
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) drawSquare(piece.x + c, piece.y + r, piece.color);
        }
    }

    // HUD Neón
    ctxT.fillStyle = "rgba(0,0,0,0.7)";
    ctxT.fillRect(0, 0, 300, 80);
    
    ctxT.font = "10px 'Press Start 2P'";
    ctxT.fillStyle = "#FFF";
    ctxT.fillText(`TIEMPO: ${tetrixTimeLeft}s`, 15, 25);
    
    ctxT.fillStyle = "#39FF14"; // Verde (Tú)
    ctxT.fillText(`TU: ${myScore}`, 15, 50);
    
    ctxT.fillStyle = "#FF00FF"; // Rosa (Rival)
    ctxT.fillText(`RIVAL: ${opponentScore}`, 15, 70);
}

// Eventos de Red
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        // En Tetris solo nos interesa sincronizar el puntaje del otro
        opponentScore = data.score;
    });
}

// Controles
window.addEventListener("keydown", (e) => {
    if (!isTetrixActive) return;
    if (e.keyCode == 37 && !collision(-1, 0, piece.shape)) piece.x--;
    if (e.keyCode == 39 && !collision(1, 0, piece.shape)) piece.x++;
    if (e.keyCode == 40) moveDown();
    if (e.keyCode == 38) {
        let next = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
        if (!collision(0, 0, next)) piece.shape = next;
    }
    renderTetrix();
});

function endTetrix() {
    isTetrixActive = false;
    clearInterval(tetrixGameInterval);
    clearInterval(tetrixTimerInterval);
    
    let result = "";
    if (myScore > opponentScore) result = "¡VICTORIA MAGISTRAL!";
    else if (myScore < opponentScore) result = "DERROTA... MÁS PRÁCTICA";
    else result = "¡EMPATE DE LEYENDAS!";

    alert(`FIN DEL TIEMPO\nTu puntaje: ${myScore}\nRival: ${opponentScore}\n\n${result}`);
    location.reload();
}

function startTetrix(roomId, isHost) {
    tetrixRoomId = roomId;
    tetrixRole = isHost ? 'host' : 'guest';
    isTetrixActive = true;

    // Inyectar en index.html
    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(canvasT);

    tetrixGameInterval = setInterval(moveDown, 500);
    tetrixTimerInterval = setInterval(() => {
        if (tetrixTimeLeft > 0) tetrixTimeLeft--;
        else endTetrix();
        renderTetrix();
    }, 1000);
}
