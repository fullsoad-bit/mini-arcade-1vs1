const canvasT = document.createElement('canvas');
const ctxT = canvasT.getContext('2d');
canvasT.width = 300;
canvasT.height = 600;
canvasT.style.border = "4px solid #FF00FF";
canvasT.style.display = "block";
canvasT.style.margin = "10px auto";
canvasT.style.boxShadow = "0 0 20px rgba(255, 0, 255, 0.5)";

const ROW = 20;
const COL = 10;
const SQ = 30; 
const VACANTE = "#0d0208"; 

let tetrixRoomId = null;
let tetrixRole = "spectator";
let isTetrixActive = false;

let myScore = 0;
let opponentScore = 0;
let tetrixTimeLeft = 180;
let tetrixGameInterval, tetrixTimerInterval;

let board = [];
function initBoard() {
    board = [];
    for (let r = 0; r < ROW; r++) {
        board[r] = Array(COL).fill(VACANTE);
    }
}

function drawSquare(x, y, color) {
    ctxT.fillStyle = color;
    ctxT.fillRect(x * SQ, y * SQ, SQ, SQ);
    ctxT.strokeStyle = "rgba(255,255,255,0.1)";
    ctxT.strokeRect(x * SQ, y * SQ, SQ, SQ);
}

function drawBoard() {
    for (let r = 0; r < ROW; r++) {
        for (let c = 0; c < COL; c++) {
            drawSquare(c, r, board[r][c]);
        }
    }
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
    if (!isTetrixActive) return;
    if (!collision(0, 1, piece.shape)) {
        piece.y++;
    } else {
        lockPiece();
        piece = randomPiece();
    }
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
                myScore = Math.max(0, myScore - 200);
                initBoard();
                syncTetrix();
                return;
            }
            board[piece.y + r][piece.x + c] = piece.color;
        }
    }
    checkLines();
}

function checkLines() {
    let lines = 0;
    for (let r = 0; r < ROW; r++) {
        if (board[r].every(cell => cell !== VACANTE)) {
            board.splice(r, 1);
            board.unshift(Array(COL).fill(VACANTE));
            lines++;
        }
    }
    if (lines > 0) {
        myScore += [0, 100, 300, 500, 800][lines] || 1000;
        syncTetrix();
    }
}

function syncTetrix() {
    if (tetrixRoomId && typeof socket !== 'undefined') {
        socket.emit('tetrix_sync', { 
            roomId: tetrixRoomId, 
            score: myScore, 
            role: tetrixRole 
        });
    }
}

function renderTetrix() {
    if (!isTetrixActive) return;
    
    // Limpiar fondo
    ctxT.fillStyle = VACANTE;
    ctxT.fillRect(0, 0, canvasT.width, canvasT.height);
    
    drawBoard();
    
    // Dibujar pieza activa
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) drawSquare(piece.x + c, piece.y + r, piece.color);
        }
    }

    // HUD
    ctxT.fillStyle = "rgba(0,0,0,0.85)";
    ctxT.fillRect(0, 0, canvasT.width, 90);
    
    ctxT.font = "10px 'Press Start 2P'";
    ctxT.fillStyle = "#00F3FF";
    ctxT.fillText(`TIME: ${tetrixTimeLeft}s`, 20, 30);
    
    ctxT.fillStyle = "#39FF14";
    ctxT.fillText(`YOU: ${myScore}`, 20, 55);
    
    ctxT.fillStyle = "#FF00FF";
    ctxT.fillText(`RIVAL: ${opponentScore}`, 20, 75);

    requestAnimationFrame(renderTetrix);
}

// Red
if (typeof socket !== 'undefined') {
    socket.on('tetrix_update', (data) => {
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
});

function endTetrix() {
    isTetrixActive = false;
    clearInterval(tetrixGameInterval);
    clearInterval(tetrixTimerInterval);
    
    let result = myScore > opponentScore ? "¡VICTORIA!" : (myScore < opponentScore ? "DERROTA" : "EMPATE");
    alert(`FIN DEL TIEMPO\n${result}\nTu Score: ${myScore}\nRival: ${opponentScore}`);
    window.location.reload();
}

function startTetrix(roomId, isHost) {
    tetrixRoomId = roomId;
    tetrixRole = isHost ? 'host' : 'guest';
    isTetrixActive = true;
    initBoard();
    myScore = 0;
    opponentScore = 0;
    tetrixTimeLeft = 180;

    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(canvasT);

    tetrixGameInterval = setInterval(moveDown, 600);
    tetrixTimerInterval = setInterval(() => {
        if (tetrixTimeLeft > 0) tetrixTimeLeft--;
        else endTetrix();
    }, 1000);

    renderTetrix();
}
