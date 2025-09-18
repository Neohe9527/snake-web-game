import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { config } from './config.js';
import { closeDb } from './database.js';
import {
  getRankForScore,
  getTopScores,
  getWeeklyTopScores,
  insertScore,
  migrate
} from './leaderboard-repository.js';

const app = express();

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/api/leaderboard', limiter);

const submitSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, '昵称不能为空')
    .max(16, '昵称不能超过16个字符')
    .regex(/^[-_a-zA-Z0-9\u4e00-\u9fa5]+$/, '昵称仅支持中英文、数字、-、_'),
  score: z
    .number({ invalid_type_error: '分数格式不正确' })
    .int('分数必须为整数')
    .positive('至少取得1分才能提交')
    .max(999_999, '分数超出范围')
});

const rangeSchema = z
  .enum(['all', 'weekly'])
  .catch('all');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const range = rangeSchema.parse(req.query.range);
    const limit = config.leaderboardLimit;
    const items = range === 'weekly' ? await getWeeklyTopScores(limit) : await getTopScores(limit);
    res.json({
      items,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ errorCode: 'INTERNAL_ERROR', message: '获取排行榜失败' });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  try {
    const incomingScore = req.body?.score;
    const normalizedScore = typeof incomingScore === 'number' ? incomingScore : Number(incomingScore);

    const parseResult = submitSchema.safeParse({
      nickname: req.body?.nickname,
      score: normalizedScore
    });

    if (!parseResult.success) {
      return res.status(400).json({
        errorCode: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0]?.message ?? '提交数据校验失败'
      });
    }

    const data = parseResult.data;
    const normalizedNickname = sanitizeNickname(data.nickname);

    const id = await insertScore({ nickname: normalizedNickname, score: data.score });
    const rank = await getRankForScore(data.score);

    res.status(201).json({ success: true, id, newRank: rank });
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({ errorCode: 'INTERNAL_ERROR', message: '提交分数失败' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ errorCode: 'NOT_FOUND', message: '接口不存在' });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error', error);
  res.status(500).json({ errorCode: 'INTERNAL_ERROR', message: '服务器开小差了，请稍后重试' });
});

function sanitizeNickname(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function start() {
  migrate();
  const server = app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port}`);
  });

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`${signal} received, shutting down...`);
      server.close(() => {
        closeDb();
        process.exit(0);
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { app, start };
