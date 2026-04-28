const canvasT = document.createElement('canvas');
const ctxT = canvasT.getContext('2d');

const ROW = 20;
const COL = 10;
const SQ = 25; 
canvasT.width = COL * SQ;
canvasT.height = ROW * SQ;

canvasT.style.cssText = "background:#0d0208; border:4px solid #FF00FF; display:block; margin:5px auto; max-width:85vw; height:auto; touch-action:none;";

const VACANTE = "#0d0208"; 

let tetrixRoomId = null;
let tetrixRole = "spectator";
let isTetrixActive = false;

let myScore = 0;
let opponentScore = 0;
let tetrixTimeLeft = 180;
let tetrixGameInterval, tetrixTimerInterval;

// --- PIEZAS REALES RE-ESTABLECIDAS ---
const PIECES = [
    [ [[1,1,1,1]], "#00f0f0" ], // I
    [ [[1,1,1],[0,1,0]], "#a000f0" ], // T
    [ [[1,1,0],[0,1,1]], "#f00000" ], // Z
    [ [[0,1,1],[1,1,0]], "#00f000" ], // S
    [ [[1,1],[1,1]], "#f0f000" ], // O
    [ [[1,1,1],[1,0,0]], "#f0a000" ], // L
    [ [[1,1,1],[0,0,1]], "#0000f0" ]  // J
];

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

function rotatePiece() {
    let next = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
    if (!collision(0, 0, next)) piece.shape = next;
}

function lockPiece() {
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (!piece.shape[r][c]) continue;
            if (piece.y + r < 0) {
                myScore = Math.max(0, myScore - 100);
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
    if (tetrixRoomId && socket) {
        socket.emit('sync', { 
            roomId: tetrixRoomId, 
            type: 'tetrix_score',
            score: myScore,
            timeLeft: tetrixTimeLeft 
        });
    }
}

function renderTetrix() {
    if (!isTetrixActive) return;
    ctxT.fillStyle = VACANTE;
    ctxT.fillRect(0, 0, canvasT.width, canvasT.height);
    drawBoard();
    
    for (let r = 0; r < piece.shape.length; r++) {
        for (let c = 0; c < piece.shape[r].length; c++) {
            if (piece.shape[r][c]) drawSquare(piece.x + c, piece.y + r, piece.color);
        }
    }

    // HUD
    ctxT.fillStyle = "rgba(0,0,0,0.8)";
    ctxT.fillRect(0, 0, canvasT.width, 40);
    ctxT.fillStyle = "white";
    ctxT.font = "bold 10px Arial";
    ctxT.fillText(`⏱️${tetrixTimeLeft}s | YO:${myScore} | RIVAL:${opponentScore}`, 5, 25);
    
    requestAnimationFrame(renderTetrix);
}

// Escuchar Red
if (typeof socket !== 'undefined') {
    socket.on('sync', (data) => {
        if (data.type === 'tetrix_score') {
            opponentScore = data.score;
            if (tetrixRole === 'guest') tetrixTimeLeft = data.timeLeft;
        }
    });
}

function startTetrix(roomId, isHost) {
    tetrixRoomId = roomId.toString();
    tetrixRole = isHost ? 'host' : 'guest';
    isTetrixActive = true;
    initBoard();
    myScore = 0; opponentScore = 0; tetrixTimeLeft = 180;

    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(canvasT);

    // Forzamos la creación de controles para asegurar visibilidad
    setupMobileTetrixControls(container);

    if (tetrixGameInterval) clearInterval(tetrixGameInterval);
    tetrixGameInterval = setInterval(moveDown, 800);
    
    if (isHost) {
        if (tetrixTimerInterval) clearInterval(tetrixTimerInterval);
        tetrixTimerInterval = setInterval(() => {
            if (tetrixTimeLeft > 0) {
                tetrixTimeLeft--;
                syncTetrix();
            } else endTetrix();
        }, 1000);
    }
    renderTetrix();
}

function setupMobileTetrixControls(cont) {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = "display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; width:95%; margin:15px auto; padding-bottom: 20px;";
    
    const btnStyle = "height:70px; background:#222; border:2px solid #FF00FF; color:white; font-size:25px; border-radius:12px; touch-action:none; display:flex; align-items:center; justify-content:center; user-select:none;";
    
    const btnL = document.createElement('div'); btnL.innerHTML = "◀️"; btnL.style.cssText = btnStyle;
    const btnR = document.createElement('div'); btnR.innerHTML = "▶️"; btnR.style.cssText = btnStyle;
    const btnU = document.createElement('div'); btnU.innerHTML = "🔄"; btnU.style.cssText = btnStyle;
    const btnD = document.createElement('div'); btnD.innerHTML = "🔽"; btnD.style.cssText = btnStyle;

    // Eventos Touch
    btnL.ontouchstart = (e) => { e.preventDefault(); if (!collision(-1, 0, piece.shape)) piece.x--; };
    btnR.ontouchstart = (e) => { e.preventDefault(); if (!collision(1, 0, piece.shape)) piece.x++; };
    btnU.ontouchstart = (e) => { e.preventDefault(); rotatePiece(); };
    btnD.ontouchstart = (e) => { e.preventDefault(); moveDown(); };

    // Layout
    controlsDiv.appendChild(document.createElement('div')); 
    controlsDiv.appendChild(btnU); 
    controlsDiv.appendChild(document.createElement('div'));
    
    controlsDiv.appendChild(btnL); 
    controlsDiv.appendChild(btnD); 
    controlsDiv.appendChild(btnR);
    
    cont.appendChild(controlsDiv);
}

function endTetrix() {
    isTetrixActive = false;
    clearInterval(tetrixGameInterval);
    clearInterval(tetrixTimerInterval);
    alert(`TIEMPO TERMINADO\nTu puntuación: ${myScore}\nRival: ${opponentScore}`);
    window.location.reload();
}

window.addEventListener("keydown", (e) => {
    if (!isTetrixActive) return;
    if (e.keyCode == 37 && !collision(-1, 0, piece.shape)) piece.x--;
    if (e.keyCode == 39 && !collision(1, 0, piece.shape)) piece.x++;
    if (e.keyCode == 40) moveDown();
    if (e.keyCode == 38) rotatePiece();
});
