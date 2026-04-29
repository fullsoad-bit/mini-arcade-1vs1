const canvasSp = document.createElement('canvas');
const ctxSp = canvasSp.getContext('2d');
canvasSp.width = 400; canvasSp.height = 600;
canvasSp.style.cssText = "background:#00050a; border:4px solid #00f0ff; display:block; margin:auto; max-width:95vw; height:auto; touch-action:none;";

let spaceRoomId = null, spaceRole = "", isSpaceActive = false;

let p1 = { x: 200, y: 530, hp: 100, color: "#39FF14", bullets: [] };
let p2 = { x: 200, y: 70, hp: 100, color: "#FF00FF", bullets: [] };
let meteors = [];

// Lógica del Boss
let boss = { active: false, x: 200, y: -100, hp: 500, timer: 0, bullets: [] };
let gameTimer = 0;

let joy = { active: false, dx: 0, dy: 0 };
let spaceGameInterval;

function startSpace(roomId, isHost) {
    spaceRoomId = roomId.toString();
    spaceRole = isHost ? 'host' : 'guest';
    isSpaceActive = true;
    
    gameTimer = 0;
    p1.hp = 100; p2.hp = 100;
    p1.bullets = []; p2.bullets = [];
    meteors = [];
    boss = { active: false, x: 200, y: -100, hp: 500, bullets: [] };

    const container = document.getElementById('game-container');
    container.innerHTML = "";
    
    const hud = document.createElement('div');
    hud.id = "space-hud";
    hud.style.cssText = "color:#fff; font-family:'Press Start 2P'; font-size:10px; margin-bottom:10px;";
    container.appendChild(hud);
    container.appendChild(canvasSp);
    
    setupSpaceControls(container);

    socket.off('sync');
    socket.on('sync', (data) => {
        if (!isSpaceActive) return;
        if (data.type === 'space_sync') {
            if (spaceRole === 'host') {
                p2.x = data.px; p2.bullets = data.pBullets;
            } else {
                p1.x = data.px; p1.bullets = data.pBullets;
                meteors = data.meteors;
                p1.hp = data.p1Hp; p2.hp = data.p2Hp;
                boss = data.boss;
                gameTimer = data.timer;
            }
        }
    });

    if (spaceGameInterval) clearInterval(spaceGameInterval);
    spaceGameInterval = setInterval(spaceLoop, 30);
}

function spaceLoop() {
    if (!isSpaceActive) return;

    let my = (spaceRole === 'host') ? p1 : p2;
    let rival = (spaceRole === 'host') ? p2 : p1;

    // Movimiento
    if (joy.active) {
        my.x += joy.dx * 8;
        if (my.x < 20) my.x = 20;
        if (my.x > 380) my.x = 380;
    }

    // Balas Jugador
    my.bullets.forEach((b, i) => {
        b.y += (spaceRole === 'host') ? -12 : 12;
        if (b.y < 0 || b.y > 600) my.bullets.splice(i, 1);
        
        // Colisión con rival
        if (Math.abs(b.x - rival.x) < 25 && Math.abs(b.y - rival.y) < 25) {
            if (spaceRole === 'host') p2.hp -= 5; 
            else socket.emit('sync', {roomId: spaceRoomId, type: 'hit_rival'});
            my.bullets.splice(i, 1);
        }

        // Colisión con Boss
        if (boss.active && Math.abs(b.x - boss.x) < 50 && Math.abs(b.y - boss.y) < 40) {
            if (spaceRole === 'host') boss.hp -= 2;
            else socket.emit('sync', {roomId: spaceRoomId, type: 'hit_boss'});
            my.bullets.splice(i, 1);
        }
    });

    // Lógica del Host (Meteoros, Boss y Tiempo)
    if (spaceRole === 'host') {
        gameTimer += 0.03;

        // Aparición del Boss a los 45 segundos
        if (gameTimer > 45 && !boss.active && boss.hp > 0) {
            boss.active = true;
        }

        if (boss.active) {
            // Movimiento suave del Boss al centro
            if (boss.y < 300) boss.y += 2;
            boss.x = 200 + Math.sin(gameTimer) * 100;

            // Disparos del Boss
            if (Math.random() < 0.05) {
                for(let a=0; a<Math.PI*2; a+=Math.PI/4) {
                    boss.bullets.push({x: boss.x, y: boss.y, vx: Math.cos(a)*5, vy: Math.sin(a)*5});
                }
            }
        }

        // Mover Balas del Boss y Meteoros
        boss.bullets.forEach((bb, i) => {
            bb.x += bb.vx; bb.y += bb.vy;
            if (bb.x < 0 || bb.x > 400 || bb.y < 0 || bb.y > 600) boss.bullets.splice(i, 1);
            [p1, p2].forEach(p => {
                if (Math.abs(bb.x - p.x) < 20 && Math.abs(bb.y - p.y) < 20) {
                    p.hp -= 4;
                    boss.bullets.splice(i, 1);
                }
            });
        });

        if (Math.random() < 0.04) meteors.push({ x: Math.random()*400, y: 0, s: Math.random()*3+2 });
        meteors.forEach((m, i) => {
            m.y += m.s;
            if (m.y > 600) meteors.splice(i, 1);
            [p1, p2].forEach(p => {
                if (Math.abs(m.x - p.x) < 25 && Math.abs(m.y - p.y) < 25) {
                    p.hp -= 3;
                    meteors.splice(i, 1);
                }
            });
        });

        if (p1.hp <= 0 || p2.hp <= 0 || boss.hp <= 0) endSpace();
    }

    socket.emit('sync', {
        roomId: spaceRoomId, type: 'space_sync',
        px: my.x, pBullets: my.bullets,
        meteors, p1Hp: p1.hp, p2Hp: p2.hp,
        boss, timer: gameTimer
    });

    drawSpace();
}

socket.on('sync', (data) => {
    if (spaceRole === 'host' && data.type === 'hit_rival') p1.hp -= 5;
    if (spaceRole === 'host' && data.type === 'hit_boss') boss.hp -= 2;
});

function shoot() {
    let my = (spaceRole === 'host') ? p1 : p2;
    if (my.bullets.length < 6) {
        my.bullets.push({ x: my.x, y: my.y + (spaceRole === 'host' ? -30 : 30) });
    }
}

function drawSpace() {
    // Fondo con parpadeo de alerta antes del Boss
    if (gameTimer > 40 && gameTimer < 45 && Math.floor(gameTimer*5)%2==0) {
        ctxSp.fillStyle = "#200";
    } else {
        ctxSp.fillStyle = "#00050a";
    }
    ctxSp.fillRect(0, 0, 400, 600);

    // Meteoros
    meteors.forEach(m => {
        ctxSp.fillStyle = "#555";
        ctxSp.beginPath(); ctxSp.arc(m.x, m.y, 15, 0, Math.PI*2); ctxSp.fill();
    });

    // Boss
    if (boss.active) {
        ctxSp.fillStyle = "red";
        ctxSp.shadowBlur = 20; ctxSp.shadowColor = "red";
        ctxSp.fillRect(boss.x-50, boss.y-30, 100, 60);
        ctxSp.fillStyle = "#fff";
        ctxSp.fillRect(boss.x-40, boss.y-45, (boss.hp/500)*80, 5); // Barra vida Boss
        ctxSp.shadowBlur = 0;
        
        boss.bullets.forEach(bb => {
            ctxSp.fillStyle = "#ff0";
            ctxSp.beginPath(); ctxSp.arc(bb.x, bb.y, 4, 0, Math.PI*2); ctxSp.fill();
        });
    }

    // Balas y Naves
    [p1, p2].forEach(p => {
        p.bullets.forEach(b => {
            ctxSp.fillStyle = "#0ff";
            ctxSp.fillRect(b.x-2, b.y-10, 4, 15);
        });
        ctxSp.fillStyle = p.color;
        ctxSp.beginPath();
        if (p === p1) {
            ctxSp.moveTo(p.x, p.y-20); ctxSp.lineTo(p.x-15, p.y+10); ctxSp.lineTo(p.x+15, p.y+10);
        } else {
            ctxSp.moveTo(p.x, p.y+20); ctxSp.lineTo(p.x-15, p.y-10); ctxSp.lineTo(p.x+15, p.y-10);
        }
        ctxSp.fill();
    });

    let hudText = `P1: ${Math.max(0, p1.hp)}% | P2: ${Math.max(0, p2.hp)}%`;
    if (boss.active) hudText = "⚠️ ¡BOSS DETECTADO! ⚠️";
    document.getElementById('space-hud').innerHTML = hudText;
}

function endSpace() {
    isSpaceActive = false;
    clearInterval(spaceGameInterval);
    let msg = "";
    if (boss.hp <= 0) msg = "¡EL BOSS FUE DERROTADO! (EMPATE)";
    else if (p1.hp <= 0 && p2.hp <= 0) msg = "¡AMBOS DESTRUIDOS!";
    else if (p1.hp <= 0) msg = "¡GANÓ GUEST (ROSA)!";
    else msg = "¡GANÓ HOST (VERDE)!";
    
    alert(msg);
    window.location.reload();
}

function setupSpaceControls(cont) {
    const ui = document.createElement('div');
    ui.style.cssText = "display:flex; justify-content:space-around; align-items:center; width:100%; margin-top:15px;";
    
    const jBase = document.createElement('div');
    jBase.style.cssText = "width:100px; height:100px; background:rgba(0,240,255,0.1); border:2px solid #00f0ff; border-radius:50%; position:relative; touch-action:none;";
    const jStick = document.createElement('div');
    jStick.style.cssText = "width:40px; height:40px; background:#00f0ff; border-radius:50%; position:absolute; top:30px; left:30px;";
    
    jBase.ontouchstart = () => joy.active = true;
    jBase.ontouchmove = (e) => {
        e.preventDefault();
        const r = jBase.getBoundingClientRect();
        let dx = (e.touches[0].clientX - (r.left + 50)) / 50;
        joy.dx = Math.max(-1, Math.min(1, dx));
        jStick.style.transform = `translateX(${joy.dx * 25}px)`;
    };
    jBase.ontouchend = () => { joy.active = false; jStick.style.transform = "translateX(0)"; };

    const btnS = document.createElement('button');
    btnS.innerHTML = "🔫";
    btnS.style.cssText = "width:85px; height:85px; background:rgba(255,0,0,0.6); border:3px solid red; border-radius:50%; color:white; font-size:35px; box-shadow:0 0 15px red;";
    btnS.onclick = () => shoot();

    jBase.appendChild(jStick);
    ui.appendChild(jBase);
    ui.appendChild(btnS);
    cont.appendChild(ui);
}

window.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { joy.active = true; joy.dx = -1; }
    if (e.key === "ArrowRight") { joy.active = true; joy.dx = 1; }
    if (e.key === " ") shoot();
});
window.addEventListener("keyup", () => joy.active = false);
