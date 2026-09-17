/**
 * BreakpointManager.ts
 *
 * GDB-style debugging engine for neural circuit execution:
 * Manages active breakpoint rules, evaluates predicate triggers per tick/step,
 * handles stepping, continuing, rewinding, and register/voltage state inspection.
 */

import { BreakpointRule, BreakpointHitEvent, PopulationSample } from './ExperimentTypes';

export type BreakpointCallback = (event: BreakpointHitEvent) => void;

export class BreakpointManager {
  private rules: Map<string, BreakpointRule> = new Map();
  private isPaused: boolean = false;
  private currentStepIndex: number = 0;
  private onHitCallback: BreakpointCallback | null = null;

  constructor(onHit?: BreakpointCallback) {
    if (onHit) this.onHitCallback = onHit;
    this.initDefaultRules();
  }

  private initDefaultRules(): void {
    this.addRule({
      id: 'bp_dnp01_spike',
      name: 'Break on Giant Fiber (DNp01) spike',
      type: 'spike',
      targetNode: 'DNp01',
      threshold: 0,
      operator: '>',
      enabled: false,
    });

    this.addRule({
      id: 'bp_lc4_spike',
      name: 'Break on LC4 looming detection',
      type: 'spike',
      targetNode: 'LC4',
      threshold: 0,
      operator: '>',
      enabled: false,
    });

    this.addRule({
      id: 'bp_motor_threshold',
      name: 'Break when Motor output > 25.0',
      type: 'threshold',
      threshold: 25.0,
      operator: '>=',
      enabled: false,
    });
  }

  public addRule(rule: BreakpointRule): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  public toggleRule(ruleId: string, enabled?: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled !== undefined ? enabled : !rule.enabled;
    }
  }

  public getRules(): BreakpointRule[] {
    return Array.from(this.rules.values());
  }

  public setOnHit(callback: BreakpointCallback): void {
    this.onHitCallback = callback;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public getCurrentStep(): number {
    return this.currentStepIndex;
  }

  public setCurrentStep(step: number): void {
    this.currentStepIndex = step;
  }

  /**
   * Evaluates all active breakpoints against a single simulation sample.
   * Returns true if a breakpoint was triggered and halts execution.
   */
  public evaluateSample(sample: PopulationSample, stepIndex: number): boolean {
    this.currentStepIndex = stepIndex;

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      let triggered = false;
      let currentValue = 0;

      if (rule.type === 'spike' && rule.targetNode) {
        currentValue = sample.nodeSpikes[rule.targetNode] || 0;
        triggered = currentValue > (rule.threshold || 0);
      } else if (rule.type === 'threshold') {
        currentValue = rule.targetNode ? (sample.nodeVoltages[rule.targetNode] || 0) : sample.motorOutput;
        const th = rule.threshold || 1.0;
        if (rule.operator === '>=') triggered = currentValue >= th;
        else if (rule.operator === '>') triggered = currentValue > th;
        else if (rule.operator === '==') triggered = Math.abs(currentValue - th) < 0.01;
      }

      if (triggered) {
        this.isPaused = true;
        const event: BreakpointHitEvent = {
          ruleId: rule.id,
          ruleName: rule.name,
          tMs: sample.tMs,
          targetNode: rule.targetNode,
          currentValue,
          threshold: rule.threshold || 0,
        };

        this.onHitCallback?.(event);
        return true;
      }
    }

    return false;
  }
}
