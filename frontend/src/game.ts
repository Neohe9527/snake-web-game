import { AudioManager } from './audio';
import type {
  Direction,
  GameConfig,
  GameState,
  Position,
  SnakeSegment
} from './types';

interface GameCallbacks {
  onScoreChange(score: number): void;
  onGameOver(score: number): void;
  onMaxScore(score: number): void;
}

const directionVectors: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

export class SnakeGame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private config: GameConfig;
  private callbacks: GameCallbacks;
  private state: GameState = 'idle';
  private snake: SnakeSegment[] = [];
  private direction: Direction = 'right';
  private nextDirection: Direction = 'right';
  private food: Position = { x: 0, y: 0 };
  private obstacles: Position[] = [];
  private score = 0;
  private maxScore = 0;
  private lastTimestamp = 0;
  private accumulator = 0;
  private animationId?: number;
  private speedMultiplier = 1;
  private audio: AudioManager;

  constructor(
    canvas: HTMLCanvasElement,
    initialConfig: GameConfig,
    callbacks: GameCallbacks,
    audio: AudioManager,
    initialMaxScore: number
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.config = { ...initialConfig };
    this.callbacks = callbacks;
    this.audio = audio;
    this.maxScore = initialMaxScore;

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.drawInitialScene();
  }

  getState(): GameState {
    return this.state;
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  setObstacles(enabled: boolean) {
    this.config.hasObstacles = enabled;
  }

  setAudioEnabled(enabled: boolean) {
    this.audio.setEnabled(enabled);
  }

  start() {
    this.reset();
    this.state = 'running';
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.tick(this.lastTimestamp);
  }

  pause() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.state = 'idle';
  }

  restart() {
    this.start();
  }

  updateMaxScore(score: number) {
    if (score > this.maxScore) {
      this.maxScore = score;
      this.callbacks.onMaxScore(this.maxScore);
    }
  }

  handleInput(direction: Direction) {
    if (this.state !== 'running') return;
    if (direction === this.nextDirection) return;
    if (direction === oppositeDirection(this.direction)) return;

    this.nextDirection = direction;
  }

  private resizeCanvas() {
    const size = Math.min(window.innerWidth - 120, 640);
    const canvasSize = Math.max(400, size);
    this.canvas.width = canvasSize;
    this.canvas.height = canvasSize;
    this.canvas.style.width = `${canvasSize}px`;
    this.canvas.style.height = `${canvasSize}px`;
    this.draw();
  }

  private reset() {
    this.snake = [
      { x: Math.floor(this.config.gridSize / 2), y: Math.floor(this.config.gridSize / 2) },
      { x: Math.floor(this.config.gridSize / 2) - 1, y: Math.floor(this.config.gridSize / 2) },
      { x: Math.floor(this.config.gridSize / 2) - 2, y: Math.floor(this.config.gridSize / 2) }
    ];
    this.direction = 'right';
    this.nextDirection = 'right';
    this.score = 0;
    this.callbacks.onScoreChange(this.score);
    this.obstacles = this.config.hasObstacles ? this.generateObstacles() : [];
    this.food = this.generateFood();
  }

  private tick(timestamp: number) {
    if (this.state !== 'running') return;

    const delta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.accumulator += delta;

    const stepInterval = 1000 / (this.config.baseSpeed * this.speedMultiplier);

    while (this.accumulator >= stepInterval) {
      this.update();
      this.accumulator -= stepInterval;
    }

    this.draw();
    this.animationId = requestAnimationFrame((t) => this.tick(t));
  }

  private update() {
    this.direction = this.nextDirection;
    const vector = directionVectors[this.direction];
    const head = this.snake[0];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };

    if (this.isCollision(nextHead)) {
      this.endGame();
      return;
    }

    this.snake.unshift(nextHead);

    if (nextHead.x === this.food.x && nextHead.y === this.food.y) {
      this.score += 10;
      this.callbacks.onScoreChange(this.score);
      this.updateMaxScore(this.score);
      this.food = this.generateFood();
      this.audio.playEat();
    } else {
      this.snake.pop();
    }
  }

  private endGame() {
    this.state = 'gameover';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    this.audio.playCrash();
    this.callbacks.onGameOver(this.score);
  }

  private isCollision(position: Position): boolean {
    const outOfBounds =
      position.x < 0 ||
      position.y < 0 ||
      position.x >= this.config.gridSize ||
      position.y >= this.config.gridSize;
    if (outOfBounds) {
      return true;
    }

    const hitsSelf = this.snake.some((segment) => segment.x === position.x && segment.y === position.y);
    if (hitsSelf) {
      return true;
    }

    if (!this.config.hasObstacles) {
      return false;
    }

    return this.obstacles.some((obstacle) => obstacle.x === position.x && obstacle.y === position.y);
  }

  private generateFood(): Position {
    const occupied = new Set<string>();
    this.snake.forEach((seg) => occupied.add(`${seg.x}:${seg.y}`));
    this.obstacles.forEach((obs) => occupied.add(`${obs.x}:${obs.y}`));

    const available: Position[] = [];
    for (let x = 0; x < this.config.gridSize; x += 1) {
      for (let y = 0; y < this.config.gridSize; y += 1) {
        if (!occupied.has(`${x}:${y}`)) {
          available.push({ x, y });
        }
      }
    }

    if (available.length === 0) {
      return { x: 0, y: 0 };
    }

    return available[Math.floor(Math.random() * available.length)];
  }

  private generateObstacles(): Position[] {
    const count = Math.floor(this.config.gridSize * 0.6);
    const obstacles: Position[] = [];
    while (obstacles.length < count) {
      const candidate = {
        x: Math.floor(Math.random() * this.config.gridSize),
        y: Math.floor(Math.random() * this.config.gridSize)
      };

      const isOnSnake = this.snake.some((seg) => seg.x === candidate.x && seg.y === candidate.y);
      const isUnique = !obstacles.some((obs) => obs.x === candidate.x && obs.y === candidate.y);

      if (isOnSnake || !isUnique) continue;
      obstacles.push(candidate);
    }
    return obstacles;
  }

  private draw() {
    const { width, height } = this.canvas;
    const cellSize = width / this.config.gridSize;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#111720';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(46, 160, 67, 0.08)';
    for (let i = 0; i <= this.config.gridSize; i += 1) {
      const pos = i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(width, pos);
      ctx.stroke();
    }

    if (this.config.hasObstacles) {
      ctx.fillStyle = 'rgba(148, 29, 64, 0.9)';
      this.obstacles.forEach((obs) => {
        drawRoundedRect(ctx, obs.x * cellSize + 4, obs.y * cellSize + 4, cellSize - 8, cellSize - 8, 6);
      });
    }

    ctx.fillStyle = '#ff7b89';
    drawRoundedRect(ctx, this.food.x * cellSize + 4, this.food.y * cellSize + 4, cellSize - 8, cellSize - 8, 6);

    this.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#2ea043' : '#3fb950';
      drawRoundedRect(ctx, segment.x * cellSize + 2, segment.y * cellSize + 2, cellSize - 4, cellSize - 4, 8);
    });
  }

  private drawInitialScene() {
    this.draw();
  }
}
