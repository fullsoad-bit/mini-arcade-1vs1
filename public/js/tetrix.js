const canvasT = document.createElement('canvas');
const ctxT = canvasT.getContext('2d');

const ROW = 20;
const COL = 10;
const SQ = 25; // Tamaño reducido para que quepa en celulares
canvasT.width = COL * SQ;
canvasT.height = ROW * SQ;

canvasT.style.cssText = "background:#0d0208; border:4px solid #FF00FF; display:block; margin:5px auto; max-width:90vw; height:auto; touch-action:none; box-shadow: 0 0 15px #FF00FF55;";

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

function rotatePiece() {
    let next = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
    if (!collision(0, 0, next)) piece.shape = next;
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
        socket.emit('sync', { 
            roomId: tetrixRoomId, 
            type: 'tetrix_score',
            score: myScore,
            timeLeft: tetrixTimeLeft // El Host manda el tiempo oficial
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
    // HUD Flotante
    ctxT.fillStyle = "rgba(0,0,0,0.7)";
    ctxT.fillRect(0, 0, canvasT.width, 40);
    ctxT.fillStyle = "white";
    ctxT.font = "10px Monospace";
    ctxT.fillText(`⏱️${tetrixTimeLeft}s | YO:${myScore} | RIVAL:${opponentScore}`, 5, 25);
    requestAnimationFrame(renderTetrix);
}

// Escuchar actualizaciones del oponente
socket.on('sync', (data) => {
    if (data.type === 'tetrix_score') {
        opponentScore = data.score;
        if (tetrixRole === 'guest') tetrixTimeLeft = data.timeLeft;
    }
});

function endTetrix() {
    isTetrixActive = false;
    clearInterval(tetrixGameInterval);
    clearInterval(tetrixTimerInterval);
    alert(`FIN! Score: ${myScore} | Rival: ${opponentScore}`);
    window.location.reload();
}

function startTetrix(roomId, isHost) {
    tetrixRoomId = roomId.toString();
    tetrixRole = isHost ? 'host' : 'guest';
    isTetrixActive = true;
    initBoard();
    myScore = 0;
    opponentScore = 0;
    tetrixTimeLeft = 180;

    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(canvasT);

    setupMobileTetrixControls(container);

    tetrixGameInterval = setInterval(moveDown, 700);
    
    if (isHost) {
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
    if (!/Android|iPhone/i.test(navigator.userAgent)) return;
    
    const d = document.createElement('div');
    d.style.cssText = "display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; width:90%; margin:10px auto;";
    
    const bS = "height:60px; background:#222; border:2px solid #FF00FF; color:white; font-size:20px; border-radius:10px;";
    
    const btnL = document.createElement('button'); btnL.innerHTML = "◀️"; btnL.style.cssText = bS;
    const btnR = document.createElement('button'); btnR.innerHTML = "▶️"; btnR.style.cssText = bS;
    const btnU = document.createElement('button'); btnU.innerHTML = "🔄"; btnU.style.cssText = bS;
    const btnD = document.createElement('button'); btnD.innerHTML = "🔽"; btnD.style.cssText = bS;

    btnL.ontouchstart = (e) => { e.preventDefault(); if (!collision(-1, 0, piece.shape)) piece.x--; };
    btnR.ontouchstart = (e) => { e.preventDefault(); if (!collision(1, 0, piece.shape)) piece.x++; };
    btnU.ontouchstart = (e) => { e.preventDefault(); rotatePiece(); };
    btnD.ontouchstart = (e) => { e.preventDefault(); moveDown(); };

    // Layout del D-PAD
    d.appendChild(document.createElement('div')); d.appendChild(btnU); d.appendChild(document.createElement('div'));
    d.appendChild(btnL); d.appendChild(btnD); d.appendChild(btnR);
    
    cont.appendChild(d);
}

window.addEventListener("keydown", (e) => {
    if (!isTetrixActive) return;
    if (e.keyCode == 37 && !collision(-1, 0, piece.shape)) piece.x--;
    if (e.keyCode == 39 && !collision(1, 0, piece.shape)) piece.x++;
    if (e.keyCode == 40) moveDown();
    if (e.keyCode == 38) rotatePiece();
});
