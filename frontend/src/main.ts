import { SnakeGame } from './game';
import { AudioManager } from './audio';
import { fetchLeaderboard, submitScore } from './leaderboard';
import { defaultSettings, loadMaxScore, loadSettings, saveMaxScore, saveSettings } from './storage';
import type { LeaderboardItem, LeaderboardRange, Settings } from './types';

const speedMultiplierMap: Record<Settings['speed'], number> = {
  slow: 0.8,
  normal: 1,
  fast: 1.25
};

type LeaderboardState = {
  range: LeaderboardRange;
  items: LeaderboardItem[];
  generatedAt?: string;
  loading: boolean;
  error?: string;
};

class UIController {
  private app: HTMLElement;
  private canvas: HTMLCanvasElement;
  private startButton: HTMLButtonElement;
  private scoreValue: HTMLElement;
  private maxScoreValue: HTMLElement;
  private messageBox: HTMLDivElement;
  private toast: HTMLDivElement;
  private nicknameInput: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private leaderboardList: HTMLUListElement;
  private leaderboardInfo: HTMLDivElement;
  private leaderboardToggleAll: HTMLDivElement;
  private leaderboardToggleWeekly: HTMLDivElement;
  private leaderboardError: HTMLDivElement;
  private settingsSpeed: HTMLSelectElement;
  private settingsObstacles: HTMLInputElement;
  private settingsSound: HTMLInputElement;
  private leaderboardState: LeaderboardState = {
    range: 'all',
    items: [],
    loading: false
  };
  private settings: Settings;
  private game: SnakeGame;
  private audio: AudioManager;
  private pendingScore: number | null = null;

  constructor() {
    this.app = document.querySelector('#app') as HTMLElement;
    this.settings = loadSettings();
    const layout = this.createLayout();
    this.app.appendChild(layout);

    this.canvas = layout.querySelector('#gameCanvas') as HTMLCanvasElement;
    this.startButton = layout.querySelector('#startButton') as HTMLButtonElement;
    this.scoreValue = layout.querySelector('#scoreValue') as HTMLElement;
    this.maxScoreValue = layout.querySelector('#maxScoreValue') as HTMLElement;
    this.messageBox = layout.querySelector('#gameMessage') as HTMLDivElement;
    this.toast = layout.querySelector('#toast') as HTMLDivElement;
    this.nicknameInput = layout.querySelector('#nicknameInput') as HTMLInputElement;
    this.submitButton = layout.querySelector('#submitScoreButton') as HTMLButtonElement;
    this.leaderboardList = layout.querySelector('#leaderboardList') as HTMLUListElement;
    this.leaderboardInfo = layout.querySelector('#leaderboardInfo') as HTMLDivElement;
    this.leaderboardToggleAll = layout.querySelector('#toggleAll') as HTMLDivElement;
    this.leaderboardToggleWeekly = layout.querySelector('#toggleWeekly') as HTMLDivElement;
    this.leaderboardError = layout.querySelector('#leaderboardError') as HTMLDivElement;
    this.settingsSpeed = layout.querySelector('#settingSpeed') as HTMLSelectElement;
    this.settingsObstacles = layout.querySelector('#settingObstacles') as HTMLInputElement;
    this.settingsSound = layout.querySelector('#settingSound') as HTMLInputElement;

    this.applySettingsToUI();

    this.audio = new AudioManager(this.settings.sound);
    this.game = new SnakeGame(
      this.canvas,
      { gridSize: 32, baseSpeed: 6, hasObstacles: this.settings.obstacles },
      {
        onScoreChange: (score) => this.updateScore(score),
        onGameOver: (score) => this.handleGameOver(score),
        onMaxScore: (max) => this.updateMaxScore(max)
      },
      this.audio,
      loadMaxScore()
    );

    this.game.setSpeedMultiplier(speedMultiplierMap[this.settings.speed]);

    this.bindEvents();
    this.updateScore(0);
    this.updateMaxScore(loadMaxScore());
    this.updateGameMessage('按下“开始游戏”或空格键开始');
    this.loadLeaderboard('all');
  }

  private createLayout(): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = `
      <div class="canvas-pane">
        <canvas id="gameCanvas" width="640" height="640"></canvas>
        <div class="message info" id="gameMessage"></div>
      </div>
      <div class="panel">
        <h1>Snake</h1>
        <div class="stat-block">
          <div class="stat">
            当前得分
            <div id="scoreValue">0</div>
          </div>
          <div class="stat">
            最高分
            <div id="maxScoreValue">0</div>
          </div>
        </div>
        <button id="startButton">开始游戏</button>
        <div class="settings-section">
          <h2>设置</h2>
          <div class="settings-grid">
            <label>
              速度
              <select id="settingSpeed">
                <option value="slow">慢速</option>
                <option value="normal">标准</option>
                <option value="fast">极速</option>
              </select>
            </label>
            <label>
              音效
              <select id="settingSound">
                <option value="true">开启</option>
                <option value="false">关闭</option>
              </select>
            </label>
          </div>
          <label class="checkbox-row">
            <input type="checkbox" id="settingObstacles" />
            随机障碍
          </label>
        </div>
        <div class="leaderboard-section">
          <h2>排行榜</h2>
          <div class="tabs">
            <div class="tab active" data-range="all" id="toggleAll">总排行</div>
            <div class="tab" data-range="weekly" id="toggleWeekly">近7天</div>
          </div>
          <div class="message info" id="leaderboardInfo"></div>
          <div class="message error" id="leaderboardError" hidden></div>
          <ul class="leaderboard-list" id="leaderboardList"></ul>
          <form id="scoreForm" class="score-form">
            <label>
              昵称（1-16字符）
              <input type="text" id="nicknameInput" maxlength="16" placeholder="输入昵称" required />
            </label>
            <button type="submit" id="submitScoreButton" disabled>提交本局得分</button>
          </form>
        </div>
        <div class="controls-section">
          <h2>操作指南</h2>
          <div class="message info">
            方向键或 WASD 控制方向，空格快速重开。
          </div>
        </div>
      </div>
      <div class="toast" id="toast"></div>
    `;

    const wrapper = document.createElement('div');
    wrapper.className = 'app-wrapper';
    wrapper.appendChild(container);
    return wrapper;
  }

  private bindEvents() {
    this.startButton.addEventListener('click', () => {
      if (this.game.getState() === 'running') {
        this.game.restart();
      } else {
        this.game.start();
      }
      this.updateStartButton();
      this.updateGameMessage('');
      this.pendingScore = null;
      this.submitButton.disabled = true;
    });

    document.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.game.handleInput('up');
          event.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.game.handleInput('down');
          event.preventDefault();
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.game.handleInput('left');
          event.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.game.handleInput('right');
          event.preventDefault();
          break;
        case ' ': {
          if (this.game.getState() === 'running') return;
          this.game.start();
          this.updateStartButton();
          this.updateGameMessage('');
          event.preventDefault();
          break;
        }
        default:
          break;
      }
    });

    this.settingsSpeed.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value as Settings['speed'];
      this.settings.speed = value;
      saveSettings(this.settings);
      this.game.setSpeedMultiplier(speedMultiplierMap[value]);
      this.showToast(`速度已切换为${this.settingsSpeed.selectedOptions[0].textContent ?? ''}`);
    });

    this.settingsSound.addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value === 'true';
      this.settings.sound = value;
      saveSettings(this.settings);
      this.audio.setEnabled(value);
      this.showToast(value ? '音效已开启' : '音效已关闭');
    });

    this.settingsObstacles.addEventListener('change', (event) => {
      const checked = (event.target as HTMLInputElement).checked;
      this.settings.obstacles = checked;
      saveSettings(this.settings);
      this.game.setObstacles(checked);
      this.showToast(checked ? '随机障碍已开启' : '随机障碍已关闭');
    });

    this.leaderboardToggleAll.addEventListener('click', () => this.changeLeaderboardRange('all'));
    this.leaderboardToggleWeekly.addEventListener('click', () => this.changeLeaderboardRange('weekly'));

    const scoreForm = document.querySelector('#scoreForm') as HTMLFormElement;
    scoreForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (this.pendingScore === null) return;

      const nickname = this.nicknameInput.value.trim();
      if (!nickname || !/^[-_a-zA-Z0-9\u4e00-\u9fa5]{1,16}$/.test(nickname)) {
        this.showToast('昵称需为1-16位中英文、数字或_-');
        return;
      }

      this.submitScore(nickname, this.pendingScore);
    });
  }

  private applySettingsToUI() {
    const settings = { ...defaultSettings, ...this.settings };
    this.settings = settings;
    this.settingsSpeed.value = settings.speed;
    this.settingsObstacles.checked = settings.obstacles;
    this.settingsSound.value = settings.sound ? 'true' : 'false';
  }

  private updateStartButton() {
    const state = this.game.getState();
    if (state === 'running') {
      this.startButton.textContent = '重新开始';
    } else {
      this.startButton.textContent = '开始游戏';
    }
  }

  private updateScore(score: number) {
    this.scoreValue.textContent = String(score);
  }

  private updateMaxScore(maxScore: number) {
    this.maxScoreValue.textContent = String(maxScore);
    saveMaxScore(maxScore);
  }

  private updateGameMessage(message: string, kind: 'info' | 'error' = 'info') {
    if (!message) {
      this.messageBox.textContent = '';
      this.messageBox.style.visibility = 'hidden';
      return;
    }
    this.messageBox.textContent = message;
    this.messageBox.classList.remove('error', 'info');
    this.messageBox.classList.add(kind);
    this.messageBox.style.visibility = 'visible';
  }

  private async loadLeaderboard(range: LeaderboardRange) {
    this.leaderboardState = {
      ...this.leaderboardState,
      range,
      loading: true,
      error: undefined
    };
    this.renderLeaderboard();
    try {
      const response = await fetchLeaderboard(range);
      this.leaderboardState = {
        ...this.leaderboardState,
        items: response.items,
        generatedAt: response.generatedAt,
        loading: false,
        error: undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '排行榜加载失败';
      this.leaderboardState = {
        ...this.leaderboardState,
        loading: false,
        error: message
      };
    }
    this.renderLeaderboard();
  }

  private renderLeaderboard() {
    const { items, loading, error, generatedAt, range } = this.leaderboardState;
    this.leaderboardToggleAll.classList.toggle('active', range === 'all');
    this.leaderboardToggleWeekly.classList.toggle('active', range === 'weekly');

    if (loading) {
      this.leaderboardList.innerHTML = '<li class="leaderboard-item">加载中...</li>';
      this.leaderboardInfo.textContent = '';
      this.leaderboardError.hidden = true;
      return;
    }

    if (error) {
      this.leaderboardList.innerHTML = '';
      this.leaderboardError.textContent = error;
      this.leaderboardError.hidden = false;
      this.leaderboardInfo.textContent = '';
      return;
    }

    this.leaderboardError.hidden = true;
    if (items.length === 0) {
      this.leaderboardList.innerHTML = '<li class="leaderboard-item">暂无数据，快来成为首位上榜的人！</li>';
    } else {
      this.leaderboardList.innerHTML = items
        .map(
          (item, index) => `
            <li class="leaderboard-item">
              <span>#${index + 1}</span>
              <span>${escapeHtml(item.nickname)}</span>
              <span>${item.score}</span>
            </li>
          `
        )
        .join('');
    }

    if (generatedAt) {
      const date = new Date(generatedAt);
      const label = range === 'all' ? '总排行' : '近7天排行榜';
      this.leaderboardInfo.textContent = `${label} | 更新时间 ${date.toLocaleString()}`;
    } else {
      this.leaderboardInfo.textContent = '';
    }
  }

  private changeLeaderboardRange(range: LeaderboardRange) {
    if (this.leaderboardState.range === range && !this.leaderboardState.loading) {
      return;
    }
    this.loadLeaderboard(range);
  }

  private handleGameOver(score: number) {
    this.updateStartButton();
    this.pendingScore = score;
    if (score > 0) {
      this.submitButton.disabled = false;
      this.updateGameMessage(`游戏结束，本局得分 ${score} 分，提交至排行榜试试？`);
    } else {
      this.submitButton.disabled = true;
      this.updateGameMessage('这局没有得分，稍作调整再来！');
    }
  }

  private async submitScore(nickname: string, score: number) {
    this.submitButton.disabled = true;
    try {
      const result = await submitScore({ nickname, score });
      this.showToast(result.newRank ? `成绩已提交，当前排名第 ${result.newRank}` : '成绩已提交');
      this.pendingScore = null;
      this.loadLeaderboard(this.leaderboardState.range);
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败';
      this.showToast(message);
      this.submitButton.disabled = false;
    }
  }

  private showToast(message: string) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    window.setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
  }
}

function escapeHtml(value: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return value.replace(/[&<>"']/g, (m) => map[m]);
}

window.addEventListener('DOMContentLoaded', () => {
  new UIController();
});
