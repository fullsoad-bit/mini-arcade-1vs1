const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('🔌 Conectado:', socket.id);

    socket.on('create_room', (data) => {
        const roomId = Math.floor(1000 + Math.random() * 9000).toString();
        rooms[roomId] = { password: data.password, game: data.game, players: [socket.id] };
        socket.join(roomId);
        socket.emit('room_created', { roomId, password: data.password });
    });

    socket.on('join_room', (data) => {
        const rId = data.roomId.toString();
        const room = rooms[rId];
        if (room && room.password === data.password) {
            socket.join(rId);
            if (!room.players.includes(socket.id)) room.players.push(socket.id);
            // Notificamos inicio a toda la sala
            io.to(rId).emit('player_joined', { roomId: rId, game: room.game });
        } else {
            socket.emit('error_msg', 'Sala no encontrada o Password incorrecto');
        }
    });

    // CANAL MAESTRO: Retransmite CUALQUIER cosa que llegue por "sync"
    socket.on('sync', (data) => {
        if (data.roomId) {
            socket.to(data.roomId.toString()).emit('sync', data);
        }
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(id => {
            if (rooms[id]) {
                rooms[id].players = rooms[id].players.filter(p => p !== socket.id);
                if (rooms[id].players.length === 0) delete rooms[id];
            }
        });
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, '0.0.0.0', () => console.log("Servidor Arcade Activo"));
