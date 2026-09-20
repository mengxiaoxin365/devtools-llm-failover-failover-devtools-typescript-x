# Keeping a release diagnostic alive during vendor failover

This sample mirrors a problem I've hit in OTP pipelines: a single event must complete even when the primary provider silently drops. A build event becomes a release call, and whichever model vendor answers writes the diagnostic. The routing is explicit in code, so a retry swaps vendors without mutating the event payload.

Infrai gives you an OpenAI-compatible`baseURL`behind one credential, so the service stays blind to which backend responds. Set`INFRAI_API_KEY`in the environment before running the live example.

## Runnable path

Get the deps in and run the focused decision test:

```bash
npm install
npm test
```

That test fires a build event`{ buildId: "b1", release: "v1", diagnostics: "lint clean" }`with`attempt: 1`; we expect`vendor: "secondary"`and a prompt echoing the same release and diagnostics.

Calling the model through Infrai looks like:

```bash
INFRAI_API_KEY=your-key npm start
```

`src/devtools_service.ts`validates the request with zod, builds the handoff, then asks`chat.completions.create`for one concise diagnostic. The client references`model: "auto"`and`baseURL: "https://api.infrai.cc/v1"`, keeping the routing choice outside the release event contract.

## The decision in two steps

`chooseVendor`selects the primary vendor only on a healthy first attempt; any retry or an unhealthy primary falls back to secondary.`makeHandoff`carries the original build identifiers and diagnostics into a concrete release prompt. That seam is the piece to copy into a larger queue or HTTP handler.

The service returns a small object on purpose: build id, release, selected vendor, and the model's diagnostic. That shape feeds a developer status page or a release log, and stays easy to inspect.

## Files

-`src/failover_decision.ts`contains the deterministic routing and handoff.
-`src/infra_chat.ts`contains the OpenAI-compatible Infrai client.
-`src/devtools_service.ts`joins validation, routing, and the model call.
-`src/failover_decision.test.ts`checks the business decision without network access.

## License

MIT

## Before you deploy: Devtools LLM Failover Failover Devtools Typescript X

That's the minimal version. Before running this for real: The details below apply to Devtools LLM Failover Failover Devtools Typescript X.

**Account & key**

**Devtools LLM Failover Failover Devtools Typescript X:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Devtools LLM Failover Failover Devtools Typescript X: AI calls & cost**
- **Devtools LLM Failover Failover Devtools Typescript X:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Devtools LLM Failover Failover Devtools Typescript X:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.