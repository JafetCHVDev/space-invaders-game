/**
 * Space Invaders Game Logic - Arcade Edition
 * Enhanced canvas rendering with responsive sizing and better graphics
 */

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SHIP_WIDTH = 50;
const SHIP_HEIGHT = 30;
const INVADER_WIDTH = 40;
const INVADER_HEIGHT = 30;
const INVADER_ROWS = 5;
const INVADER_COLS = 11;
const INVADER_PADDING = 15;
const BULLET_WIDTH = 6;
const BULLET_HEIGHT = 15;

// Colors - Arcade neon theme
const COLORS = {
    ship: "#00ff66",
    shipGlow: "rgba(0, 255, 102, 0.5)",
    bullet: "#ffff00",
    bulletGlow: "rgba(255, 255, 0, 0.5)",
    invaderTop: "#ff4466",      // Red (Squid)
    invaderMiddle: "#ff9944",   // Orange (Crab)
    invaderBottom: "#66ff66",   // Green (Octopus)
    enemyBullet: "#ff0066",
    stars: "#ffffff",
    explosion: "#ff6600",
};

// Game state interfaces
interface Ship {
    x: number;
    y: number;
}

interface Invader {
    x: number;
    y: number;
    type: "squid" | "crab" | "octopus";
    active: boolean;
    animFrame: number;
}

interface Bullet {
    x: number;
    y: number;
    active: boolean;
    isPlayer: boolean;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
}

interface GameState {
    ship: Ship;
    invaders: Invader[];
    bullets: Bullet[];
    particles: Particle[];
    score: number;
    lives: number;
    gameOver: boolean;
    won: boolean;
    invaderDirection: number;
    tick: number;
    stars: { x: number; y: number; speed: number }[];
}

export class SpaceInvadersGame {
    private ctx: CanvasRenderingContext2D;
    private state: GameState;
    private animationId: number | null = null;
    private lastTime: number = 0;
    private tickInterval: number = 40; // Faster game loop
    private keys: Set<string> = new Set();

    // Callbacks
    public onScoreChange?: (score: number) => void;
    public onLivesChange?: (lives: number) => void;
    public onGameOver?: (score: number, won: boolean) => void;

    constructor(canvasId: string) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) throw new Error(`Canvas #${canvasId} not found`);

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2D context");

        this.ctx = ctx;
        this.state = this.createInitialState();

        this.bindControls();
    }

    private createInitialState(): GameState {
        const invaders: Invader[] = [];

        // Create invader grid
        const startX = (CANVAS_WIDTH - (INVADER_COLS * (INVADER_WIDTH + INVADER_PADDING))) / 2;

        for (let row = 0; row < INVADER_ROWS; row++) {
            const type: "squid" | "crab" | "octopus" =
                row === 0 ? "squid" : row < 3 ? "crab" : "octopus";

            for (let col = 0; col < INVADER_COLS; col++) {
                invaders.push({
                    x: startX + col * (INVADER_WIDTH + INVADER_PADDING),
                    y: 60 + row * (INVADER_HEIGHT + INVADER_PADDING),
                    type,
                    active: true,
                    animFrame: 0,
                });
            }
        }

        // Create starfield
        const stars = [];
        for (let i = 0; i < 100; i++) {
            stars.push({
                x: Math.random() * CANVAS_WIDTH,
                y: Math.random() * CANVAS_HEIGHT,
                speed: 0.2 + Math.random() * 0.5,
            });
        }

        return {
            ship: {
                x: CANVAS_WIDTH / 2 - SHIP_WIDTH / 2,
                y: CANVAS_HEIGHT - SHIP_HEIGHT - 20,
            },
            invaders,
            bullets: [],
            particles: [],
            score: 0,
            lives: 3,
            gameOver: false,
            won: false,
            invaderDirection: 1,
            tick: 0,
            stars,
        };
    }

    private bindControls() {
        document.addEventListener("keydown", (e) => {
            this.keys.add(e.key);

            if (e.key === " ") {
                e.preventDefault();
                if (!this.state.gameOver) this.shoot();
            }

            if (e.key === "f" || e.key === "F") {
                this.toggleFullscreen();
            }
        });

        document.addEventListener("keyup", (e) => {
            this.keys.delete(e.key);
        });
    }

    private processInput() {
        if (this.state.gameOver) return;

        const speed = 8;

        if (this.keys.has("ArrowLeft") || this.keys.has("a") || this.keys.has("A")) {
            this.state.ship.x = Math.max(0, this.state.ship.x - speed);
        }
        if (this.keys.has("ArrowRight") || this.keys.has("d") || this.keys.has("D")) {
            this.state.ship.x = Math.min(CANVAS_WIDTH - SHIP_WIDTH, this.state.ship.x + speed);
        }
    }

    private shoot() {
        const playerBullets = this.state.bullets.filter(b => b.isPlayer && b.active);
        if (playerBullets.length >= 3) return;

        this.state.bullets.push({
            x: this.state.ship.x + SHIP_WIDTH / 2 - BULLET_WIDTH / 2,
            y: this.state.ship.y - BULLET_HEIGHT,
            active: true,
            isPlayer: true,
        });
    }

    private toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    public start() {
        this.state = this.createInitialState();
        this.lastTime = performance.now();
        this.notifyStateChange();
        this.gameLoop();
    }

    public stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    private gameLoop = () => {
        const now = performance.now();
        const delta = now - this.lastTime;

        this.processInput();

        if (delta >= this.tickInterval) {
            this.update();
            this.lastTime = now;
        }

        this.render();

        if (!this.state.gameOver) {
            this.animationId = requestAnimationFrame(this.gameLoop);
        }
    };

    private update() {
        if (this.state.gameOver) return;

        this.state.tick++;

        // Update stars
        this.state.stars.forEach(star => {
            star.y += star.speed;
            if (star.y > CANVAS_HEIGHT) {
                star.y = 0;
                star.x = Math.random() * CANVAS_WIDTH;
            }
        });

        // Update particles
        this.state.particles = this.state.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            return p.life > 0;
        });

        // Move bullets
        this.state.bullets.forEach(bullet => {
            if (!bullet.active) return;
            bullet.y += bullet.isPlayer ? -12 : 6;

            if (bullet.y < 0 || bullet.y > CANVAS_HEIGHT) {
                bullet.active = false;
            }
        });

        // Check collisions
        this.checkCollisions();

        // Move invaders
        if (this.state.tick % 25 === 0) {
            this.moveInvaders();
        }

        // Invader animation
        if (this.state.tick % 15 === 0) {
            this.state.invaders.forEach(inv => {
                if (inv.active) inv.animFrame = (inv.animFrame + 1) % 2;
            });
        }

        // Enemy shooting
        if (this.state.tick % 50 === 0) {
            this.enemyShoot();
        }

        // Check win condition
        const activeInvaders = this.state.invaders.filter(i => i.active);
        if (activeInvaders.length === 0) {
            this.state.gameOver = true;
            this.state.won = true;
            this.onGameOver?.(this.state.score, true);
        }

        // Clean up
        this.state.bullets = this.state.bullets.filter(b => b.active);
    }

    private checkCollisions() {
        // Player bullets vs invaders
        this.state.bullets.forEach(bullet => {
            if (!bullet.active || !bullet.isPlayer) return;

            this.state.invaders.forEach(invader => {
                if (!invader.active) return;

                if (this.checkHit(
                    bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
                    invader.x, invader.y, INVADER_WIDTH, INVADER_HEIGHT
                )) {
                    bullet.active = false;
                    invader.active = false;

                    // Score based on type
                    const points = invader.type === "squid" ? 30 : invader.type === "crab" ? 20 : 10;
                    this.state.score += points;
                    this.onScoreChange?.(this.state.score);

                    // Explosion particles
                    this.createExplosion(invader.x + INVADER_WIDTH / 2, invader.y + INVADER_HEIGHT / 2);
                }
            });
        });

        // Enemy bullets vs player
        this.state.bullets.forEach(bullet => {
            if (!bullet.active || bullet.isPlayer) return;

            if (this.checkHit(
                bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT,
                this.state.ship.x, this.state.ship.y, SHIP_WIDTH, SHIP_HEIGHT
            )) {
                bullet.active = false;
                this.state.lives--;
                this.onLivesChange?.(this.state.lives);

                this.createExplosion(this.state.ship.x + SHIP_WIDTH / 2, this.state.ship.y);

                if (this.state.lives <= 0) {
                    this.state.gameOver = true;
                    this.onGameOver?.(this.state.score, false);
                }
            }
        });
    }

    private checkHit(x1: number, y1: number, w1: number, h1: number, x2: number, y2: number, w2: number, h2: number): boolean {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    private moveInvaders() {
        let shouldDescend = false;

        this.state.invaders.forEach(invader => {
            if (!invader.active) return;
            const newX = invader.x + this.state.invaderDirection * 15;
            if (newX <= 0 || newX >= CANVAS_WIDTH - INVADER_WIDTH) {
                shouldDescend = true;
            }
        });

        this.state.invaders.forEach(invader => {
            if (!invader.active) return;
            if (shouldDescend) {
                invader.y += 25;
            } else {
                invader.x += this.state.invaderDirection * 15;
            }

            if (invader.y >= this.state.ship.y - 30) {
                this.state.gameOver = true;
                this.onGameOver?.(this.state.score, false);
            }
        });

        if (shouldDescend) {
            this.state.invaderDirection *= -1;
        }
    }

    private enemyShoot() {
        const activeInvaders = this.state.invaders.filter(i => i.active);
        if (activeInvaders.length === 0) return;

        const shooter = activeInvaders[Math.floor(Math.random() * activeInvaders.length)];
        this.state.bullets.push({
            x: shooter.x + INVADER_WIDTH / 2 - BULLET_WIDTH / 2,
            y: shooter.y + INVADER_HEIGHT,
            active: true,
            isPlayer: false,
        });
    }

    private createExplosion(x: number, y: number) {
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            const speed = 2 + Math.random() * 3;
            this.state.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 25 + Math.random() * 15,
                color: COLORS.explosion,
            });
        }
    }

    private notifyStateChange() {
        this.onScoreChange?.(this.state.score);
        this.onLivesChange?.(this.state.lives);
    }

    private render() {
        const { ctx, state } = this;

        // Clear
        ctx.fillStyle = "#000010";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Stars
        state.stars.forEach(star => {
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + star.speed})`;
            ctx.fillRect(star.x, star.y, 2, 2);
        });

        // Particles
        state.particles.forEach(p => {
            const alpha = p.life / 40;
            ctx.fillStyle = p.color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
            ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
        });

        // Ship
        this.drawShip(state.ship.x, state.ship.y);

        // Invaders
        state.invaders.forEach(invader => {
            if (invader.active) {
                this.drawInvader(invader);
            }
        });

        // Bullets
        state.bullets.forEach(bullet => {
            if (!bullet.active) return;

            if (bullet.isPlayer) {
                ctx.shadowColor = COLORS.bulletGlow;
                ctx.shadowBlur = 10;
                ctx.fillStyle = COLORS.bullet;
            } else {
                ctx.shadowColor = "rgba(255, 0, 102, 0.5)";
                ctx.shadowBlur = 10;
                ctx.fillStyle = COLORS.enemyBullet;
            }

            ctx.fillRect(bullet.x, bullet.y, BULLET_WIDTH, BULLET_HEIGHT);
            ctx.shadowBlur = 0;
        });

        // Game over overlay
        if (state.gameOver) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            ctx.textAlign = "center";
            ctx.shadowColor = state.won ? COLORS.ship : "#ff0066";
            ctx.shadowBlur = 20;

            ctx.font = "bold 48px 'Press Start 2P', monospace";
            ctx.fillStyle = state.won ? COLORS.ship : "#ff0066";
            ctx.fillText(state.won ? "YOU WIN!" : "GAME OVER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 30);

            ctx.font = "24px 'Press Start 2P', monospace";
            ctx.fillStyle = "#ffffff";
            ctx.shadowBlur = 0;
            ctx.fillText(`SCORE: ${state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
        }
    }

    private drawShip(x: number, y: number) {
        const { ctx } = this;

        ctx.shadowColor = COLORS.shipGlow;
        ctx.shadowBlur = 15;
        ctx.fillStyle = COLORS.ship;

        // Ship body
        ctx.beginPath();
        ctx.moveTo(x + SHIP_WIDTH / 2, y);
        ctx.lineTo(x + SHIP_WIDTH, y + SHIP_HEIGHT);
        ctx.lineTo(x + SHIP_WIDTH * 0.8, y + SHIP_HEIGHT);
        ctx.lineTo(x + SHIP_WIDTH / 2, y + SHIP_HEIGHT * 0.6);
        ctx.lineTo(x + SHIP_WIDTH * 0.2, y + SHIP_HEIGHT);
        ctx.lineTo(x, y + SHIP_HEIGHT);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    private drawInvader(invader: Invader) {
        const { ctx } = this;
        const { x, y, type, animFrame } = invader;

        const color = type === "squid" ? COLORS.invaderTop :
            type === "crab" ? COLORS.invaderMiddle :
                COLORS.invaderBottom;

        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        // Simple pixel art style
        const size = 4;
        const pattern = this.getInvaderPattern(type, animFrame);

        pattern.forEach((row, ry) => {
            row.forEach((cell, cx) => {
                if (cell) {
                    ctx.fillRect(x + cx * size, y + ry * size, size, size);
                }
            });
        });

        ctx.shadowBlur = 0;
    }

    private getInvaderPattern(type: string, frame: number): number[][] {
        // Simplified invader patterns
        if (type === "squid") {
            return frame === 0 ? [
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 0, 1, 1, 0, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 0, 1, 0, 0, 1, 0, 0],
                [0, 1, 0, 0, 0, 0, 1, 0],
            ] : [
                [0, 0, 0, 1, 1, 0, 0, 0],
                [0, 0, 1, 1, 1, 1, 0, 0],
                [0, 1, 1, 1, 1, 1, 1, 0],
                [1, 1, 0, 1, 1, 0, 1, 1],
                [1, 1, 1, 1, 1, 1, 1, 1],
                [0, 1, 0, 0, 0, 0, 1, 0],
                [1, 0, 0, 0, 0, 0, 0, 1],
            ];
        }
        return frame === 0 ? [
            [0, 1, 0, 0, 0, 0, 1, 0],
            [0, 0, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 1, 0, 1, 1, 0, 1, 0],
        ] : [
            [0, 1, 0, 0, 0, 0, 1, 0],
            [1, 0, 1, 1, 1, 1, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [1, 1, 0, 1, 1, 0, 1, 1],
            [1, 1, 1, 1, 1, 1, 1, 1],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0, 0, 1, 0],
        ];
    }

    public getScore(): number {
        return this.state.score;
    }

    public isGameOver(): boolean {
        return this.state.gameOver;
    }

    public didWin(): boolean {
        return this.state.won;
    }
}
