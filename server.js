const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// Servir archivos estáticos
app.use(express.static(__dirname));

// Lógica de salas
const rooms = {};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('create_room', (data) => {
        // Generar ID de sala de 4 dígitos
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        
        rooms[roomId] = {
            password: data.password,
            game: data.game,
            players: [socket.id]
        };

        socket.join(roomId);
        socket.emit('room_created', { roomId: roomId, password: data.password });
        console.log(`Sala creada: ${roomId} para el juego: ${data.game}`);
    });

    socket.on('join_room', (data) => {
        const room = rooms[data.roomId];
        if (room && room.password === data.password) {
            if (room.players.length < 2) {
                room.players.push(socket.id);
                socket.join(data.roomId);
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

    // --- SINCRONIZACIÓN DE JUEGO ---

    socket.on('player_move', (data) => {
        socket.to(data.roomId).emit('opponent_move', data);
    });

    socket.on('spawn_obstacle', (data) => {
        socket.to(data.roomId).emit('new_obstacle', data);
    });

    socket.on('player_stunned', (data) => {
        socket.to(data.roomId).emit('opponent_stunned', data);
    });

    // --- LIMPIEZA AL DESCONECTAR ---
    socket.on('disconnecting', () => {
        // Al desconectarse, eliminamos la sala para liberar memoria en Render
        socket.rooms.forEach(roomId => {
            if (rooms[roomId]) {
                delete rooms[roomId];
                console.log(`Sala ${roomId} eliminada por desconexión.`);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

// --- CONFIGURACIÓN PARA RENDER Y CLOUD ---
// process.env.PORT es OBLIGATORIO para que Render detecte tu app
const PORT = process.env.PORT || 3000;

http.listen(PORT, '0.0.0.0', () => {
    console.log('-----------------------------------------');
    console.log(`🚀 SERVIDOR ARCADE ONLINE ACTIVO`);
    console.log(`Puerto asignado: ${PORT}`);
    console.log('-----------------------------------------');
});
