/**
 * CqlConsole.ts
 *
 * Interactive terminal for the Drosophila Circuit Query Language (CQL).
 * Allows executing declarative queries with autocomplete and instant feedback.
 */

import { CircuitQueryLanguage, CqlExecutionResult } from '../../engine/causality/CircuitQueryLanguage';

export interface CqlConsoleCallbacks {
  onExecuteResult?: (result: CqlExecutionResult) => void;
}

export class CqlConsole {
  private container: HTMLElement;
  private logHistory: Array<{ query: string; result: CqlExecutionResult }> = [];
  private callbacks: CqlConsoleCallbacks;

  constructor(container: HTMLElement, callbacks: CqlConsoleCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.render();
  }

  private render(): void {
    const historyHtml = this.logHistory
      .map(
        (h) => `
        <div class="cql-log-entry">
          <div class="cql-prompt-line">
            <span class="cql-prompt">cql&gt;</span>
            <span class="cql-cmd">${h.query}</span>
          </div>
          <div class="cql-response-line ${h.result.success ? 'success' : 'error'}">
            ${h.result.message}
          </div>
        </div>
      `
      )
      .join('');

    this.container.innerHTML = `
      <div class="cql-console-view">
        <div class="cql-header">
          <div class="cql-title">
            <span class="cql-icon">&gt;_</span>
            <span>CIRCUIT QUERY LANGUAGE (CQL) // TERMINAL CONSOLE</span>
          </div>
          <div class="cql-chips" id="cqlQuickChips">
            <button class="cql-chip" data-cmd="WHAT_IF SILENCE DNp01">WHAT_IF SILENCE DNp01</button>
            <button class="cql-chip" data-cmd="CAUSES prevent_escape">CAUSES prevent_escape</button>
            <button class="cql-chip" data-cmd="PATH LC4 -> MOTOR">PATH LC4 -&gt; MOTOR</button>
            <button class="cql-chip" data-cmd="DOWNSTREAM LC4 DEPTH 4">DOWNSTREAM LC4 DEPTH 4</button>
            <button class="cql-chip" data-cmd="BREAK WHEN DNp01 > 0.8">BREAK WHEN DNp01 &gt; 0.8</button>
          </div>
        </div>

        <div class="cql-log-window" id="cqlLogWindow">
          <div class="cql-welcome">
            FLYBRAIN CQL v1.0.0 — Connectome Query Engine ready. Type a query or click an example above.
          </div>
          ${historyHtml}
        </div>

        <div class="cql-input-bar">
          <span class="cql-prompt">cql&gt;</span>
          <input type="text" class="cql-input" id="cqlInput" placeholder="Enter query (e.g. WHAT_IF SILENCE DNp01)..." />
          <button class="cql-submit-btn" id="btnCqlSubmit">RUN</button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const input = this.container.querySelector('#cqlInput') as HTMLInputElement;
    const submitBtn = this.container.querySelector('#btnCqlSubmit');
    const chipHolder = this.container.querySelector('#cqlQuickChips');

    const handleRun = (cmd: string) => {
      const q = cmd.trim();
      if (!q) return;

      const result = CircuitQueryLanguage.execute(q);
      this.logHistory.push({ query: q, result });
      this.callbacks.onExecuteResult?.(result);
      this.render();

      const logWin = this.container.querySelector('#cqlLogWindow');
      if (logWin) logWin.scrollTop = logWin.scrollHeight;
    };

    submitBtn?.addEventListener('click', () => {
      if (input) handleRun(input.value);
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleRun(input.value);
      }
    });

    chipHolder?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.cql-chip') as HTMLButtonElement;
      if (!btn) return;
      const cmd = btn.getAttribute('data-cmd');
      if (cmd) handleRun(cmd);
    });
  }

  public runQuery(cmd: string): void {
    const result = CircuitQueryLanguage.execute(cmd);
    this.logHistory.push({ query: cmd, result });
    this.callbacks.onExecuteResult?.(result);
    this.render();
  }
}
