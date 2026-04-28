const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
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
        const room = rooms[data.roomId];
        if (room && room.password === data.password) {
            socket.join(data.roomId);
            if (!room.players.includes(socket.id)) room.players.push(socket.id);
            
            // Emitir a TODA la sala para que el Jugador 1 y el Jugador 2 inicien al mismo tiempo
            io.to(data.roomId).emit('player_joined', { 
                roomId: data.roomId, 
                game: room.game 
            });
        } else {
            socket.emit('error_msg', 'ID o Password incorrectos');
        }
    });

    // RETRANSMISOR UNIVERSAL
    socket.on('broadcast', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('broadcast', data);
        }
    });

    socket.on('player_move', (data) => {
        if (data.roomId) {
            socket.to(data.roomId).emit('opponent_move', data);
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SERVIDOR ARCADE ONLINE EN PUERTO ${PORT}`);
});
