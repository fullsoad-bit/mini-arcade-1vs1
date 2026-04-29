const canvasSp = document.createElement('canvas');
const ctxSp = canvasSp.getContext('2d');
canvasSp.width = 400; canvasSp.height = 600;
canvasSp.style.cssText = "background:#00050a; border:4px solid #00f0ff; display:block; margin:auto; max-width:95vw; height:auto; touch-action:none;";

let spaceRoomId = null, spaceRole = "", isSpaceActive = false;

// Naves: Host abajo (Verde), Guest arriba (Rosa)
let p1 = { x: 200, y: 530, hp: 100, color: "#39FF14", bullets: [] };
let p2 = { x: 200, y: 70, hp: 100, color: "#FF00FF", bullets: [] };
let meteors = [];

let joy = { active: false, dx: 0, dy: 0 };
let spaceGameInterval;

function startSpace(roomId, isHost) {
    spaceRoomId = roomId.toString();
    spaceRole = isHost ? 'host' : 'guest';
    isSpaceActive = true;
    
    // Reset
    p1.hp = 100; p2.hp = 100;
    p1.bullets = []; p2.bullets = [];
    meteors = [];

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

    // Movimiento Joystick (Solo Horizontal para este duelo)
    if (joy.active) {
        my.x += joy.dx * 8;
        if (my.x < 20) my.x = 20;
        if (my.x > 380) my.x = 380;
    }

    // Lógica Balas
    my.bullets.forEach((b, i) => {
        b.y += (spaceRole === 'host') ? -10 : 10;
        if (b.y < 0 || b.y > 600) my.bullets.splice(i, 1);
        
        // Colisión con rival
        if (Math.abs(b.x - rival.x) < 25 && Math.abs(b.y - rival.y) < 25) {
            if (spaceRole === 'host') p2.hp -= 5; 
            else socket.emit('sync', {roomId: spaceRoomId, type: 'hit_rival'});
            my.bullets.splice(i, 1);
        }
    });

    // Lógica Host (Meteoros y Daño)
    if (spaceRole === 'host') {
        if (Math.random() < 0.05) meteors.push({ x: Math.random()*400, y: 0, s: Math.random()*3+2 });
        meteors.forEach((m, i) => {
            m.y += m.s;
            if (m.y > 600) meteors.splice(i, 1);
            // Colisión naves con meteoros
            [p1, p2].forEach(p => {
                if (Math.abs(m.x - p.x) < 30 && Math.abs(m.y - p.y) < 30) {
                    p.hp -= 2;
                    meteors.splice(i, 1);
                }
            });
        });
        if (p1.hp <= 0 || p2.hp <= 0) endSpace();
    }

    socket.emit('sync', {
        roomId: spaceRoomId, type: 'space_sync',
        px: my.x, pBullets: my.bullets,
        meteors, p1Hp: p1.hp, p2Hp: p2.hp
    });

    drawSpace();
}

// Escuchador para daños del Guest
socket.on('sync', (data) => {
    if (spaceRole === 'host' && data.type === 'hit_rival') p1.hp -= 5;
});

function shoot() {
    let my = (spaceRole === 'host') ? p1 : p2;
    if (my.bullets.length < 5) {
        my.bullets.push({ x: my.x, y: my.y + (spaceRole === 'host' ? -30 : 30) });
    }
}

function drawSpace() {
    ctxSp.fillStyle = "#00050a";
    ctxSp.fillRect(0, 0, 400, 600);

    // Estrellas de fondo
    ctxSp.fillStyle = "#fff";
    for(let i=0; i<20; i++) ctxSp.fillRect(Math.random()*400, Math.random()*600, 2, 2);

    // Meteoros
    meteors.forEach(m => {
        ctxSp.fillStyle = "#888";
        ctxSp.beginPath(); ctxSp.arc(m.x, m.y, 15, 0, Math.PI*2); ctxSp.fill();
    });

    // Balas
    [p1, p2].forEach(p => {
        p.bullets.forEach(b => {
            ctxSp.fillStyle = "yellow";
            ctxSp.fillRect(b.x-2, b.y-10, 4, 20);
        });
        // Naves
        ctxSp.fillStyle = p.color;
        ctxSp.beginPath();
        if (p === p1) { // Host abajo mira arriba
            ctxSp.moveTo(p.x, p.y-25); ctxSp.lineTo(p.x-20, p.y+15); ctxSp.lineTo(p.x+20, p.y+15);
        } else { // Guest arriba mira abajo
            ctxSp.moveTo(p.x, p.y+25); ctxSp.lineTo(p.x-20, p.y-15); ctxSp.lineTo(p.x+20, p.y-15);
        }
        ctxSp.fill();
    });

    document.getElementById('space-hud').innerHTML = 
        `<span style="color:${p1.color}">P1: ${p1.hp}%</span> | <span style="color:${p2.color}">P2: ${p2.hp}%</span>`;
}

function endSpace() {
    isSpaceActive = false;
    clearInterval(spaceGameInterval);
    let win = p1.hp > 0 ? "HOST (VERDE)" : "GUEST (ROSA)";
    alert("¡NAVE DESTRUIDA!\nGanador: " + win);
    window.location.reload();
}

function setupSpaceControls(cont) {
    const ui = document.createElement('div');
    ui.style.cssText = "display:flex; justify-content:space-between; align-items:center; width:90%; margin:15px auto;";
    
    // Joystick
    const jBase = document.createElement('div');
    jBase.style.cssText = "width:100px; height:100px; background:rgba(255,255,255,0.1); border:2px solid #00f0ff; border-radius:50%; position:relative; touch-action:none;";
    const jStick = document.createElement('div');
    jStick.style.cssText = "width:40px; height:40px; background:#00f0ff; border-radius:50%; position:absolute; top:30px; left:30px;";
    
    jBase.ontouchstart = (e) => joy.active = true;
    jBase.ontouchmove = (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const r = jBase.getBoundingClientRect();
        let dx = (t.clientX - (r.left + 50)) / 50;
        if (dx > 1) dx = 1; if (dx < -1) dx = -1;
        joy.dx = dx;
        jStick.style.transform = `translateX(${dx * 30}px)`;
    };
    jBase.ontouchend = () => { joy.active = false; jStick.style.transform = "translateX(0)"; };

    // Botón Disparar
    const btnS = document.createElement('button');
    btnS.innerText = "🔥";
    btnS.style.cssText = "width:80px; height:80px; background:red; border:none; border-radius:50%; color:white; font-size:30px; box-shadow: 0 0 20px red;";
    btnS.onclick = () => shoot();

    jBase.appendChild(jStick);
    ui.appendChild(jBase);
    ui.appendChild(btnS);
    cont.appendChild(ui);
}

// Teclado PC
window.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { joy.active = true; joy.dx = -1; }
    if (e.key === "ArrowRight") { joy.active = true; joy.dx = 1; }
    if (e.key === " ") shoot();
});
window.addEventListener("keyup", () => joy.active = false);
