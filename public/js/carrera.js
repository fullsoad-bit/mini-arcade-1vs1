// Asegúrate de que estas líneas estén al principio o final del archivo, FUERA de cualquier función
if (typeof socket !== 'undefined') {
    // 🟢 CORRECCIÓN: Escuchar movimientos del oponente
    socket.on('opponent_move', (data) => {
        // Importante: verificar que el movimiento sea para este juego
        if (data.game === 'carrera') {
            if (data.role === 'host') carHost.x = data.x;
            else carGuest.x = data.x;
        }
    });

    // 🟢 CORRECCIÓN: Escuchar obstáculos (Vital para el Guest)
    socket.on('new_obstacle', (data) => {
        // Solo el Guest agrega obstáculos que el Host genera
        if (racingRole === 'guest') {
            obstacles.push(data.obs);
        }
    });

    socket.on('opponent_event', (data) => {
        if(data.type === 'stun') {
            let car = (data.role === 'host') ? carHost : carGuest;
            car.stun = 50;
            car.crashes = data.crashes;
            if (typeof createExplosion === 'function') createExplosion(car.x, car.y, car.color);
        }
    });
}

// 🟢 CORRECCIÓN: Función de movimiento (Keydown)
window.addEventListener("keydown", (e) => {
    if (!isRacingActive) return;
    let myCar = (racingRole === 'host') ? carHost : carGuest;
    if (myCar.stun > 0) return;
    
    let moved = false;
    if (e.key === "ArrowLeft" && myCar.x > 30) { myCar.x -= 20; moved = true; }
    if (e.key === "ArrowRight" && myCar.x < canvasRacing.width - 70) { myCar.x += 20; moved = true; }
    
    if (moved && socket) {
        // Enviamos 'game' para que el oponente sepa qué actualizar
        socket.emit('player_move', { 
            roomId: racingRoomId, 
            game: 'carrera', 
            x: myCar.x, 
            role: racingRole 
        });
    }
});
