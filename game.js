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
        if (this.position.y > canvas.height + 100) {
            const section = Math.floor(this.position.x / 2500);
            this.resetPosition(section * 2500 + 100);
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
let generatedUntilX = 0;
let generatedBehindX = 0;

function initGame() {
    player = new Player();
    platforms = [];
    enemies = [];
    projectiles = [];
    scrollOffset = 0;
    generatedUntilX = 0;
    generatedBehindX = 0;

    // --- ステージ1の構造改良 ---
    // スタート地点の床 (x=0から右へ)
    platforms.push(new Platform({ x: 0, y: 500, width: 800, height: 100, stroke: false }));
    
    // 左端の巨大な厚壁 (厚さ200px)
    platforms.push(new Platform({ x: -200, y: 0, width: 200, height: 600, color: '#0f3460' }));
    
    // 壁の向こう側の床 (壁の左端 x=-200 に接続)
    platforms.push(new Platform({ x: -1500, y: 500, width: 1300, height: 100, stroke: false }));
    
    // 隠しゴール (赤い巨大な塔)
    platforms.push(new Platform({ x: -1400, y: 100, width: 300, height: 600, color: '#ff0000' }));
    
    generatedUntilX = 800; // 次のステージ生成の開始点
}

function createNextStage(forward = true) {
    const startX = forward ? generatedUntilX : generatedBehindX - 2500;
    const stageWidth = 2500;
    const stageNum = Math.floor(startX / 2500) + 1;
    
    // 通常のステージ生成
    platforms.push(new Platform({ x: startX, y: 500, width: 800, height: 100 }));
    platforms.push(new Platform({ x: startX + 900, y: 450, width: 400, height: 40 }));
    platforms.push(new Platform({ x: startX + 1400, y: 350, width: 400, height: 40 }));
    platforms.push(new Platform({ x: startX + 1900, y: 450, width: 500, height: 40 }));
    
    if (startX >= 0) {
        platforms.push(new Platform({ x: startX + 2400, y: 200, width: 100, height: 600, color: '#ff0000' }));
    }

    const speedBonus = Math.abs(stageNum) * 0.2;
    enemies.push(new Enemy(startX + 400, 460, 200, 2 + speedBonus));
    enemies.push(new Enemy(startX + 1500, 310, 200, 3 + speedBonus));

    if (forward) generatedUntilX += stageWidth;
    else generatedBehindX -= stageWidth;
}

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
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('GO THIS WAY', x + offset, y + 40);
    ctx.restore();
}

function drawCheckpointText(x, y, stageNum) {
    const time = Date.now() / 300;
    const floatY = Math.sin(time) * 15;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(`STAGE ${stageNum} CLEAR!`, x, y + floatY);
    ctx.fillText(`STAGE ${stageNum} CLEAR!`, x, y + floatY);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('KEEP GOING →', x, y + floatY + 40);
    ctx.restore();
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'START') return;

    if (player.position.x + 1500 > generatedUntilX) createNextStage(true);
    if (player.position.x - 1500 < generatedBehindX) createNextStage(false);

    ctx.save();
    scrollOffset = player.position.x - canvas.width / 3;
    ctx.translate(-scrollOffset, 0);

    for (let x = 0; x < generatedUntilX; x += 2500) {
        drawInGameArrow(x + 400, 400);
    }

    for (let x = 0; x < generatedUntilX; x += 2500) {
        if (x === 0 && player.position.x < 1000) continue;
        const stageNum = Math.floor(x / 2500);
        if (stageNum > 0) {
            drawCheckpointText(x - 50, 150, stageNum);
        }
    }

    platforms.forEach(platform => platform.draw());
    enemies.forEach(enemy => {
        enemy.update();
        if (enemy.alive && 
            player.position.x < enemy.position.x + enemy.width &&
            player.position.x + player.width > enemy.position.x &&
            player.position.y < enemy.position.y + enemy.height &&
            player.position.y + player.height > enemy.position.y) {
            player.resetPosition(Math.floor(player.position.x / 2500) * 2500 + 100);
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

    ctx.restore();

    let currentStageNum;
    if (player.position.x < -100) {
        currentStageNum = 1000;
    } else {
        currentStageNum = Math.floor(player.position.x / 2500) + 1;
    }
    
    stageDisplay.innerText = `STAGE ${currentStageNum}`;
    distDisplay.innerText = `${Math.floor(Math.abs(player.position.x))}m`;

    if (currentStageNum >= 1000 && player.position.y < 300) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'red';
        ctx.strokeText('SECRET GOAL!!', canvas.width / 2, canvas.height / 2);
        ctx.fillText('SECRET GOAL!!', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px sans-serif';
        ctx.fillText('あなたは世界の裏側に辿り着いた...', canvas.width / 2, canvas.height / 2 + 60);
        ctx.restore();
    }
}

animate();
