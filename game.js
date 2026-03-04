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
let missTimer = 0;
let currentStage = 1;
let lastGoalX = -1; // 最後に通過したゴールのX座標（重複カウント防止）

const keys = { right: false, left: false, up: false, shoot: false };
window.addEventListener('keydown', (e) => {
    if (gameState !== 'PLAYING' || missTimer > 0) return;
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

window.addEventListener('mousedown', () => { if(gameState === 'PLAYING' && missTimer === 0) keys.shoot = true; });
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
        if (missTimer > 0 && missTimer % 10 < 5) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(this.position.x, this.position.y, this.width, this.height, 8);
        ctx.fill();
        ctx.fillStyle = 'white';
        const eyeX = this.facing === 'right' ? this.position.x + 25 : this.position.x + 5;
        ctx.fillRect(eyeX, this.position.y + 10, 10, 10);
    }
    update() {
        if (missTimer > 0) {
            this.draw();
            return;
        }
        this.velocity.y += gravity;
        if (keys.right) {
            this.velocity.x = this.speed;
            this.facing = 'right';
        } else if (keys.left) {
            this.velocity.x = -this.speed;
            this.facing = 'left';
        } else {
            this.velocity.x *= friction;
        }
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        
        if (this.position.y > canvas.height + 100) {
            triggerMiss();
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
let goalObjects = []; // ステージごとのゴールを管理
let scrollOffset = 0;
let lastJumpKeyState = false;
let lastShootKeyState = false;
let generatedUntilX = 0;

const STAGE_LENGTH = 6500; // 1ステージの長さ

function initGame() {
    player = new Player();
    platforms = [];
    enemies = [];
    projectiles = [];
    goalObjects = [];
    scrollOffset = 0;
    missTimer = 0;
    currentStage = 1;
    generatedUntilX = 0;
    lastGoalX = -1;

    // 最初の壁
    platforms.push(new Platform({ x: -2000, y: 100, width: 2000, height: 900, color: '#0f3460', stroke: false }));
    
    // 最初の数ステージ分を生成
    createStageSegment(0);
    createStageSegment(STAGE_LENGTH);
}

function createStageSegment(startX) {
    const stageNum = Math.floor(startX / STAGE_LENGTH) + 1;
    const speedBonus = stageNum * 0.3;

    // 1. スタート
    platforms.push(new Platform({ x: startX, y: 500, width: 600, height: 200 }));
    // 2. 段差 (低め)
    platforms.push(new Platform({ x: startX + 600, y: 400, width: 400, height: 300 }));
    // 3. 低地+穴
    platforms.push(new Platform({ x: startX + 1000, y: 550, width: 250, height: 200 }));
    platforms.push(new Platform({ x: startX + 1400, y: 550, width: 200, height: 200 }));
    // 4. 平地 + 敵
    platforms.push(new Platform({ x: startX + 1600, y: 550, width: 1500, height: 200 }));
    enemies.push(new Enemy(startX + 1800, 510, 200, 2 + speedBonus));
    enemies.push(new Enemy(startX + 2200, 510, 150, 3 + speedBonus));
    enemies.push(new Enemy(startX + 2500, 510, 200, 4 + speedBonus));
    enemies.push(new Enemy(startX + 2800, 510, 100, 5 + speedBonus));
    // 5. 階段
    platforms.push(new Platform({ x: startX + 3100, y: 400, width: 400, height: 300 }));
    platforms.push(new Platform({ x: startX + 3500, y: 250, width: 400, height: 450 }));
    platforms.push(new Platform({ x: startX + 3900, y: 100, width: 400, height: 600 }));
    // 6. 最終直線
    platforms.push(new Platform({ x: startX + 4300, y: 100, width: 1200, height: 600 }));
    platforms.push(new Platform({ x: startX + 5700, y: 100, width: 800, height: 600 }));

    // ゴール (5200m付近)
    goalObjects.push({ x: startX + 5200, y: -300, width: 100, height: 400, color: '#ff0000', stage: stageNum });

    generatedUntilX = startX + STAGE_LENGTH;
}

function triggerMiss() {
    if (missTimer > 0) return;
    missTimer = 60;
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

function drawJumpHint(x, y) {
    const time = Date.now() / 200;
    const jumpY = Math.abs(Math.sin(time)) * -30;
    ctx.save();
    ctx.fillStyle = '#e94560';
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'white';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑＊２', x, y + jumpY);
    ctx.restore();
}

function drawCheckpointText(x, y, stageNum) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText(`STAGE ${stageNum} GOAL`, x, y);
    ctx.fillText(`STAGE ${stageNum} GOAL`, x, y);
    ctx.restore();
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

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'START') return;

    // 先のステージを生成
    if (player.position.x + 3000 > generatedUntilX) {
        createStageSegment(generatedUntilX);
    }

    ctx.save();
    if (missTimer > 40) ctx.translate(Math.random() * 10 - 5, Math.random() * 10 - 5);
    
    scrollOffset = player.position.x - canvas.width / 3;
    ctx.translate(-scrollOffset, 0);

    // ヒントと矢印の描画（現在位置に近いもののみ）
    const baseOffset = Math.floor(player.position.x / STAGE_LENGTH) * STAGE_LENGTH;
    drawInGameArrow(baseOffset + 200, 400);
    drawInGameArrow(baseOffset + 1800, 450);
    drawJumpHint(baseOffset + 3050, 380);
    drawJumpHint(baseOffset + 3450, 230);
    drawJumpHint(baseOffset + 3850, 80);

    // ゴールの描画
    goalObjects.forEach(goal => {
        ctx.fillStyle = goal.color;
        ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
        drawCheckpointText(goal.x + 50, goal.y - 50, goal.stage);
    });

    platforms.forEach(platform => platform.draw());
    enemies.forEach(enemy => {
        enemy.update();
        if (enemy.alive && missTimer === 0 &&
            player.position.x < enemy.position.x + enemy.width &&
            player.position.x + player.width > enemy.position.x &&
            player.position.y < enemy.position.y + enemy.height &&
            player.position.y + player.height > enemy.position.y) {
            triggerMiss();
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

    if (missTimer === 0) {
        player.onGround = false;
        platforms.forEach(platform => {
            if (player.position.x < platform.position.x + platform.width &&
                player.position.x + player.width > platform.position.x &&
                player.position.y < platform.position.y + platform.height &&
                player.position.y + player.height > platform.position.y) {
                const prevX = player.position.x - player.velocity.x;
                const prevY = player.position.y - player.velocity.y;
                if (prevY + player.height <= platform.position.y + 5) {
                    player.velocity.y = 0;
                    player.onGround = true;
                    player.jumpCount = 0;
                    player.position.y = platform.position.y - player.height;
                } else if (player.position.y + player.height > platform.position.y + 5 && player.position.y < platform.position.y + platform.height - 5) {
                    if (prevX + player.width <= platform.position.x) {
                        player.velocity.x = 0;
                        player.position.x = platform.position.x - player.width;
                    } else if (prevX >= platform.position.x + platform.width) {
                        player.velocity.x = 0;
                        player.position.x = platform.position.x + platform.width;
                    }
                } else if (prevY >= platform.position.y + platform.height - 5) {
                    player.velocity.y = 0;
                    player.position.y = platform.position.y + platform.height;
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
    }

    ctx.restore();

    if (missTimer > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 100px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'red';
        ctx.fillText('MISS!', canvas.width / 2, canvas.height / 2);
        ctx.restore();
        missTimer--;
        if (missTimer === 0) {
            // 現在のステージの最初に戻る
            player.resetPosition(Math.floor(player.position.x / STAGE_LENGTH) * STAGE_LENGTH + 100);
        }
    }

    // ステージと距離の表示
    stageDisplay.innerText = `STAGE ${currentStage}`;
    distDisplay.innerText = `${Math.floor(player.position.x)}m`;

    // ゴール判定
    goalObjects.forEach(goal => {
        if (player.position.x < goal.x + goal.width &&
            player.position.x + player.width > goal.x &&
            player.position.y < goal.y + goal.height &&
            player.position.y + player.height > goal.y) {
            if (lastGoalX !== goal.x) {
                currentStage = goal.stage + 1;
                lastGoalX = goal.x;
            }
            // クリアメッセージ（一瞬表示される）
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.font = 'bold 72px sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeText(`STAGE ${goal.stage} CLEAR!!`, canvas.width / 2, canvas.height / 2);
            ctx.fillText(`STAGE ${goal.stage} CLEAR!!`, canvas.width / 2, canvas.height / 2);
            ctx.restore();
        }
    });
}

initGame();
animate();
