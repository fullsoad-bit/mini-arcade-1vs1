// Variables globales únicas para este archivo
let spCanvas, spCtx, spRoomId, spRole, spActive = false;
let spP1 = { x: 200, y: 530, hp: 100, color: "#39FF14", b: [] };
let spP2 = { x: 200, y: 70, hp: 100, color: "#FF00FF", b: [] };
let spMeteors = [], spBoss = { active: false, x: 200, y: -100, hp: 500, b: [] };
let spTimer = 0, spJoy = { active: false, dx: 0 }, spLoop;

function startSpace(roomId, isHost) {
    // Crear canvas
    spCanvas = document.createElement('canvas');
    spCtx = spCanvas.getContext('2d');
    spCanvas.width = 400; spCanvas.height = 600;
    spCanvas.style.cssText = "background:#00050a; border:4px solid #00f0ff; display:block; margin:auto; max-width:95vw; height:auto; touch-action:none;";

    spRoomId = roomId.toString();
    spRole = isHost ? 'host' : 'guest';
    spActive = true;
    
    // Reset estado
    spTimer = 0; spP1.hp = 100; spP2.hp = 100; spP1.b = []; spP2.b = []; spMeteors = [];
    spBoss = { active: false, x: 200, y: -100, hp: 500, b: [] };

    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(spCanvas);
    
    // Setup Controles
    setupSpControls(container);

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!spActive || data.type !== 'sp_sync') return;
        if (spRole === 'host') {
            spP2.x = data.px; spP2.b = data.pb;
        } else {
            spP1.x = data.px; spP1.b = data.pb;
            spMeteors = data.met; spP1.hp = data.p1h; spP2.hp = data.p2h;
            spBoss = data.bos; spTimer = data.tm;
        }
    });

    if (spLoop) clearInterval(spLoop);
    spLoop = setInterval(runSpace, 30);
}

function runSpace() {
    if (!spActive) return;
    let my = (spRole === 'host') ? spP1 : spP2;
    let rival = (spRole === 'host') ? spP2 : spP1;

    // Mover mi nave
    if (spJoy.active) { my.x += spJoy.dx * 7; my.x = Math.max(20, Math.min(380, my.x)); }

    // Balas
    my.b.forEach((bul, i) => {
        bul.y += (spRole === 'host') ? -10 : 10;
        if (bul.y < 0 || bul.y > 600) my.b.splice(i, 1);
        if (Math.abs(bul.x - rival.x) < 25 && Math.abs(bul.y - rival.y) < 25) {
            if (spRole === 'host') spP2.hp -= 5; else socket.emit('sync', {roomId: spRoomId, type: 'sp_hit_p1'});
            my.b.splice(i, 1);
        }
        if (spBoss.active && Math.abs(bul.x - spBoss.x) < 50 && Math.abs(bul.y - spBoss.y) < 40) {
            if (spRole === 'host') spBoss.hp -= 2; else socket.emit('sync', {roomId: spRoomId, type: 'sp_hit_boss'});
            my.b.splice(i, 1);
        }
    });

    if (spRole === 'host') {
        spTimer += 0.03;
        if (spTimer > 45 && !spBoss.active) spBoss.active = true;
        if (spBoss.active && spBoss.hp > 0) {
            if (spBoss.y < 200) spBoss.y += 1.5;
            spBoss.x = 200 + Math.sin(spTimer) * 100;
            if (Math.random() < 0.04) {
                for(let a=0; a<Math.PI*2; a+=Math.PI/4) spBoss.b.push({x: spBoss.x, y: spBoss.y, vx: Math.cos(a)*4, vy: Math.sin(a)*4});
            }
        }
        spBoss.b.forEach((bb, i) => {
            bb.x += bb.vx; bb.y += bb.vy;
            if (bb.x < 0 || bb.x > 400 || bb.y < 0 || bb.y > 600) spBoss.b.splice(i, 1);
            [spP1, spP2].forEach(p => { if (Math.abs(bb.x - p.x) < 20 && Math.abs(bb.y - p.y) < 20) { p.hp -= 3; spBoss.b.splice(i, 1); } });
        });
        if (Math.random() < 0.04) spMeteors.push({ x: Math.random()*400, y: 0, s: Math.random()*2+2 });
        spMeteors.forEach((m, i) => {
            m.y += m.s; if (m.y > 600) spMeteors.splice(i, 1);
            [spP1, spP2].forEach(p => { if (Math.abs(m.x - p.x) < 25 && Math.abs(m.y - p.y) < 25) { p.hp -= 2; spMeteors.splice(i, 1); } });
        });
        if (spP1.hp <= 0 || spP2.hp <= 0 || (spBoss.active && spBoss.hp <= 0)) {
            spActive = false; alert("FIN DEL COMBATE"); window.location.reload();
        }
    }
    socket.emit('sync', { roomId: spRoomId, type: 'sp_sync', px: my.x, pb: my.b, met: spMeteors, p1h: spP1.hp, p2h: spP2.hp, bos: spBoss, tm: spTimer });
    drawSp();
}

socket.on('sync', (data) => {
    if (spRole === 'host') { if(data.type === 'sp_hit_p1') spP1.hp -= 5; if(data.type === 'sp_hit_boss') spBoss.hp -= 2; }
});

function drawSp() {
    spCtx.fillStyle = (spTimer > 40 && spTimer < 45 && Math.floor(spTimer*5)%2==0) ? "#400" : "#00050a";
    spCtx.fillRect(0, 0, 400, 600);
    spMeteors.forEach(m => { spCtx.fillStyle = "#666"; spCtx.beginPath(); spCtx.arc(m.x, m.y, 12, 0, Math.PI*2); spCtx.fill(); });
    if (spBoss.active && spBoss.hp > 0) {
        spCtx.fillStyle = "red"; spCtx.fillRect(spBoss.x-40, spBoss.y-25, 80, 50);
        spBoss.b.forEach(bb => { spCtx.fillStyle = "#ff0"; spCtx.beginPath(); spCtx.arc(bb.x, bb.y, 3, 0, Math.PI*2); spCtx.fill(); });
    }
    [spP1, spP2].forEach(p => {
        p.b.forEach(b => { spCtx.fillStyle = "#0ff"; spCtx.fillRect(b.x-1.5, b.y-8, 3, 12); });
        spCtx.fillStyle = p.color; spCtx.beginPath();
        if (p === spP1) { spCtx.moveTo(p.x, p.y-18); spCtx.lineTo(p.x-12, p.y+8); spCtx.lineTo(p.x+12, p.y+8); }
        else { spCtx.moveTo(p.x, p.y+18); spCtx.lineTo(p.x-12, p.y-8); spCtx.lineTo(p.x+12, p.y-8); }
        spCtx.fill();
    });
}

function setupSpControls(cont) {
    const ui = document.createElement('div'); ui.style.cssText = "display:flex; justify-content:space-around; align-items:center; width:100%; margin-top:15px;";
    const jBase = document.createElement('div'); jBase.style.cssText = "width:90px; height:90px; background:rgba(0,240,255,0.1); border:2px solid #00f0ff; border-radius:50%; position:relative; touch-action:none;";
    const jStick = document.createElement('div'); jStick.style.cssText = "width:35px; height:35px; background:#00f0ff; border-radius:50%; position:absolute; top:27px; left:27px;";
    jBase.ontouchmove = (e) => { e.preventDefault(); spJoy.active = true; let dx = (e.touches[0].clientX - (jBase.getBoundingClientRect().left + 45)) / 45; spJoy.dx = Math.max(-1, Math.min(1, dx)); jStick.style.transform = `translateX(${spJoy.dx * 20}px)`; };
    jBase.ontouchend = () => { spJoy.active = false; jStick.style.transform = "translateX(0)"; };
    const btnS = document.createElement('button'); btnS.innerHTML = "🚀"; btnS.style.cssText = "width:80px; height:80px; background:red; border-radius:50%; color:white; font-size:30px; border:none;";
    btnS.onclick = () => { let my = (spRole === 'host') ? spP1 : spP2; if (my.b.length < 5) my.b.push({ x: my.x, y: my.y + (spRole === 'host' ? -25 : 25) }); };
    jBase.appendChild(jStick); ui.appendChild(jBase); ui.appendChild(btnS); cont.appendChild(ui);
}
