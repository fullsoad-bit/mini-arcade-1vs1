// js/ajedrez.js

let board = null;
let game = new Chess();
let ajedrezRoomId = null;
let ajedrezRole = "spectator"; // 'host' (Blancas) o 'guest' (Negras)

function onDragStart(source, piece, position, orientation) {
    // No permitir mover piezas si el juego terminó
    if (game.game_over()) return false;

    // Solo permitir mover las piezas del color que corresponde al rol
    if ((ajedrezRole === 'host' && piece.search(/^b/) !== -1) ||
        (ajedrezRole === 'guest' && piece.search(/^w/) !== -1)) {
        return false;
    }
}

function onDrop(source, target) {
    // Ver si el movimiento es legal
    let move = game.move({
        from: source,
        to: target,
        promotion: 'q' // Siempre promocionar a dama para simplificar
    });

    // Si es ilegal, devolver pieza
    if (move === null) return 'snapback';

    // Sincronizar movimiento con el oponente
    socket.emit('player_move', {
        roomId: ajedrezRoomId,
        move: move,
        boardStatus: game.fen()
    });

    updateStatus();
}

function updateStatus() {
    if (game.in_checkmate()) {
        alert("¡JAQUE MATE! Juego terminado.");
        location.reload();
    } else if (game.in_draw()) {
        alert("¡EMPATE!");
        location.reload();
    }
}

// Recibir movimiento del oponente
if (typeof socket !== 'undefined') {
    socket.on('opponent_move', (data) => {
        game.move(data.move);
        board.position(game.fen());
        updateStatus();
    });
}

function startAjedrez(roomId, isHost) {
    ajedrezRoomId = roomId;
    ajedrezRole = isHost ? 'host' : 'guest';

    const container = document.getElementById('game-container');
    container.innerHTML = `
        <div style="margin: 20px auto; width: 400px;">
            <h2 style="color:var(--neon-pink); font-size:12px;">${isHost ? 'ERES BLANCAS' : 'ERES NEGRAS'}</h2>
            <div id="chess-board" style="width: 400px; border: 5px solid var(--neon-green);"></div>
            <p id="turn-status" style="margin-top:20px; font-size:10px;">TURNO: BLANCAS</p>
        </div>
    `;

    let config = {
        draggable: true,
        position: 'start',
        orientation: isHost ? 'white' : 'black',
        onDragStart: onDragStart,
        onDrop: onDrop,
        pieceTheme: 'https://chessboardjs.com{piece}.png'
    };

    board = Chessboard('chess-board', config);
}
