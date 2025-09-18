import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const projectRoot = path.resolve(process.cwd());

export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  leaderboardLimit: Number(process.env.LEADERBOARD_LIMIT ?? 20),
  sqlitePath: path.resolve(projectRoot, process.env.SQLITE_PATH ?? 'data/leaderboard.sqlite'),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 8)
} as const;
