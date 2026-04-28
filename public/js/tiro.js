// --- COMUNICACIÓN MEJORADA ---
socket.off('sync');
socket.on('sync', (data) => {
    if (!isTiroActive || data.type !== 'tiro_sync') return;

    // Actualizamos el estado del rival SIEMPRE
    oppTiroScore = data.score;
    oppArrow.angle = data.angle;
    oppArrow.hasShot = data.hasShot;
    
    // CORRECCIÓN CRÍTICA: Sincronizar posición de vuelo del rival
    oppArrow.isFlying = data.isFlying;
    if (data.isFlying) {
        oppArrow.x = data.arrowX;
        oppArrow.y = data.arrowY;
    } else if (!data.hasShot) {
        // Si no está volando y no ha disparado, reseteamos posición visual
        oppArrow.x = 40;
        oppArrow.y = 200;
    }
    
    if (tiroRole === 'guest') wind = data.wind;

    // Lógica de avance de ronda
    if (myArrow.hasShot && oppArrow.hasShot && !myArrow.isFlying && !oppArrow.isFlying) {
        if (!this.roundTransitioning) {
            this.roundTransitioning = true;
            setTimeout(() => {
                nextRound();
                this.roundTransitioning = false;
            }, 1500);
        }
    }
});

function broadcastTiro() {
    // Enviamos un paquete completo en cada frame
    socket.emit('sync', {
        roomId: tiroRoomId,
        type: 'tiro_sync',
        score: myTiroScore,
        angle: myArrow.angle,
        isFlying: myArrow.isFlying,
        arrowX: myArrow.x, // Enviamos X real
        arrowY: myArrow.y, // Enviamos Y real
        hasShot: myArrow.hasShot,
        wind: wind,
        role: tiroRole
    });
}

// --- ACTUALIZACIÓN DE RENDERIZADO ---
function updateTiro() {
    if (myArrow.isFlying) {
        myArrow.x += 12;
        myArrow.y += Math.sin(myArrow.angle) * 10 + wind;

        // Emitir posición de vuelo para que el rival la vea
        broadcastTiro(); 

        let dist = Math.abs(myArrow.y - targetY);
        if (myArrow.x >= 240) {
            myArrow.isFlying = false;
            myArrow.hasShot = true;
            myArrow.x = 240; // Clavar flecha en la diana
            if (dist < 40) myTiroScore += Math.max(10, Math.floor((40 - dist) * 2.5));
            broadcastTiro(); // Notificar impacto final
        }
    } else if (!myArrow.hasShot) {
        myArrow.angle = Math.sin(Date.now() / 600) * 0.5;
        broadcastTiro(); // Notificar oscilación de mira
    }
}
