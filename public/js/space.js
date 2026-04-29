let spCanvas, spCtx, spRoomId, spRole, spActive = false;
let spP1 = { x: 200, y: 530, hp: 1000, color: "#39FF14", b: [] };
let spP2 = { x: 200, y: 70, hp: 1000, color: "#FF00FF", b: [] };
let spMeteors = [], spBoss = { active: false, x: 200, y: -100, hp: 500, b: [] };
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
            }
        }

        // --- CORRECCIÓN: PROCESAR DAÑO EN EL HOST ---
        if (spRole === 'host') {
            if (data.type === 'sp_hit_p1') spP1.hp -= 25;
            if (data.type === 'sp_hit_boss') spBoss.hp -= 5;
        }

        if (data.type === 'sp_final') {
            handleFinalMessage(data.winRole, data.reason);
        }
    });

    if (spLoop) clearInterval(spLoop);
    spLoop = setInterval(runSpace, 30);
}

function runSpace() {
    if (!spActive) return;
    let my = (spRole === 'host') ? spP1 : spP2;
    let rival = (spRole === 'host') ? spP2 : spP1;

    if (spJoy.active) { 
        my.x += spJoy.dx * 8; 
        my.x = Math.max(25, Math.min(375, my.x)); 
    }

    my.b.forEach((bul, i) => {
        bul.y += (spRole === 'host') ? -12 : 12;
        if (bul.y < 0 || bul.y > 600) my.b.splice(i, 1);
        
        // Impacto al rival
        if (Math.abs(bul.x - rival.x) < 25 && Math.abs(bul.y - rival.y) < 25) {
            if (spRole === 'host') spP2.hp -= 25; 
            else socket.emit('sync', {roomId: spRoomId, type: 'sp_hit_p1'});
            my.b.splice(i, 1);
        }

        // Impacto al Boss
        if (spBoss.active && spBoss.hp > 0 && Math.abs(bul.x - spBoss.x) < 40 && Math.abs(bul.y - spBoss.y) < 40) {
            if (spRole === 'host') spBoss.hp -= 5; 
            else socket.emit('sync', {roomId: spRoomId, type: 'sp_hit_boss'});
            my.b.splice(i, 1);
        }
    });

    if (spRole === 'host') {
        spTimer += 0.03;
        if (spTimer > 45 && !spBoss.active) spBoss.active = true;
        
        // Boss IA
        if (spBoss.active && spBoss.hp > 0) {
            if (spBoss.y < 200) spBoss.y += 1.5;
            spBoss.x = 200 + Math.sin(spTimer) * 100;
            if (Math.random() < 0.06) {
                for(let a=0; a<Math.PI*2; a+=Math.PI/4) spBoss.b.push({x: spBoss.x, y: spBoss.y, vx: Math.cos(a)*5, vy: Math.sin(a)*5});
            }
        }
        spBoss.b.forEach((bb, i) => {
            bb.x += bb.vx; bb.y += bb.vy;
            if (bb.x < 0 || bb.x > 400 || bb.y < 0 || bb.y > 600) spBoss.b.splice(i, 1);
            [spP1, spP2].forEach(p => { if (Math.abs(bb.x - p.x) < 20 && Math.abs(bb.y - p.y) < 20) { p.hp -= 15; spBoss.b.splice(i, 1); } });
        });

        // Meteoros
        if (Math.random() < 0.04) spMeteors.push({ x: Math.random()*400, y: 300, s: (Math.random() > 0.5 ? 1 : -1) * (Math.random()*3+2) });
        spMeteors.forEach((m, i) => {
            m.y += m.s; 
            if (m.y > 600 || m.y < 0) spMeteors.splice(i, 1);
            [spP1, spP2].forEach(p => { if (Math.abs(m.x - p.x) < 25 && Math.abs(m.y - p.y) < 25) { p.hp -= 40; spMeteors.splice(i, 1); } });
        });

        // REVISAR FINAL
        if (spP1.hp <= 0 || spP2.hp <= 0 || (spBoss.active && spBoss.hp <= 0)) {
            let winRole = "draw";
            let reason = "Empate";
            if (spP1.hp <= 0) { winRole = "guest"; reason = "Nave Host Destruida"; }
            else if (spP2.hp <= 0) { winRole = "host"; reason = "Nave Guest Destruida"; }
            else if (spBoss.hp <= 0) { winRole = "coop"; reason = "¡Boss Derrotado!"; }

            socket.emit('sync', { roomId: spRoomId, type: 'sp_final', winRole, reason });
            handleFinalMessage(winRole, reason);
        }
    }

    socket.emit('sync', { roomId: spRoomId, type: 'sp_sync', px: my.x, pb: my.b, met: spMeteors, p1h: spP1.hp, p2h: spP2.hp, bos: spBoss, tm: spTimer });
    drawSp();
}

function handleFinalMessage(winRole, reason) {
    if (!spActive) return;
    spActive = false;
    clearInterval(spLoop);

    let finalMsg = "";
    if (winRole === "coop") finalMsg = "¡MISIÓN CUMPLIDA!\n" + reason;
    else if (winRole === spRole) finalMsg = "¡VICTORIA! 🏆\n" + reason;
    else if (winRole === "draw") finalMsg = "¡EMPATE!\n" + reason;
    else finalMsg = "¡DERROTA! 💀\n" + reason;

    setTimeout(() => {
        alert(finalMsg);
        window.location.reload();
    }, 500);
}

function drawSp() {
    spCtx.fillStyle = (spTimer > 40 && spTimer < 45 && Math.floor(spTimer*5)%2==0) ? "#400" : "#00050a";
    spCtx.fillRect(0, 0, 400, 600);
    
    spMeteors.forEach(m => { spCtx.fillStyle = "#555"; spCtx.beginPath(); spCtx.arc(m.x, m.y, 14, 0, Math.PI*2); spCtx.fill(); });

    // BARRAS DE VIDA
    const drawHealthBar = (x, y, hp, color, label) => {
        spCtx.fillStyle = "#222"; spCtx.fillRect(x, y, 150, 12);
        spCtx.fillStyle = color; spCtx.fillRect(x, y, (Math.max(0, hp) / 1000) * 150, 12);
        spCtx.strokeStyle = "#fff"; spCtx.strokeRect(x, y, 150, 12);
        spCtx.fillStyle = "#fff"; spCtx.font = "9px 'Press Start 2P', cursive";
        spCtx.fillText(label, x, y - 5);
    };

    drawHealthBar(20, 580, spP1.hp, "#39FF14", "P1 (VERDE)");
    drawHealthBar(230, 30, spP2.hp, "#FF00FF", "P2 (ROSA)");

    // BOSS
    if (spBoss.active && spBoss.hp > 0) {
        spCtx.save();
        spCtx.translate(spBoss.x, spBoss.y);
        spCtx.strokeStyle = "#2ecc71"; spCtx.lineWidth = 4;
        for(let i=0; i<5; i++) {
            spCtx.beginPath(); spCtx.moveTo(-20 + i*10, 20);
            let offset = Math.sin(spTimer * 5 + i) * 15;
            spCtx.quadraticCurveTo(-20 + i*10 + offset, 40, -20 + i*10, 60); spCtx.stroke();
        }
        spCtx.fillStyle = "#39FF14"; spCtx.beginPath(); spCtx.ellipse(0, 0, 40, 30, 0, 0, Math.PI * 2); spCtx.fill();
        spCtx.fillStyle = "black"; 
        spCtx.beginPath(); spCtx.ellipse(-15, -5, 10, 15, Math.PI/4, 0, Math.PI * 2); spCtx.fill();
        spCtx.beginPath(); spCtx.ellipse(15, -5, 10, 15, -Math.PI/4, 0, Math.PI * 2); spCtx.fill();
        spCtx.restore();
        spCtx.fillStyle = "red"; spCtx.fillRect(spBoss.x-40, spBoss.y-50, (spBoss.hp/500)*80, 6);
        spBoss.b.forEach(bb => { spCtx.fillStyle = "#ff0"; spCtx.beginPath(); spCtx.arc(bb.x, bb.y, 4, 0, Math.PI*2); spCtx.fill(); });
    }

    // NAVES
    [spP1, spP2].forEach(p => {
        p.b.forEach(b => { spCtx.fillStyle = "#0ff"; spCtx.fillRect(b.x-2, b.y-10, 4, 15); });
        spCtx.fillStyle = p.color; spCtx.beginPath();
        if (p === spP1) { spCtx.moveTo(p.x, p.y-22); spCtx.lineTo(p.x-18, p.y+12); spCtx.lineTo(p.x+18, p.y+12); }
        else { spCtx.moveTo(p.x, p.y+22); spCtx.lineTo(p.x-18, p.y-12); spCtx.lineTo(p.x+18, p.y-12); }
        spCtx.fill();
    });
}

function setupSpControls(cont) {
    const ui = document.createElement('div'); ui.style.cssText = "display:flex; justify-content:space-around; align-items:center; width:100%; margin-top:20px;";
    const jBase = document.createElement('div'); 
    jBase.style.cssText = "width:100px; height:100px; background:rgba(0,240,255,0.1); border:3px solid #00f0ff; border-radius:50%; position:relative; touch-action:none;";
    const jStick = document.createElement('div'); 
    jStick.style.cssText = "width:45px; height:45px; background:#00f0ff; border-radius:50%; position:absolute; top:27px; left:27px; pointer-events:none;";
    
    const moveJoy = (e) => {
        e.preventDefault();
        const r = jBase.getBoundingClientRect();
        let dx = (e.touches[0].clientX - (r.left + 50)) / 50;
        spJoy.dx = Math.max(-1, Math.min(1, dx));
        spJoy.active = true;
        jStick.style.transform = `translateX(${spJoy.dx * 25}px)`;
    };

    jBase.addEventListener('touchstart', (e) => { spJoy.active = true; moveJoy(e); });
    jBase.addEventListener('touchmove', moveJoy);
    jBase.addEventListener('touchend', () => { spJoy.active = false; spJoy.dx = 0; jStick.style.transform = "translateX(0)"; });

    const btnS = document.createElement('button'); 
    btnS.innerHTML = "🚀"; 
    btnS.style.cssText = "width:85px; height:85px; background:rgba(255,0,0,0.8); border:none; border-radius:50%; color:white; font-size:35px; box-shadow:0 0 20px red;";
    btnS.onclick = () => { 
        let my = (spRole === 'host') ? spP1 : spP2; 
        if (my.b.length < 6) my.b.push({ x: my.x, y: my.y + (spRole === 'host' ? -30 : 30) }); 
    };

    jBase.appendChild(jStick); ui.appendChild(jBase); ui.appendChild(btnS); cont.appendChild(ui);
}

window.onkeydown = (e) => {
    if (e.key === "ArrowLeft") { spJoy.active = true; spJoy.dx = -1; }
    if (e.key === "ArrowRight") { spJoy.active = true; spJoy.dx = 1; }
    if (e.key === " ") {
        let my = (spRole === 'host') ? spP1 : spP2;
        if (my.b.length < 6) my.b.push({ x: my.x, y: my.y + (spRole === 'host' ? -30 : 30) });
    }
};
window.onkeyup = () => { spJoy.active = false; spJoy.dx = 0; };
