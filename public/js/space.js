let canvasSp, ctxSp, spaceRoomId, spaceRole, isSpaceActive = false;
let p1 = { x: 200, y: 530, hp: 100, color: "#39FF14", bullets: [] };
let p2 = { x: 200, y: 70, hp: 100, color: "#FF00FF", bullets: [] };
let meteors = [], boss = { active: false, x: 200, y: -100, hp: 500, bullets: [] };
let gameTimer = 0, joy = { active: false, dx: 0 }, spaceInterval;

function startSpace(roomId, isHost) {
    // 1. Crear el Canvas dinámicamente para evitar que esté vacío
    canvasSp = document.createElement('canvas');
    ctxSp = canvasSp.getContext('2d');
    canvasSp.width = 400; canvasSp.height = 600;
    canvasSp.style.cssText = "background:#00050a; border:4px solid #00f0ff; display:block; margin:auto; max-width:95vw; height:auto; touch-action:none;";

    spaceRoomId = roomId.toString();
    spaceRole = isHost ? 'host' : 'guest';
    isSpaceActive = true;
    gameTimer = 0; p1.hp = 100; p2.hp = 100; p1.bullets = []; p2.bullets = []; meteors = [];
    boss = { active: false, x: 200, y: -100, hp: 500, bullets: [] };

    const container = document.getElementById('game-container');
    container.innerHTML = ""; 
    container.appendChild(canvasSp);
    setupSpaceControls(container);

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isSpaceActive || data.type !== 'space_sync') return;
        if (spaceRole === 'host') { p2.x = data.px; p2.bullets = data.pBullets; }
        else { p1.x = data.px; p1.bullets = data.pBullets; meteors = data.meteors; p1.hp = data.p1Hp; p2.hp = data.p2Hp; boss = data.boss; gameTimer = data.timer; }
    });

    if (spaceInterval) clearInterval(spaceInterval);
    spaceInterval = setInterval(spaceLoop, 30);
}

function spaceLoop() {
    if (!isSpaceActive) return;
    let my = (spaceRole === 'host') ? p1 : p2;
    let rival = (spaceRole === 'host') ? p2 : p1;

    if (joy.active) { my.x += joy.dx * 8; my.x = Math.max(20, Math.min(380, my.x)); }

    my.bullets.forEach((b, i) => {
        b.y += (spaceRole === 'host') ? -12 : 12;
        if (b.y < 0 || b.y > 600) my.bullets.splice(i, 1);
        if (Math.abs(b.x - rival.x) < 25 && Math.abs(b.y - rival.y) < 25) {
            if (spaceRole === 'host') p2.hp -= 5; else socket.emit('sync', {roomId: spaceRoomId, type: 'hit_p1'});
            my.bullets.splice(i, 1);
        }
        if (boss.active && Math.abs(b.x - boss.x) < 50 && Math.abs(b.y - boss.y) < 40) {
            if (spaceRole === 'host') boss.hp -= 2; else socket.emit('sync', {roomId: spaceRoomId, type: 'hit_boss'});
            my.bullets.splice(i, 1);
        }
    });

    if (spaceRole === 'host') {
        gameTimer += 0.03;
        if (gameTimer > 45 && !boss.active) boss.active = true;
        if (boss.active && boss.hp > 0) {
            if (boss.y < 200) boss.y += 2; 
            boss.x = 200 + Math.sin(gameTimer) * 100;
            if (Math.random() < 0.05) { for(let a=0; a<Math.PI*2; a+=Math.PI/4) boss.bullets.push({x: boss.x, y: boss.y, vx: Math.cos(a)*5, vy: Math.sin(a)*5}); }
        }
        boss.bullets.forEach((bb, i) => {
            bb.x += bb.vx; bb.y += bb.vy;
            if (bb.x < 0 || bb.x > 400 || bb.y < 0 || bb.y > 600) boss.bullets.splice(i, 1);
            [p1, p2].forEach(p => { if (Math.abs(bb.x - p.x) < 20 && Math.abs(bb.y - p.y) < 20) { p.hp -= 4; boss.bullets.splice(i, 1); } });
        });
        if (Math.random() < 0.04) meteors.push({ x: Math.random()*400, y: 0, s: Math.random()*3+2 });
        meteors.forEach((m, i) => {
            m.y += m.s; if (m.y > 600) meteors.splice(i, 1);
            [p1, p2].forEach(p => { if (Math.abs(m.x - p.x) < 25 && Math.abs(m.y - p.y) < 25) { p.hp -= 3; meteors.splice(i, 1); } });
        });
        if (p1.hp <= 0 || p2.hp <= 0 || (boss.active && boss.hp <= 0)) { 
            isSpaceActive = false; 
            alert("FIN DEL DUELO"); 
            window.location.reload(); 
        }
    }
    socket.emit('sync', { roomId: spaceRoomId, type: 'space_sync', px: my.x, pBullets: my.bullets, meteors, p1Hp: p1.hp, p2Hp: p2.hp, boss, timer: gameTimer });
    drawSpace();
}

socket.on('sync', (data) => {
    if (spaceRole === 'host') { if(data.type === 'hit_p1') p1.hp -= 5; if(data.type === 'hit_boss') boss.hp -= 2; }
});

function drawSpace() {
    ctxSp.fillStyle = (gameTimer > 40 && gameTimer < 45 && Math.floor(gameTimer*5)%2==0) ? "#300" : "#00050a";
    ctxSp.fillRect(0, 0, 400, 600);
    meteors.forEach(m => { ctxSp.fillStyle = "#666"; ctxSp.beginPath(); ctxSp.arc(m.x, m.y, 15, 0, Math.PI*2); ctxSp.fill(); });
    if (boss.active && boss.hp > 0) {
        ctxSp.fillStyle = "red"; ctxSp.fillRect(boss.x-50, boss.y-30, 100, 60);
        boss.bullets.forEach(bb => { ctxSp.fillStyle = "#ff0"; ctxSp.beginPath(); ctxSp.arc(bb.x, bb.y, 4, 0, Math.PI*2); ctxSp.fill(); });
    }
    [p1, p2].forEach(p => {
        p.bullets.forEach(b => { ctxSp.fillStyle = "#0ff"; ctxSp.fillRect(b.x-2, b.y-10, 4, 15); });
        ctxSp.fillStyle = p.color; ctxSp.beginPath();
        if (p === p1) { ctxSp.moveTo(p.x, p.y-20); ctxSp.lineTo(p.x-15, p.y+10); ctxSp.lineTo(p.x+15, p.y+10); }
        else { ctxSp.moveTo(p.x, p.y+20); ctxSp.lineTo(p.x-15, p.y-10); ctxSp.lineTo(p.x+15, p.y-10); }
        ctxSp.fill();
    });
}

function setupSpaceControls(cont) {
    const ui = document.createElement('div'); ui.style.cssText = "display:flex; justify-content:space-around; align-items:center; width:100%; margin-top:15px;";
    const jBase = document.createElement('div'); jBase.style.cssText = "width:100px; height:100px; background:rgba(0,240,255,0.1); border:2px solid #00f0ff; border-radius:50%; position:relative; touch-action:none;";
    const jStick = document.createElement('div'); jStick.style.cssText = "width:40px; height:40px; background:#00f0ff; border-radius:50%; position:absolute; top:30px; left:30px;";
    jBase.ontouchmove = (e) => { e.preventDefault(); joy.active = true; let dx = (e.touches[0].clientX - (jBase.getBoundingClientRect().left + 50)) / 50; joy.dx = Math.max(-1, Math.min(1, dx)); jStick.style.transform = `translateX(${joy.dx * 25}px)`; };
    jBase.ontouchend = () => { joy.active = false; jStick.style.transform = "translateX(0)"; };
    const btnS = document.createElement('button'); btnS.innerHTML = "🔫"; btnS.style.cssText = "width:85px; height:85px; background:red; border-radius:50%; color:white; font-size:35px; border:none;";
    btnS.onclick = () => { let my = (spaceRole === 'host') ? p1 : p2; if (my.bullets.length < 6) my.bullets.push({ x: my.x, y: my.y + (spaceRole === 'host' ? -30 : 30) }); };
    jBase.appendChild(jStick); ui.appendChild(jBase); ui.appendChild(btnS); cont.appendChild(ui);
}
