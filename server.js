const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
app.use(express.static(__dirname));
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
                // Unirse a la sala de Socket.io inmediatamente
                socket.join(data.roomId);
                
                if (!room.players.includes(socket.id)) room.players.push(socket.id);
                
                console.log(`🎮 Jugador unido a sala ${data.roomId}`);

                // Notificar a AMBOS jugadores que la partida comienza
                // Usamos io.to().emit para asegurar que todos reciban la señal de inicio
                io.to(data.roomId).emit('player_joined', { 
                    roomId: data.roomId, 
                    game: room.game 
                });
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
        if (data.roomId) {
            socket.to(data.roomId).emit('opponent_move', data);
        }
    });

    // 2. Carrera 2D y Eventos Generales (Sincronización de Obstáculos, Choques, Stun)
    // Este bloque es vital para el archivo carrera.js que te pasé
    socket.on('game_event', (data) => {
        if (data.roomId) {
            // Reenvía absolutamente todo (sync_obstacles, stun, etc.) al oponente
            socket.to(data.roomId).emit('opponent_event', data);
        }
    });

    // 3. Otros eventos específicos (Mantenidos por compatibilidad con tus otros juegos)
    socket.on('ball_sync', (data) => {
        if (data.roomId) socket.to(data.roomId).emit('ball_update', data);
    });

    socket.on('spawn_obstacle', (data) => {
        if (data.roomId) socket.to(data.roomId).emit('new_obstacle', data);
    });

    socket.on('tetrix_sync', (data) => {
        if (data.roomId) socket.to(data.roomId).emit('tetrix_update', data);
    });

    socket.on('target_sync', (data) => {
        if (data.roomId) socket.to(data.roomId).emit('target_update', data);
    });

    // --- LIMPIEZA ---

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomId => {
            if (rooms[roomId]) {
                rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
                if (rooms[roomId].players.length === 0) {
                    delete rooms[roomId];
                    console.log(`🗑️ Sala ${roomId} eliminada.`);
                } else {
                    io.to(roomId).emit('error_msg', 'El oponente se ha desconectado.');
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
