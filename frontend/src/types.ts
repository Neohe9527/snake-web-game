export type GameState = 'idle' | 'running' | 'gameover';

export interface Position {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GameConfig {
  gridSize: number;
  baseSpeed: number;
  hasObstacles: boolean;
}

export interface SnakeSegment extends Position {}

export interface Settings {
  speed: 'slow' | 'normal' | 'fast';
  obstacles: boolean;
  sound: boolean;
}

export interface LeaderboardItem {
  id: number;
  nickname: string;
  score: number;
  createdAt: string;
}

export type LeaderboardRange = 'all' | 'weekly';
