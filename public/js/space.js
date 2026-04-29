let spCanvas, spCtx, spRoomId, spRole, spActive = false;
let spP1 = { x: 200, y: 530, hp: 1000, color: "#39FF14", b: [] };
let spP2 = { x: 200, y: 70, hp: 1000, color: "#FF00FF", b: [] };
let spMeteors = [], spBoss = { active: false, x: 200, y: -100, hp: 500, b: [] };
let spStrawberry = { active: false, x: 0, y: 0, s: 0 }; // NUEVO: Frutilla
let spTimer = 0, spJoy = { active: false, dx: 0 }, spLoop;

function startSpace(roomId, isHost) {
    spCanvas = document.createElement('canvas');
    spCtx = spCanvas.getContext('2d');
    spCanvas.width = 400; spCanvas.height = 600;
    spCanvas.style.cssText = "background:#00050a; border:4px solid #00f0ff; display:block; margin:auto; max-width:95vw; height:auto; touch-action:none;";

    spRoomId = roomId.toString();
    spRole = isHost ? 'host' : 'guest';
    spActive = true;
    spTimer = 0; spP1.hp = 1000; spP2.hp = 1000; spP1.b = []; spP2.b = []; spMeteors = [];
    spBoss = { active: false, x: 200, y: -100, hp: 500, b: [] };
    spStrawberry.active = false;

    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(spCanvas);
    setupSpControls(container);

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!spActive) return;
        if (data.type === 'sp_sync') {
            if (spRole === 'host') {
                spP2.x = data.px; spP2.b = data.pb;
            } else {
                spP1.x = data.px; spP1.b = data.pb;
                spMeteors = data.met; spP1.hp = data.p1h; spP2.hp = data.p2h;
                spBoss = data.bos; spTimer = data.tm;
                spStrawberry = data.berry; // Sincronizar frutilla
            }
        }
        if (spRole === 'host') {
            if (data.type === 'sp_hit_p1') spP1.hp -= 25;
            if (data.type === 'sp_hit_boss') spBoss.hp -= 5;
            if (data.type === 'sp_heal_guest') { spP2.hp = 1000; spStrawberry.active = false; }
        }
        if (data.type === 'sp_final') handleFinalMessage(data.winRole, data.reason);
    });

    if (spLoop) clearInterval(spLoop);
    spLoop = setInterval(runSpace, 30);
}

function runSpace() {
    if (!spActive) return;
    let my = (spRole === 'host') ? spP1 : spP2;
    let rival = (spRole === 'host') ? spP2 : spP1;

    if (spJoy.active) { my.x += spJoy.dx * 8; my.x = Math.max(25, Math.min(375, my.x)); }

    // Lógica Balas
    my.b.forEach((bul, i) => {
        bul.y += (spRole === 'host') ? -12 : 12;
        if (bul.y < 0 || bul.y > 600) my.b.splice(i, 1);
        if (Math.abs(bul.x - rival.x) < 25 && Math.abs(bul.y - rival.y) < 25) {
            if (spRole === 'host') spP2.hp -= 25; else socket.emit('sync', {roomId: spRoomId, type: 'sp_hit_p1'});
            my.b.splice(i, 1);
        }
    });

    // Lógica Host (Items y Obstáculos)
    if (spRole === 'host') {
        spTimer += 0.03;
        
        // Spawn de Frutilla Curativa
        if (!spStrawberry.active && Math.random() < 0.005) {
            spStrawberry = { active: true, x: Math.random()*360+20, y: 300, s: (Math.random() > 0.5 ? 2 : -2) };
        }
        if (spStrawberry.active) {
            spStrawberry.y += spStrawberry.s;
            if (spStrawberry.y < 0 || spStrawberry.y > 600) spStrawberry.active = false;
            
            // Colisión Frutilla
            if (Math.abs(spStrawberry.x - spP1.x) < 30 && Math.abs(spStrawberry.y - spP1.y) < 30) {
                spP1.hp = 1000; spStrawberry.active = false;
            }
            if (Math.abs(spStrawberry.x - spP2.x) < 30 && Math.abs(spStrawberry.y - spP2.y) < 30) {
                spP2.hp = 1000; spStrawberry.active = false;
            }
        }

        // Meteoros y Boss (Igual que antes)
        if (Math.random() < 0.04) spMeteors.push({ x: Math.random()*400, y: 300, s: (Math.random() > 0.5 ? 1 : -1) * (Math.random()*3+2) });
        spMeteors.forEach((m, i) => {
            m.y += m.s; if (m.y > 600 || m.y < 0) spMeteors.splice(i, 1);
            [spP1, spP2].forEach(p => { if (Math.abs(m.x - p.x) < 25 && Math.abs(m.y - p.y) < 25) { p.hp -= 40; spMeteors.splice(i, 1); } });
        });

        if (spP1.hp <= 0 || spP2.hp <= 0) {
            let winRole = spP1.hp <= 0 ? "guest" : "host";
            socket.emit('sync', { roomId: spRoomId, type: 'sp_final', winRole, reason: "Nave destruida" });
            handleFinalMessage(winRole, "Nave destruida");
        }
    } else {
        // El Guest avisa si agarró la frutilla
        if (spStrawberry.active && Math.abs(spStrawberry.x - spP2.x) < 30 && Math.abs(spStrawberry.y - spP2.y) < 30) {
            socket.emit('sync', { roomId: spRoomId, type: 'sp_heal_guest' });
        }
    }

    socket.emit('sync', { roomId: spRoomId, type: 'sp_sync', px: my.x, pb: my.b, met: spMeteors, p1h: spP1.hp, p2h: spP2.hp, bos: spBoss, tm: spTimer, berry: spStrawberry });
    drawSp();
}

function drawSp() {
    spCtx.fillStyle = "#00050a"; spCtx.fillRect(0, 0, 400, 600);
    spMeteors.forEach(m => { spCtx.fillStyle = "#555"; spCtx.beginPath(); spCtx.arc(m.x, m.y, 14, 0, Math.PI*2); spCtx.fill(); });

    // Dibujar Frutilla
    if (spStrawberry.active) {
        spCtx.font = "24px Arial"; spCtx.textAlign = "center";
        spCtx.fillText("🍓", spStrawberry.x, spStrawberry.y + 10);
        spCtx.strokeStyle = "gold"; spCtx.lineWidth = 2;
        spCtx.beginPath(); spCtx.arc(spStrawberry.x, spStrawberry.y, 20, 0, Math.PI*2); spCtx.stroke();
    }

    // Dibujar Naves Estilizadas
    const drawShip = (p, isP1) => {
        spCtx.save();
        spCtx.translate(p.x, p.y);
        let dir = isP1 ? 1 : -1;
        
        // Propulsor animado
        spCtx.fillStyle = (Math.floor(Date.now()/50)%2==0) ? "#0ff" : "#00f";
        spCtx.fillRect(-5, 15*dir, 10, 10*dir);

        // Cuerpo
        spCtx.fillStyle = p.color;
        spCtx.beginPath();
        spCtx.moveTo(0, -25*dir); // Punta
        spCtx.lineTo(-15, 10*dir); // Ala izq
        spCtx.lineTo(0, 5*dir);    // Centro atras
        spCtx.lineTo(15, 10*dir);  // Ala der
        spCtx.closePath();
        spCtx.fill();
        
        // Cabina
        spCtx.fillStyle = "rgba(255,255,255,0.5)";
        spCtx.beginPath(); spCtx.arc(0, -5*dir, 5, 0, Math.PI*2); spCtx.fill();
        spCtx.restore();
    };

    drawShip(spP1, true); drawShip(spP2, false);

    // Balas
    [spP1, spP2].forEach(p => {
        p.b.forEach(bullet => {
            spCtx.fillStyle = "#fff"; spCtx.shadowBlur = 10; spCtx.shadowColor = "#0ff";
            spCtx.fillRect(bullet.x-1, bullet.y-10, 3, 15);
            spCtx.shadowBlur = 0;
        });
    });

    // Barras HP
    const hb = (x, y, hp, col, txt) => {
        spCtx.fillStyle = "#222"; spCtx.fillRect(x, y, 150, 12);
        spCtx.fillStyle = col; spCtx.fillRect(x, y, (hp/1000)*150, 12);
        spCtx.strokeStyle = "#fff"; spCtx.strokeRect(x, y, 150, 12);
        spCtx.fillStyle = "#fff"; spCtx.font = "8px 'Press Start 2P'"; spCtx.fillText(txt, x, y-5);
    };
    hb(20, 580, spP1.hp, "#39FF14", "P1: "+spP1.hp);
    hb(230, 30, spP2.hp, "#FF00FF", "P2: "+spP2.hp);
}

function setupSpControls(cont) {
    const ui = document.createElement('div'); ui.style.cssText = "display:flex; justify-content:space-around; align-items:center; width:100%; margin-top:15px;";
    const jBase = document.createElement('div'); jBase.style.cssText = "width:100px; height:100px; background:rgba(0,240,255,0.1); border:2px solid #00f0ff; border-radius:50%; position:relative; touch-action:none;";
    const jStick = document.createElement('div'); jStick.style.cssText = "width:40px; height:40px; background:#00f0ff; border-radius:50%; position:absolute; top:30px; left:30px;";
    jBase.ontouchmove = (e) => { e.preventDefault(); spJoy.active = true; let dx = (e.touches[0].clientX - (jBase.getBoundingClientRect().left + 50)) / 50; spJoy.dx = Math.max(-1, Math.min(1, dx)); jStick.style.transform = `translateX(${spJoy.dx * 25}px)`; };
    jBase.ontouchend = () => { spJoy.active = false; jStick.style.transform = "translateX(0)"; };
    const btnS = document.createElement('button'); btnS.innerHTML = "🚀"; btnS.style.cssText = "width:85px; height:85px; background:red; border-radius:50%; color:white; font-size:35px; border:none;";
    btnS.onclick = () => { let my = (spRole === 'host') ? spP1 : spP2; if (my.b.length < 6) my.b.push({ x: my.x, y: my.y + (spRole === 'host' ? -30 : 30) }); };
    jBase.appendChild(jStick); ui.appendChild(jBase); ui.appendChild(btnS); cont.appendChild(ui);
}

function handleFinalMessage(winRole, reason) {
    if (!spActive) return; spActive = false; clearInterval(spLoop);
    let msg = (winRole === spRole) ? "¡VICTORIA! 🏆" : "¡DERROTA! 💀";
    alert(msg + "\n" + reason); window.location.reload();
}
