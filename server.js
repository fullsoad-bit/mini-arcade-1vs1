const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('🔌 Nuevo dispositivo conectado:', socket.id);

    socket.on('create_room', (data) => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = { password: data.password, game: data.game, players: [socket.id] };
        socket.join(roomId);
        socket.emit('room_created', { roomId, password: data.password });
        console.log(`🏠 Sala ${roomId} creada`);
    });

    socket.on('join_room', (data) => {
        const room = rooms[data.roomId];
        if (room && room.password === data.password) {
            // Unirse a la sala física de Socket.io
            socket.join(data.roomId);
            if (!room.players.includes(socket.id)) room.players.push(socket.id);
            
            // Emitir a TODOS en la sala para sincronizar el inicio
            io.to(data.roomId).emit('player_joined', { 
                roomId: data.roomId, 
                game: room.game 
            });
            console.log(`🎮 Jugador ${socket.id} entró a sala ${data.roomId}`);
        } else {
            socket.emit('error_msg', 'ID o Password incorrectos');
        }
    });

    // CANAL DE DATOS ULTRA-RÁPIDO (Obstáculos y Choques)
    socket.on('broadcast', (data) => {
        if (data.roomId) {
            // Enviamos a los DEMÁS en la sala
            socket.to(data.roomId).emit('broadcast', data);
        }
    });

    // CANAL DE MOVIMIENTO
    socket.on('player_move', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('opponent_move', data);
        }
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomId => {
            if (rooms[roomId]) {
                rooms[roomId].players = rooms[roomId].players.filter(id => id !== socket.id);
                if (rooms[roomId].players.length === 0) delete rooms[roomId];
                else io.to(roomId).emit('error_msg', 'El rival se ha desconectado.');
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR ARCADE ONLINE EN PUERTO ${PORT}`);
});
