/**
 * CircuitQueryLanguage.ts
 *
 * Domain-Specific Language (DSL) parser, generator, and executor for the Drosophila connectome.
 * Supports:
 * - WHAT_IF SILENCE DNp01
 * - COMPARE baseline WITH silence(DNp01)
 * - CAUSES escape
 * - PATH LC4 -> MOTOR
 * - DOWNSTREAM LC4 DEPTH 4
 * - BREAK WHEN DNp01 > 0.8
 */

import { DROSOPHILA_CIRCUIT_NODES, getDownstreamCascade } from '../shared/CircuitGraph';
import { CausalEngine } from './CausalEngine';
import { CausalSearch } from './CausalSearch';
import {
  CqlAst,
  InterventionType,
  CausalTargetObjective,
  BreakpointRule,
} from './ExperimentTypes';

export interface CqlExecutionResult {
  query: string;
  ast: CqlAst;
  success: boolean;
  message: string;
  data?: any;
}

function canonicalNodeId(name: string): string {
  const match = Object.keys(DROSOPHILA_CIRCUIT_NODES).find(
    (k) => k.toUpperCase() === name.toUpperCase()
  );
  return match || name;
}

export class CircuitQueryLanguage {
  /**
   * Parses a raw CQL text string into a typed AST.
   */
  public static parse(queryStr: string): CqlAst {
    const raw = queryStr.trim();
    const upper = raw.toUpperCase();

    // 1. WHAT_IF <ACTION> <TARGET>
    if (upper.startsWith('WHAT_IF')) {
      const parts = raw.split(/\s+/);
      const action = (parts[1] || 'SILENCE').toLowerCase() as InterventionType;
      const target = canonicalNodeId(parts[2] || 'DNp01');
      const factor = parts[3] ? parseFloat(parts[3]) : 1.0;

      return {
        queryType: 'WHAT_IF',
        rawQuery: raw,
        interventionType: action,
        targetNode: target,
        factor,
      };
    }

    // 2. COMPARE <A> WITH <B>
    if (upper.startsWith('COMPARE')) {
      const match = raw.match(/COMPARE\s+(\w+)\s+WITH\s+(.+)/i);
      const targetNode = match ? match[1] : 'baseline';
      const compareWith = match ? match[2] : 'silence(DNp01)';

      return {
        queryType: 'COMPARE',
        rawQuery: raw,
        targetNode,
        compareWith,
      };
    }

    // 3. CAUSES <OBJECTIVE>
    if (upper.startsWith('CAUSES')) {
      const parts = raw.split(/\s+/);
      const target = (parts[1] || 'escape').toLowerCase();
      let objective: CausalTargetObjective = 'prevent_escape';
      if (target.includes('trigger') || target.includes('startle')) {
        objective = 'trigger_escape';
      } else if (target.includes('delay')) {
        objective = 'delay_escape';
      } else if (target.includes('reverse')) {
        objective = 'reverse_direction';
      }

      return {
        queryType: 'CAUSES',
        rawQuery: raw,
        condition: objective,
      };
    }

    // 4. PATH <FROM> -> <TO>
    if (upper.startsWith('PATH')) {
      const match = raw.match(/PATH\s+([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)/i);
      const fromNode = match ? canonicalNodeId(match[1]) : 'LC4';
      const toNode = match ? canonicalNodeId(match[2]) : 'MOTOR';

      return {
        queryType: 'PATH',
        rawQuery: raw,
        targetNode: fromNode,
        compareWith: toNode,
      };
    }

    // 5. DOWNSTREAM <NODE> [DEPTH <N>]
    if (upper.startsWith('DOWNSTREAM')) {
      const parts = raw.split(/\s+/);
      const node = canonicalNodeId(parts[1] || 'LC4');
      let depth = 4;
      const depthIdx = parts.findIndex((p) => p.toUpperCase() === 'DEPTH');
      if (depthIdx !== -1 && parts[depthIdx + 1]) {
        depth = parseInt(parts[depthIdx + 1], 10) || 4;
      }

      return {
        queryType: 'DOWNSTREAM',
        rawQuery: raw,
        targetNode: node,
        depth,
      };
    }

    // 6. BREAK WHEN <CONDITION>
    if (upper.startsWith('BREAK')) {
      const match = raw.match(/BREAK\s+WHEN\s+([A-Za-z0-9_]+)\s*([><=]+)\s*([0-9.]+)/i);
      if (match) {
        return {
          queryType: 'BREAK_WHEN',
          rawQuery: raw,
          targetNode: canonicalNodeId(match[1]),
          condition: match[2],
          threshold: parseFloat(match[3]),
        };
      }

      // Default break on spike
      const parts = raw.split(/\s+/);
      const target = canonicalNodeId(parts[parts.length - 1]);
      return {
        queryType: 'BREAK_WHEN',
        rawQuery: raw,
        targetNode: target,
        condition: '>',
        threshold: 0,
      };
    }

    // Default fallback
    return {
      queryType: 'WHAT_IF',
      rawQuery: raw,
      targetNode: 'DNp01',
      interventionType: 'silence',
      factor: 1.0,
    };
  }

  /**
   * Executes a parsed CQL query against the simulation engine.
   */
  public static execute(queryStr: string): CqlExecutionResult {
    const ast = this.parse(queryStr);

    try {
      switch (ast.queryType) {
        case 'WHAT_IF': {
          const node = ast.targetNode || 'DNp01';
          const type = ast.interventionType || 'silence';
          const intensity = ast.factor || 1.0;

          const baseline = CausalEngine.runTrajectory();
          const counterfactual = CausalEngine.runTrajectory({
            interventions: [{ targetNode: node, type, intensity }],
          });

          const comparison = CausalEngine.compare(baseline, counterfactual);
          const report = CausalEngine.generateMechanisticReport(comparison, [
            { targetNode: node, type, intensity },
          ]);

          return {
            query: queryStr,
            ast,
            success: true,
            message: `Evaluated counterfactual: ${type.toUpperCase()} ${node}. Outcome changed: ${comparison.behavioralEffect.outcomeChanged ? 'YES' : 'NO'}.`,
            data: { comparison, report },
          };
        }

        case 'CAUSES': {
          const objective = (ast.condition || 'prevent_escape') as CausalTargetObjective;
          const result = CausalSearch.search(objective);
          return {
            query: queryStr,
            ast,
            success: true,
            message: `Discovered minimal causal intervention for objective '${objective}': ${result.minimalSolution.explanation}`,
            data: result,
          };
        }

        case 'PATH': {
          const from = ast.targetNode || 'LC4';
          const to = ast.compareWith || 'MOTOR';
          const cascade = getDownstreamCascade(from, 6);
          const path = cascade.map((c) => c.nodeId);
          return {
            query: queryStr,
            ast,
            success: true,
            message: `Path from ${from} to ${to}: ${path.join(' -> ')}`,
            data: { path, cascade },
          };
        }

        case 'DOWNSTREAM': {
          const node = ast.targetNode || 'LC4';
          const depth = ast.depth || 4;
          const cascade = getDownstreamCascade(node, depth);
          return {
            query: queryStr,
            ast,
            success: true,
            message: `Downstream cascade from ${node} (depth ${depth}): ${cascade.length} populations reachable.`,
            data: cascade,
          };
        }

        case 'BREAK_WHEN': {
          const rule: BreakpointRule = {
            id: `BP-${Date.now().toString(16).slice(-4)}`,
            name: `Break on ${ast.targetNode} ${ast.condition || '>'} ${ast.threshold || 0}`,
            type: 'spike',
            targetNode: ast.targetNode,
            threshold: ast.threshold || 0,
            operator: (ast.condition as any) || '>',
            enabled: true,
          };
          return {
            query: queryStr,
            ast,
            success: true,
            message: `Breakpoint set: ${rule.name}`,
            data: rule,
          };
        }

        default:
          return {
            query: queryStr,
            ast,
            success: true,
            message: `Query parsed: ${ast.queryType}`,
          };
      }
    } catch (err: any) {
      return {
        query: queryStr,
        ast,
        success: false,
        message: `CQL execution error: ${err.message || String(err)}`,
      };
    }
  }

  /**
   * Generates a CQL query string from GUI actions.
   */
  public static generateQuery(
    type: 'what_if' | 'causes' | 'path' | 'break',
    params: { node?: string; intervention?: string; objective?: string }
  ): string {
    if (type === 'what_if') {
      return `WHAT_IF ${(params.intervention || 'silence').toUpperCase()} ${params.node || 'DNp01'}`;
    }
    if (type === 'causes') {
      return `CAUSES ${params.objective || 'prevent_escape'}`;
    }
    if (type === 'path') {
      return `PATH ${params.node || 'LC4'} -> MOTOR`;
    }
    if (type === 'break') {
      return `BREAK WHEN ${params.node || 'DNp01'} > 0.8`;
    }
    return `WHAT_IF SILENCE DNp01`;
  }
}
