const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// --- CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS ---

// 1. Sirve el index.html y archivos en la raíz
app.use(express.static(__dirname));

// 2. Sirve los scripts de juegos desde la carpeta public/js
// Esto corrige el error 404 y el error de MIME type (text/html)
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// Lógica de salas
const rooms = {};

io.on('connection', (socket) => {
    console.log('Usuario conectado:', socket.id);

    socket.on('create_room', (data) => {
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
                if (!room.players.includes(socket.id)) {
                    room.players.push(socket.id);
                }
                
                socket.join(data.roomId);
                
                // Delay de seguridad para asegurar que el socket está en la sala
                setTimeout(() => {
                    io.to(data.roomId).emit('player_joined', { 
                        roomId: data.roomId, 
                        game: room.game 
                    });
                }, 200);
                
                console.log(`Jugador unido a ${data.roomId}. Iniciando: ${room.game}`);
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

    // --- LIMPIEZA SEGURA AL DESCONECTAR ---
    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (rooms[room]) {
                rooms[room].players = rooms[room].players.filter(id => id !== socket.id);
                
                if (rooms[room].players.length === 0) {
                    delete rooms[room];
                    console.log(`Sala ${room} eliminada por estar vacía.`);
                } else {
                    socket.to(room).emit('error_msg', 'El oponente se ha desconectado');
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });
});

// --- CONFIGURACIÓN PARA RENDER ---
const PORT = process.env.PORT || 3000;

http.listen(PORT, '0.0.0.0', () => {
    console.log('-----------------------------------------');
    console.log(`🚀 SERVIDOR ARCADE ONLINE ACTIVO`);
    console.log(`Puerto: ${PORT}`);
    console.log('-----------------------------------------');
});

