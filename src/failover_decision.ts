export type Vendor = "primary" | "secondary";

export type BuildEvent = {
  buildId: string;
  release: string;
  diagnostics: string;
};

export type Handoff = BuildEvent & {
  vendor: Vendor;
  prompt: string;
};

export function chooseVendor(attempt: number, primaryHealthy: boolean): Vendor {
  if (attempt === 0 && primaryHealthy) return "primary";
  return "secondary";
}

export function makeHandoff(event: BuildEvent, attempt: number, primaryHealthy: boolean): Handoff {
  const vendor = chooseVendor(attempt, primaryHealthy);
  return {
    ...event,
    vendor,
    prompt: `Release ${event.release} for build ${event.buildId}. Diagnostics: ${event.diagnostics}`,
  };
}
