import type { GatewayContext } from './context';

export type PipelineStep = (ctx: GatewayContext) => Promise<GatewayContext>;

export async function runPipeline(ctx: GatewayContext, steps: PipelineStep[]): Promise<GatewayContext> {
  let current = ctx;
  for (const step of steps) {
    current = await step(current);
  }
  return current;
}
