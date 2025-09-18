import type { LeaderboardItem, LeaderboardRange } from './types';

const BASE_URL = '/api/leaderboard';

export interface LeaderboardResponse {
  items: LeaderboardItem[];
  generatedAt: string;
}

export async function fetchLeaderboard(range: LeaderboardRange): Promise<LeaderboardResponse> {
  const response = await fetch(`${BASE_URL}?range=${range}`);
  if (!response.ok) {
    throw new Error(`排行榜加载失败: ${response.status}`);
  }
  return response.json();
}

export interface SubmitScorePayload {
  nickname: string;
  score: number;
}

export async function submitScore(payload: SubmitScorePayload): Promise<{ success: boolean; newRank?: number }> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.message ?? `提交失败: ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}
