/**
 * Cost-aware planner: trims plans whose worst-case cost exceeds budget. Never
 * changes unit math; the actual debit is still issued by apps/web.
 */
import type {
  CostAwarePlanner,
  Plan,
  PlanStep,
  RunContext,
} from "./types.js";

export class DefaultCostAwarePlanner implements CostAwarePlanner {
  apply(plan: Plan, ctx: RunContext): { plan: Plan; rejected: PlanStep[] } {
    const accepted: PlanStep[] = [];
    const rejected: PlanStep[] = [];
    let running = 0;

    for (const step of plan.steps) {
      const wouldExceed = running + step.estimatedUnits > ctx.budgetUnits;
      if (wouldExceed) {
        rejected.push(step);
        ctx.emit({
          ts: Date.now(),
          layer: "orchestrator",
          agent: "planner",
          kind: "policy_block",
          message: `dropping step over budget`,
          meta: {
            domain: step.domain,
            task: step.task,
            estimatedUnits: step.estimatedUnits,
            running,
            budgetUnits: ctx.budgetUnits,
          },
        });
        continue;
      }
      accepted.push(step);
      running += step.estimatedUnits;
    }

    return {
      plan: { steps: accepted, finalSynthesisAgent: plan.finalSynthesisAgent },
      rejected,
    };
  }
}
