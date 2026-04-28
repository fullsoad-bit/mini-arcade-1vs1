const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');

app.use(express.static(__dirname));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

const rooms = {};

io.on('connection', (socket) => {
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
            // UNIÓN FORZADA: Esperamos a que la unión sea efectiva
            socket.join(rId); 
            if (!room.players.includes(socket.id)) room.players.push(socket.id);
            
            // Usamos io.in(rId) para asegurar que el mensaje llegue a TODOS en esa sala física
            io.in(rId).emit('player_joined', { roomId: rId, game: room.game });
        } else {
            socket.emit('error_msg', 'Sala no encontrada o Password mal');
        }
    });

    // CANAL ÚNICO SINCRONIZADO
    socket.on('sync', (data) => {
        if (data.roomId) {
            // socket.to envía a todos los DEMÁS en la sala rId
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
http.listen(PORT, '0.0.0.0', () => console.log("Servidor OK"));
