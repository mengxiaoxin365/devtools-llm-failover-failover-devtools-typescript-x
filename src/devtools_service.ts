import { z } from "zod";
import { makeHandoff, type BuildEvent } from "./failover_decision.js";
import { summarizeHandoff } from "./infra_chat.js";

const requestSchema = z.object({
  buildId: z.string().min(1),
  release: z.string().min(1),
  diagnostics: z.string().min(1),
  attempt: z.number().int().nonnegative().default(0),
  primaryHealthy: z.boolean().default(true),
});

export async function handleBuildRelease(body: unknown) {
  const input = requestSchema.parse(body);
  const event: BuildEvent = { buildId: input.buildId, release: input.release, diagnostics: input.diagnostics };
  const handoff = makeHandoff(event, input.attempt, input.primaryHealthy);
  const diagnostic = await summarizeHandoff(handoff.prompt);
  return { buildId: handoff.buildId, release: handoff.release, vendor: handoff.vendor, diagnostic };
}

if (process.argv[1]?.endsWith("devtools_service.ts")) {
  const example = { buildId: "build-42", release: "v2.3.0", diagnostics: "bundle compiled", attempt: 0, primaryHealthy: true };
  handleBuildRelease(example).then(console.log).catch((error) => { console.error(error); process.exitCode = 1; });
}
