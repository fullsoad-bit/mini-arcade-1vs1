const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---
app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    // 1. CREACIÓN DE SALA
    socket.on('create_room', (data) => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = {
            password: data.password,
            game: data.game,
            players: [socket.id]
        };
        socket.join(roomId);
        socket.emit('room_created', { roomId, password: data.password });
        console.log(`Sala ${roomId} creada para: ${data.game}`);
    });

    // 2. UNIÓN A SALA
    socket.on('join_room', (data) => {
        const room = rooms[data.roomId];
        if (room && room.password === data.password) {
            if (room.players.length < 2) {
                if (!room.players.includes(socket.id)) room.players.push(socket.id);
                socket.join(data.roomId);
                
                // Notificar inicio a ambos con un pequeño delay de seguridad
                setTimeout(() => {
                    io.to(data.roomId).emit('player_joined', { 
                        roomId: data.roomId, 
                        game: room.game 
                    });
                }, 200);
            } else {
                socket.emit('error_msg', 'La sala está llena');
            }
        } else {
            socket.emit('error_msg', 'ID o Password incorrectos');
        }
    });

    // --- 3. EVENTOS DE SINCRONIZACIÓN (Para los 4 juegos) ---

    // Movimiento general (Paletas, Autos, Mira)
    socket.on('player_move', (data) => {
        socket.to(data.roomId).emit('opponent_move', data);
    });

    // Ping Pong: Sincronización de Pelota
    socket.on('ball_sync', (data) => {
        socket.to(data.roomId).emit('ball_update', data);
    });

    // Carrera 2D: Sincronización de Obstáculos
    socket.on('spawn_obstacle', (data) => {
        socket.to(data.roomId).emit('new_obstacle', data);
    });

    // Tetrix: Sincronización de piezas y tablero
    socket.on('tetrix_sync', (data) => {
        socket.to(data.roomId).emit('tetrix_update', data);
    });

    // Tiro al Blanco: Sincronización de objetivos y disparos
    socket.on('target_sync', (data) => {
        socket.to(data.roomId).emit('target_update', data);
    });

    // Eventos de estado (Aturdimiento, Choque, etc.)
    socket.on('game_event', (data) => {
        socket.to(data.roomId).emit('opponent_event', data);
    });


    // --- 4. LIMPIEZA AL DESCONECTAR ---
    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (rooms[room]) {
                rooms[room].players = rooms[room].players.filter(id => id !== socket.id);
                if (rooms[room].players.length === 0) {
                    delete rooms[room];
                    console.log(`Sala ${room} eliminada.`);
                } else {
                    socket.to(room).emit('error_msg', 'El rival abandonó la partida.');
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

// --- LAN & RENDER CONFIG ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Arcade Activo en Puerto: ${PORT}`);
});
