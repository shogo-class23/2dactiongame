const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const homeBtn = document.getElementById('home-btn');
const stageDisplay = document.getElementById('stage-display');
const distDisplay = document.getElementById('dist-display');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let gameState = 'START';

const keys = { right: false, left: false, up: false, shoot: false };
window.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') keys.up = true;
    if (e.key === 'f' || e.key === 'Enter') keys.shoot = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') keys.up = false;
    if (e.key === 'f' || e.key === 'Enter') keys.shoot = false;
});

window.addEventListener('mousedown', () => { if(gameState === 'PLAYING') keys.shoot = true; });
window.addEventListener('mouseup', () => { keys.shoot = false; });

const gravity = 0.5;
const friction = 0.8;

class Projectile {
    constructor(x, y, direction) {
        this.position = { x, y };
        this.velocity = { x: direction === 'right' ? 15 : -15, y: 0 };
        this.radius = 8;
        this.life = 100;
        this.color = '#00ffff';
    }
    draw() {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    update() {
        this.position.x += this.velocity.x;
        this.life--;
        this.draw();
    }
}

class Enemy {
    constructor(x, y, range, speed = 2) {
        this.position = { x, y };
        this.startPos = x;
        this.range = range;
        this.width = 40;
        this.height = 40;
        this.velocity = speed;
        this.color = '#7b2cbf';
        this.alive = true;
    }
    draw() {
        if (!this.alive) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(this.position.x, this.position.y, this.width, this.height, 4);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.fillRect(this.position.x + 5, this.position.y + 10, 10, 5);
        ctx.fillRect(this.position.x + 25, this.position.y + 10, 10, 5);
    }
    update() {
        if (!this.alive) return;
        this.position.x += this.velocity;
        if (this.position.x > this.startPos + this.range || this.position.x < this.startPos) {
            this.velocity = -this.velocity;
        }
        this.draw();
    }
}

class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.resetPosition(100);
        this.color = '#e94560';
        this.facing = 'right';
    }
    resetPosition(startX = 100) {
        this.position = { x: startX, y: 100 };
        this.velocity = { x: 0, y: 0 };
        this.jumpCount = 0;
        this.maxJumps = 2;
        this.speed = 7;
        this.jumpPower = 12;
        this.onGround = false;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(this.position.x, this.position.y, this.width, this.height, 8);
        ctx.fill();
        ctx.fillStyle = 'white';
        const eyeX = this.facing === 'right' ? this.position.x + 25 : this.position.x + 5;
        ctx.fillRect(eyeX, this.position.y + 10, 10, 10);
    }
    update() {
        this.velocity.y += gravity;
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        if (keys.right) {
            this.velocity.x = this.speed;
            this.facing = 'right';
        } else if (keys.left) {
            this.velocity.x = -this.speed;
            this.facing = 'left';
        } else {
            this.velocity.x *= friction;
        }
        
        if (this.position.x < 0) {
            this.position.x = 0;
            this.velocity.x = 0;
        }

        if (this.position.y > canvas.height + 100) {
            this.resetPosition(100);
        }
        this.draw();
    }
}

class Platform {
    constructor({ x, y, width, height, color = '#16213e', stroke = true }) {
        this.position = { x, y };
        this.width = width;
        this.height = height;
        this.color = color;
        this.stroke = stroke;
    }
    draw() {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        if (this.stroke) {
            ctx.strokeStyle = '#0f3460';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.position.x, this.position.y, this.width, this.height);
        }
    }
}

let player = new Player();
let platforms = [];
let enemies = [];
let projectiles = [];
let scrollOffset = 0;
let lastJumpKeyState = false;
let lastShootKeyState = false;

function initGame() {
    player = new Player();
    platforms = [];
    enemies = [];
    projectiles = [];
    scrollOffset = 0;

    // 1. 左半分の壁
    platforms.push(new Platform({ x: -2000, y: 0, width: 2000, height: 1000, color: '#0f3460', stroke: false }));
    // 2. スタート
    platforms.push(new Platform({ x: 0, y: 500, width: 600, height: 200 }));
    // 3. 段差
    platforms.push(new Platform({ x: 600, y: 350, width: 400, height: 350 }));
    // 4. 低地
    platforms.push(new Platform({ x: 1000, y: 550, width: 600, height: 200 }));
    // 5. 平地+敵
    platforms.push(new Platform({ x: 1600, y: 550, width: 1500, height: 200 }));
    enemies.push(new Enemy(1800, 510, 200, 2));
    enemies.push(new Enemy(2200, 510, 150, 3));
    enemies.push(new Enemy(2500, 510, 200, 4));
    enemies.push(new Enemy(2800, 510, 100, 5));
    // 6. 階段
    platforms.push(new Platform({ x: 3100, y: 400, width: 400, height: 300 }));
    platforms.push(new Platform({ x: 3500, y: 250, width: 400, height: 450 }));
    // 7. 最終直線
    platforms.push(new Platform({ x: 3900, y: 250, width: 1000, height: 450 }));
    // 8. ゴール
    platforms.push(new Platform({ x: 4800, y: -150, width: 100, height: 400, color: '#ff0000' }));
}

function drawInGameArrow(x, y) {
    const time = Date.now() / 200;
    const offset = Math.sin(time) * 20;
    ctx.save();
    ctx.fillStyle = '#ff0000';
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'red';
    ctx.font = 'bold 120px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('→', x + offset, y);
    ctx.restore();
}

function drawCheckpointText(x, y) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(`GOAL!!`, x, y);
    ctx.fillText(`GOAL!!`, x, y);
    ctx.restore();
}

// イベントリスナーの追加
startBtn.addEventListener('click', () => {
    gameState = 'PLAYING';
    startScreen.classList.add('hidden');
    homeBtn.classList.remove('hidden');
    initGame();
});

homeBtn.addEventListener('click', () => {
    gameState = 'START';
    startScreen.classList.remove('hidden');
    homeBtn.classList.add('hidden');
});

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'START') return;

    ctx.save();
    scrollOffset = player.position.x - canvas.width / 3;
    ctx.translate(-scrollOffset, 0);

    drawInGameArrow(200, 400);
    drawInGameArrow(1800, 450);

    platforms.forEach(platform => platform.draw());
    enemies.forEach(enemy => {
        enemy.update();
        if (enemy.alive && 
            player.position.x < enemy.position.x + enemy.width &&
            player.position.x + player.width > enemy.position.x &&
            player.position.y < enemy.position.y + enemy.height &&
            player.position.y + player.height > enemy.position.y) {
            player.resetPosition(100);
        }
    });

    projectiles = projectiles.filter(p => p.life > 0);
    projectiles.forEach(p => {
        p.update();
        enemies.forEach(enemy => {
            if (enemy.alive &&
                p.position.x > enemy.position.x &&
                p.position.x < enemy.position.x + enemy.width &&
                p.position.y > enemy.position.y &&
                p.position.y < enemy.position.y + enemy.height) {
                enemy.alive = false;
                p.life = 0;
            }
        });
    });

    player.update();

    player.onGround = false;
    platforms.forEach(platform => {
        if (
            player.position.y + player.height >= platform.position.y &&
            player.position.y <= platform.position.y + platform.height &&
            player.position.x + player.width >= platform.position.x &&
            player.position.x <= platform.position.x + platform.width
        ) {
            if (player.velocity.y > 0 && player.position.y + player.height - player.velocity.y <= platform.position.y) {
                player.velocity.y = 0;
                player.onGround = true;
                player.jumpCount = 0;
                player.position.y = platform.position.y - player.height;
            }
        }
    });

    if (keys.up && !lastJumpKeyState) {
        if (player.onGround || player.jumpCount < player.maxJumps) {
            player.velocity.y = -player.jumpPower;
            player.jumpCount++;
            player.onGround = false;
        }
    }
    lastJumpKeyState = keys.up;

    if (keys.shoot && !lastShootKeyState) {
        const bulletX = player.facing === 'right' ? player.position.x + player.width : player.position.x;
        projectiles.push(new Projectile(bulletX, player.position.y + player.height / 2, player.facing));
    }
    lastShootKeyState = keys.shoot;

    drawCheckpointText(4850, -200);
    ctx.restore();

    stageDisplay.innerText = `STAGE 1`;
    distDisplay.innerText = `${Math.floor(player.position.x)}m`;

    if (player.position.x > 4800) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'red';
        ctx.strokeText('STAGE 1 CLEAR!!', canvas.width / 2, canvas.height / 2);
        ctx.fillText('STAGE 1 CLEAR!!', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
}

initGame(); // 初回のみ実行して背景をセット
animate();
