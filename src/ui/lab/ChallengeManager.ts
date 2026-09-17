/**
 * ChallengeManager.ts
 *
 * "CAN YOU BREAK THE FLY?" Challenge Mode for CONNECTOME LAB:
 * Interactive experimental challenges with timers, intervention limits,
 * live outcome evaluation, local scoring, and shareable URL hashes (zero backend).
 */

import {
  validateChallengeOutcome,
  encodeLabExperimentHash,
  decodeLabExperimentHash,
} from '../../engine/shared/CircuitGraph';
import { ActiveIntervention } from './InterventionPanel';

export interface ChallengeDef {
  id: string;
  number: string;
  title: string;
  targetCondition: 'prevent_escape' | 'trigger_escape' | 'blind_fly';
  description: string;
  hint: string;
  maxInterventions: number;
  timeLimitS: number;
}

export const LAB_CHALLENGES: ChallengeDef[] = [
  {
    id: 'challenge-01',
    number: '01',
    title: 'STOP THE ESCAPE',
    targetCondition: 'prevent_escape',
    description: 'A predator is closing in along a canonical looming trajectory. Find and silence the circuit to prevent the fly from escaping!',
    hint: 'Target the master Giant Fiber command neuron (DNp01) or the dual lobula detectors (LC4 + LPLC2).',
    maxInterventions: 3,
    timeLimitS: 10,
  },
  {
    id: 'challenge-02',
    number: '02',
    title: 'TRIGGER EARLY TAKEOFF',
    targetCondition: 'trigger_escape',
    description: 'The fly is resting idle on the substrate. Artificially excite the escape pathway to force an immediate evasive jump!',
    hint: 'Stimulate DNp01 Giant Fiber or both LC4 and LPLC2 with at least 50% burst intensity.',
    maxInterventions: 2,
    timeLimitS: 12,
  },
  {
    id: 'challenge-03',
    number: '03',
    title: 'BLIND THE FLY',
    targetCondition: 'blind_fly',
    description: 'Eliminate the fly visual threat perception with the smallest targeted intervention.',
    hint: 'Silence retinal photoreceptors (VIS_R1R6) or medulla processing interneurons (VIS_ME).',
    maxInterventions: 1,
    timeLimitS: 15,
  },
  {
    id: 'challenge-04',
    number: '04',
    title: 'CHAOS LAB',
    targetCondition: 'prevent_escape',
    description: 'Randomly manipulate 4 or more populations simultaneously and observe the resulting network turbulence.',
    hint: 'Apply a combination of stimulate, silence, and amplify across sensory and central clusters.',
    maxInterventions: 5,
    timeLimitS: 20,
  },
];

export interface ChallengeCallbacks {
  onStartChallenge?: (challenge: ChallengeDef) => void;
  onChallengeComplete?: (passed: boolean, score: { timeUsedS: number; interventionsUsed: number }) => void;
  onSelectTarget?: (targetId: string) => void;
}

export class ChallengeManager {
  private container: HTMLElement;
  private currentChallenge: ChallengeDef | null = null;
  private remainingTimeS: number = 0;
  private timerInterval: number | null = null;
  private isRunning: boolean = false;
  private callbacks: ChallengeCallbacks;

  constructor(parentElement: HTMLElement, callbacks: ChallengeCallbacks = {}) {
    this.callbacks = callbacks;

    this.container = document.createElement('div');
    this.container.id = 'challengeManager';
    this.container.className = 'challenge-manager';
    parentElement.appendChild(this.container);

    this.render();
    this.checkInitialURL();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="challenge-header">
        <div class="challenge-title-group">
          <span class="challenge-badge">EXPERIMENTAL CHALLENGE</span>
          <h3>CAN YOU BREAK THE FLY?</h3>
        </div>
        <button type="button" class="share-url-btn" id="btnShareChallenge" title="Copy shareable link">
          🔗 SHARE SETUP
        </button>
      </div>

      <!-- Challenge Cards Grid -->
      <div class="challenge-grid">
        ${LAB_CHALLENGES.map((ch) => `
          <div class="challenge-card" data-id="${ch.id}">
            <div class="card-num-row">
              <span class="card-num">CHALLENGE ${ch.number}</span>
              <span class="card-limit">${ch.maxInterventions} TRIES • ${ch.timeLimitS}s</span>
            </div>
            <h4 class="card-title">${ch.title}</h4>
            <p class="card-desc">${ch.description}</p>
            <button type="button" class="card-launch-btn">START CHALLENGE</button>
          </div>
        `).join('')}
      </div>

      <!-- Active Challenge HUD (Hidden until started) -->
      <div class="active-challenge-hud" id="activeChallengeHUD" style="display: none;">
        <div class="hud-top-bar">
          <div class="hud-ch-info">
            <span class="active-badge" id="hudChBadge">CHALLENGE 01</span>
            <h4 id="hudChTitle">STOP THE ESCAPE</h4>
          </div>
          <div class="hud-timer-box">
            <span class="timer-label">TIME REMAINING:</span>
            <span class="timer-val highlight-amber" id="hudTimerVal">10.0s</span>
          </div>
        </div>

        <div class="hud-hint-box" id="hudHintBox">
          <span class="hint-icon">💡</span>
          <span id="hudHintText">Target the master Giant Fiber command neuron (DNp01).</span>
        </div>

        <div class="hud-status-bar">
          <div class="hud-status-item">
            <span class="status-label">INTERVENTIONS LEFT:</span>
            <span class="status-val highlight-cyan" id="hudInterventionsLeft">3 / 3</span>
          </div>
          <button type="button" class="abort-challenge-btn" id="btnAbortChallenge">ABORT</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const cards = this.container.querySelectorAll('.challenge-card');
    cards.forEach((card) => {
      const id = card.getAttribute('data-id');
      const btn = card.querySelector('.card-launch-btn');
      btn?.addEventListener('click', () => {
        const def = LAB_CHALLENGES.find((c) => c.id === id);
        if (def) this.startChallenge(def);
      });
    });

    this.container.querySelector('#btnAbortChallenge')?.addEventListener('click', () => {
      this.abortChallenge();
    });

    this.container.querySelector('#btnShareChallenge')?.addEventListener('click', () => {
      this.copyShareURL();
    });
  }

  public startChallenge(def: ChallengeDef): void {
    this.currentChallenge = def;
    this.remainingTimeS = def.timeLimitS;
    this.isRunning = true;

    // Update HUD
    const hud = this.container.querySelector('#activeChallengeHUD') as HTMLElement;
    const grid = this.container.querySelector('.challenge-grid') as HTMLElement;
    hud.style.display = 'block';
    grid.style.display = 'none';

    (this.container.querySelector('#hudChBadge') as HTMLElement).textContent = `CHALLENGE ${def.number}`;
    (this.container.querySelector('#hudChTitle') as HTMLElement).textContent = def.title;
    (this.container.querySelector('#hudHintText') as HTMLElement).textContent = def.hint;
    (this.container.querySelector('#hudInterventionsLeft') as HTMLElement).textContent = `${def.maxInterventions} / ${def.maxInterventions}`;
    (this.container.querySelector('#hudTimerVal') as HTMLElement).textContent = `${def.timeLimitS.toFixed(1)}s`;

    this.callbacks.onStartChallenge?.(def);

    // Start timer interval
    if (this.timerInterval !== null) clearInterval(this.timerInterval);
    const startTime = performance.now();
    this.timerInterval = window.setInterval(() => {
      const elapsedS = (performance.now() - startTime) / 1000;
      this.remainingTimeS = Math.max(0, def.timeLimitS - elapsedS);
      const timerEl = this.container.querySelector('#hudTimerVal');
      if (timerEl) timerEl.textContent = `${this.remainingTimeS.toFixed(1)}s`;

      if (this.remainingTimeS <= 0) {
        this.finishChallenge(false, def.timeLimitS, def.maxInterventions);
      }
    }, 100);
  }

  public evaluateInterventions(interventions: ActiveIntervention[]): void {
    if (!this.isRunning || !this.currentChallenge) return;

    const left = Math.max(0, this.currentChallenge.maxInterventions - interventions.length);
    const leftEl = this.container.querySelector('#hudInterventionsLeft');
    if (leftEl) {
      leftEl.textContent = `${left} / ${this.currentChallenge.maxInterventions}`;
    }

    // Evaluate win condition
    const mapped = interventions.map((i) => ({
      type: i.type,
      target: i.targetId,
      intensity: i.intensity,
    }));
    const passed = validateChallengeOutcome(this.currentChallenge.targetCondition, mapped);
    if (passed) {
      const timeUsed = this.currentChallenge.timeLimitS - this.remainingTimeS;
      this.finishChallenge(true, timeUsed, interventions.length);
    } else if (interventions.length >= this.currentChallenge.maxInterventions) {
      // Used all interventions without satisfying condition
      this.finishChallenge(false, this.currentChallenge.timeLimitS - this.remainingTimeS, interventions.length);
    }
  }

  private finishChallenge(passed: boolean, timeUsedS: number, interventionsUsed: number): void {
    this.isRunning = false;
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const hud = this.container.querySelector('#activeChallengeHUD') as HTMLElement;
    const banner = document.createElement('div');
    banner.className = `challenge-result-banner ${passed ? 'result-victory' : 'result-failure'}`;
    banner.innerHTML = `
      <div class="result-icon">${passed ? '🏆' : '✕'}</div>
      <h3 class="result-title">${passed ? 'CHALLENGE ACCOMPLISHED!' : 'CHALLENGE FAILED'}</h3>
      <p class="result-msg">${passed ? 'You successfully reconfigured the connectome dynamics!' : 'The target condition was not met within constraints.'}</p>
      <div class="result-score-row">
        <span>TIME: ${timeUsedS.toFixed(1)}s</span>
        <span>INTERVENTIONS: ${interventionsUsed}</span>
      </div>
      <button type="button" class="result-dismiss-btn">CONTINUE EXPERIMENT</button>
    `;

    banner.querySelector('.result-dismiss-btn')?.addEventListener('click', () => {
      banner.remove();
      this.abortChallenge();
    });

    hud.appendChild(banner);
    this.callbacks.onChallengeComplete?.(passed, { timeUsedS, interventionsUsed });
  }

  public abortChallenge(): void {
    this.isRunning = false;
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    const hud = this.container.querySelector('#activeChallengeHUD') as HTMLElement;
    const grid = this.container.querySelector('.challenge-grid') as HTMLElement;
    hud.style.display = 'none';
    grid.style.display = 'grid';
  }

  private copyShareURL(): void {
    const hash = encodeLabExperimentHash({
      challengeId: this.currentChallenge?.id || 'sandbox',
      selectedCircuit: 'DNp01',
      interventions: [],
    });
    const fullURL = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(fullURL).then(() => {
      alert(`Copied shareable Connectome Lab link to clipboard:\n${fullURL}`);
    }).catch(() => {
      prompt('Shareable Connectome Lab link:', fullURL);
    });
  }

  private checkInitialURL(): void {
    if (window.location.hash.includes('lab')) {
      const decoded = decodeLabExperimentHash(window.location.hash);
      const ch = LAB_CHALLENGES.find((c) => c.id === decoded.challengeId);
      if (ch) {
        setTimeout(() => this.startChallenge(ch), 500);
      }
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}
