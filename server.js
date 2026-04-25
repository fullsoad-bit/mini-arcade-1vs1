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
                // Asegurar que no se duplique el ID si reconecta rápido
                if (!room.players.includes(socket.id)) {
                    room.players.push(socket.id);
                }
                
                socket.join(data.roomId);
                
                // 🔥 SOLUCIÓN: Emitir a TODOS en la sala incluyendo al que entra
                // Usamos un pequeño delay para asegurar que el join se completó
                setTimeout(() => {
                    io.to(data.roomId).emit('player_joined', { 
                        roomId: data.roomId, 
                        game: room.game 
                    });
                }, 100);
                
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
        // Usar to() asegura que se envíe a todos los demás en la sala
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
        // Iteramos sobre las salas del socket (excepto la sala personal del socket.id)
        for (const room of socket.rooms) {
            if (rooms[room]) {
                // Quitamos al jugador de la lista
                rooms[room].players = rooms[room].players.filter(id => id !== socket.id);
                
                // Solo borramos la sala si queda totalmente vacía
                if (rooms[room].players.length === 0) {
                    delete rooms[room];
                    console.log(`Sala ${room} eliminada por estar vacía.`);
                } else {
                    // Si queda alguien, avisamos que el oponente se fue
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

// Escuchar en 0.0.0.0 es clave para Render
server = http.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Arcade Online en puerto: ${PORT}`);
});
