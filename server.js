const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
// Sirve el index.html desde la raíz
app.use(express.static(__dirname));
// Sirve los juegos desde la carpeta public/js
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Almacén de salas en memoria
const rooms = {};

io.on('connection', (socket) => {
    console.log('🔌 Usuario conectado:', socket.id);

    // --- GESTIÓN DE SALAS ---

    socket.on('create_room', (data) => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = {
            password: data.password,
            game: data.game,
            players: [socket.id]
        };
        socket.join(roomId);
        socket.emit('room_created', { roomId, password: data.password });
        console.log(`🏠 Sala ${roomId} creada para: ${data.game}`);
    });

    socket.on('join_room', (data) => {
        const room = rooms[data.roomId];
        if (room && room.password === data.password) {
            if (room.players.length < 2) {
                if (!room.players.includes(socket.id)) room.players.push(socket.id);
                socket.join(data.roomId);
                
                // Delay para asegurar que el socket esté unido a la sala de Socket.io
                setTimeout(() => {
                    io.to(data.roomId).emit('player_joined', { 
                        roomId: data.roomId, 
                        game: room.game 
                    });
                }, 200);
                console.log(`🎮 Jugador unido a sala ${data.roomId}`);
            } else {
                socket.emit('error_msg', 'La sala está llena');
            }
        } else {
            socket.emit('error_msg', 'ID o Password incorrectos');
        }
    });

    // --- EVENTOS DE SINCRONIZACIÓN MULTIJUEGO ---

    // 1. Movimiento (Paddles, Autos, Mira, Tetris)
    socket.on('player_move', (data) => {
        // Reenvía a todos en la sala excepto al emisor
        socket.to(data.roomId).emit('opponent_move', data);
    });

    // 2. Ping Pong: Sincronización de la pelota (Host -> Guest)
    socket.on('ball_sync', (data) => {
        socket.to(data.roomId).emit('ball_update', data);
    });

    // 3. Carrera 2D: Obstáculos generados por el Host
    socket.on('spawn_obstacle', (data) => {
        socket.to(data.roomId).emit('new_obstacle', data);
    });

    // 4. Tetris y Tiro: Puntajes y Viento
    socket.on('tetrix_sync', (data) => {
        socket.to(data.roomId).emit('tetrix_update', data);
    });

    socket.on('target_sync', (data) => {
        socket.to(data.roomId).emit('target_update', data);
    });

    // 5. Eventos especiales (Choques, Stun, Explosiones)
    socket.on('game_event', (data) => {
        socket.to(data.roomId).emit('opponent_event', data);
    });

    // --- LIMPIEZA ---

    socket.on('disconnecting', () => {
        // Al desconectarse, avisar a las salas y limpiar
        socket.rooms.forEach(roomId => {
            if (rooms[roomId]) {
                rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
                if (rooms[roomId].players.length === 0) {
                    delete rooms[roomId];
                    console.log(`🗑️ Sala ${roomId} eliminada.`);
                } else {
                    socket.to(roomId).emit('error_msg', 'El oponente se ha desconectado.');
                }
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('❌ Usuario desconectado');
    });
});

// --- INICIO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log('-----------------------------------------');
    console.log(`🚀 ARCADE SERVER RUNNING ON PORT: ${PORT}`);
    console.log('-----------------------------------------');
});
