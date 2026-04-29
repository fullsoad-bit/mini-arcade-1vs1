// Variables con prefijo 'pp' para evitar choques con otros juegos
let ppCanvas, ppCtx, ppRoomId, ppRole, ppActive = false;
let ppUser = { x: 0, y: 160, score: 0 };
let ppOpponent = { x: 0, y: 160, score: 0 };
let ppBall = { x: 0, y: 0, speedX: 4, speedY: 4, radius: 7 };

const PP_PADDLE_W = 12, PP_PADDLE_H = 80;

function startPingPong(roomId, isHost) {
    // 1. Crear canvas de forma segura
    ppCanvas = document.createElement('canvas');
    ppCtx = ppCanvas.getContext('2d');
    
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    ppCanvas.width = isMobile ? 400 : 600; 
    ppCanvas.height = 400;
    ppCanvas.style.cssText = "background:#000; border:4px solid #39FF14; display:block; margin:10px auto; max-width:95vw; height:auto; touch-action:none;";

    // 2. Configurar estado
    ppRoomId = roomId.toString();
    ppRole = isHost ? 'host' : 'guest';
    ppActive = true;

    // 3. Posiciones iniciales
    ppUser = { x: (ppRole === 'host' ? 0 : ppCanvas.width - PP_PADDLE_W), y: 160, score: 0 };
    ppOpponent = { x: (ppRole === 'host' ? ppCanvas.width - PP_PADDLE_W : 0), y: 160, score: 0 };
    ppBall = { x: ppCanvas.width / 2, y: ppCanvas.height / 2, speedX: 5, speedY: 5, radius: 7 };

    // 4. Limpiar y montar UI
    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const title = document.createElement('h2');
    title.style.cssText = "color:var(--neon-pink); font-family:'Press Start 2P'; font-size:12px; margin:10px;";
    title.innerText = `MODO: ${ppRole.toUpperCase()} | PRIMERO A 5`;
    
    container.appendChild(title);
    container.appendChild(ppCanvas);

    if (isMobile) setupPpMobile(container);

    // 5. Red
    socket.off('sync');
    socket.on('sync', (data) => {
        if (!ppActive) return;
        if (data.type === 'pp_move') ppOpponent.y = data.y;
        if (data.type === 'pp_ball' && ppRole === 'guest') {
            ppBall.x = data.x; ppBall.y = data.y;
            ppUser.score = data.scoreG; ppOpponent.score = data.scoreH;
        }
        if (data.type === 'pp_final') {
            ppActive = false;
            alert(data.msg);
            window.location.reload();
        }
    });

    // 6. Controles Mouse
    ppCanvas.onmousemove = (e) => {
        if (!ppActive) return;
        let rect = ppCanvas.getBoundingClientRect();
        let mouseY = (e.clientY - rect.top) * (ppCanvas.height / rect.height);
        ppUser.y = Math.max(0, Math.min(ppCanvas.height - PP_PADDLE_H, mouseY - PP_PADDLE_H / 2));
        socket.emit('sync', { roomId: ppRoomId, type: 'pp_move', y: ppUser.y });
    };

    requestAnimationFrame(ppLoop);
}

function ppLoop() {
    if (!ppActive) return;
    
    if (ppRole === 'host') {
        ppBall.x += ppBall.speedX;
        ppBall.y += ppBall.speedY;

        // Rebotes
        if (ppBall.y < 0 || ppBall.y > ppCanvas.height) ppBall.speedY *= -1;

        // Colisiones Paletas
        if (ppBall.x < PP_PADDLE_W && ppBall.y > ppUser.y && ppBall.y < ppUser.y + PP_PADDLE_H) {
            ppBall.speedX = Math.abs(ppBall.speedX) * 1.05;
        }
        if (ppBall.x > ppCanvas.width - PP_PADDLE_W && ppBall.y > ppOpponent.y && ppBall.y < ppOpponent.y + PP_PADDLE_H) {
            ppBall.speedX = -Math.abs(ppBall.speedX) * 1.05;
        }

        // Puntos
        if (ppBall.x < 0) { ppOpponent.score++; resetPpBall(); }
        if (ppBall.x > ppCanvas.width) { ppUser.score++; resetPpBall(); }

        // Sincronizar con Guest
        socket.emit('sync', { 
            roomId: ppRoomId, type: 'pp_ball', 
            x: ppBall.x, y: ppBall.y, 
            scoreH: ppUser.score, scoreG: ppOpponent.score 
        });

        if (ppUser.score >= 5 || ppOpponent.score >= 5) {
            let win = ppUser.score >= 5 ? "HOST" : "GUEST";
            socket.emit('sync', { roomId: ppRoomId, type: 'pp_final', msg: "GANÓ " + win });
            ppActive = false; alert("GANÓ " + win); window.location.reload();
        }
    }

    // Dibujar
    ppCtx.fillStyle = "#000";
    ppCtx.fillRect(0, 0, ppCanvas.width, ppCanvas.height);
    
    ppCtx.strokeStyle = "#333";
    ppCtx.setLineDash([10, 10]);
    ppCtx.beginPath(); ppCtx.moveTo(ppCanvas.width/2, 0); ppCtx.lineTo(ppCanvas.width/2, ppCanvas.height); ppCtx.stroke();

    ppCtx.fillStyle = "#39FF14"; ppCtx.fillRect(ppUser.x, ppUser.y, PP_PADDLE_W, PP_PADDLE_H);
    ppCtx.fillStyle = "#FF00FF"; ppCtx.fillRect(ppOpponent.x, ppOpponent.y, PP_PADDLE_W, PP_PADDLE_H);
    
    ppCtx.fillStyle = "#FFF";
    ppCtx.beginPath(); ppCtx.arc(ppBall.x, ppBall.y, ppBall.radius, 0, Math.PI*2); ppCtx.fill();

    ppCtx.font = "20px Monospace";
    ppCtx.fillText(ppUser.score, ppCanvas.width/2 - 50, 50);
    ppCtx.fillText(ppOpponent.score, ppCanvas.width/2 + 30, 50);

    requestAnimationFrame(ppLoop);
}

function resetPpBall() {
    ppBall.x = ppCanvas.width / 2;
    ppBall.y = ppCanvas.height / 2;
    ppBall.speedX *= -1;
}

function setupPpMobile(cont) {
    const box = document.createElement('div');
    box.style.cssText = "display:flex; justify-content:space-around; width:100%; margin-top:15px;";
    const btnS = "width:45%; height:80px; background:#222; border:2px solid #39FF14; color:white; font-size:30px; border-radius:12px;";
    
    const bU = document.createElement('button'); bU.innerHTML = "🔼"; bU.style.cssText = btnS;
    const bD = document.createElement('button'); bD.innerHTML = "🔽"; bD.style.cssText = btnS;

    const move = (d) => {
        if (d === "up") ppUser.y = Math.max(0, ppUser.y - 40);
        else ppUser.y = Math.min(ppCanvas.height - PP_PADDLE_H, ppUser.y + 40);
        socket.emit('sync', { roomId: ppRoomId, type: 'pp_move', y: ppUser.y });
    };

    bU.onclick = () => move("up");
    bD.onclick = () => move("down");
    box.appendChild(bU); box.appendChild(bD);
    cont.appendChild(box);
}
