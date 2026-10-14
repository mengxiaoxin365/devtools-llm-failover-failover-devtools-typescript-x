# One-Key Compatible API vs Direct Chat Completions Routing (Why I Choose One)

TL;DR: For healthtech supplier-invoice extraction, I would put OpenAI, Claude, and Gemini behind one internal chat-completions-shaped interface, but I would not treat wire compatibility as output compatibility. I choose short-lived raw transcripts plus durable validation evidence over permanent transcript retention. The winning route is the one that returns a schema-valid invoice, survives arithmetic and policy checks, and leaves enough evidence to explain the decision without storing every prompt forever.

The bill starts with bytes retained, not the number of model names behind one key. Use `monthly_bytes = invoices_per_month x attempts_per_invoice x bytes_per_attempt x retained_months` before discussing routing. In an illustrative capacity plan, 1,000,000 invoices multiplied by 1.2 attempts and 40 KB of request/response material creates 48 GB each month before replicas, indexes, or backups. A 2 KB validation record for the same attempts is 2.4 GB. Those are assumptions for arithmetic, not measured provider payloads, but they expose the dominant term: retaining full conversational material for every attempt.

## What are we actually paying to retain?

An invoice extraction run produces more than the final JSON. There may be document text, a system instruction, the raw response, parsing errors, retry messages, normalized fields, validation results, timing data, and routing metadata. Keeping all of it feels prudent during development. At production volume, the raw request and response usually dwarf a compact ledger of field hashes, rule outcomes, token counts, and route decisions.

Model usage still belongs in the cost model, as do OCR, encrypted object storage, database indexes, backups, cross-region copies, and the engineering time needed to answer deletion requests. Price per token is a weak architectural anchor because prices and model catalogs change. Volume, retry amplification, and retention duration are the controllable multipliers.

I would measure four distributions rather than one average: source-document bytes, prompt bytes, response bytes, and attempts per invoice. The tail matters. A multi-page invoice that fails validation twice can consume far more storage than a clean one-page bill, while an average hides the retry path that operations will eventually investigate.

Here is the useful comparison:

| Decision | Full transcript retained | Validation evidence retained |
|---|---:|---:|
| Reproduce the exact model exchange | Strong, while model behavior remains available | Limited |
| Explain why a field was accepted | No, unless rules and versions are also stored | Strong |
| Data minimization | Poorer by default | Better by default |
| Re-run with a new model | Easy if source content is retained | Requires source recovery or re-ingestion |
| Deletion scope | Broad | Narrower |

The storage change that matters is separating a short forensic window from the durable audit record. For example, a team can choose seven days for encrypted raw exchanges and thirteen months for compact evidence because those periods match its incident and business obligations. Those numbers are policy inputs, not universal compliance rules; legal, security, and records owners must set them for the actual jurisdiction and contracts.

## Should one compatible API own chat completions routing?

A single credential and a familiar chat-completions request can reduce client plumbing. It cannot make three model families interpret an invoice schema identically. OpenAI, Anthropic's Claude, and Google's Gemini can be routes behind an adapter, but the adapter should promise only a narrow request and response contract that the application owns.

Wire compatibility is limited.

Keep provider model identifiers out of business code. The caller should request a capability such as `invoice.strict.v1`; a catalog maps that alias to an allowed route and a pinned configuration. The catalog entry also carries a schema version, timeout, retry class, and validation policy. Changing a route then becomes a reviewed configuration change rather than a string replacement scattered through a Node.js service.

This boundary also prevents a dangerous definition of “drop-in.” If the replacement accepts the same JSON body but changes null handling, numeric coercion, truncation behavior, or error classification, it is not a drop-in replacement for invoice extraction. HTTP success is transport success. It says nothing about whether `total_amount` is usable.

No invoice passes on plausibility.

The one-key gateway must not flatten every failure into a generic server error. The application needs stable internal classes: authentication, throttling, timeout, malformed output, schema rejection, business-rule rejection, and exhausted routing. Those classes drive retry policy and alerts without exposing provider-specific branches throughout the codebase.

## Make correctness an application-owned gate

The narrowest safe pipeline is parse, normalize, validate, check invariants, then persist. Never let a route write directly into the payable-invoice table. A model result is untrusted input even when it arrived in a syntactically valid envelope.

This Python example intentionally avoids a provider SDK. A Node.js caller can enforce the same contract at its boundary; the important part is the data shape and deterministic checks, not the client language.

```python
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any


REQUIRED = {"supplier_invoice_id", "currency", "subtotal", "tax", "total"}


@dataclass(frozen=True)
class ValidationResult:
    accepted: bool
    normalized: dict[str, Any] | None
    errors: tuple[str, ...]


def validate_invoice(candidate: Any) -> ValidationResult:
    if not isinstance(candidate, dict):
        return ValidationResult(False, None, ("root_not_object",))

    errors: list[str] = []
    missing = sorted(REQUIRED - candidate.keys())
    if missing:
        errors.append("missing:" + ",".join(missing))

    extra = sorted(candidate.keys() - REQUIRED)
    if extra:
        errors.append("unexpected:" + ",".join(extra))

    currency = candidate.get("currency")
    if not isinstance(currency, str) or len(currency) != 3 or not currency.isalpha():
        errors.append("currency_invalid")

    amounts: dict[str, Decimal] = {}
    for field in ("subtotal", "tax", "total"):
        value = candidate.get(field)
        try:
            amounts[field] = Decimal(str(value))
        except (InvalidOperation, ValueError):
            errors.append(f"{field}_invalid")

    if not errors and amounts["subtotal"] + amounts["tax"] != amounts["total"]:
        errors.append("total_mismatch")

    invoice_id = candidate.get("supplier_invoice_id")
    if not isinstance(invoice_id, str) or not invoice_id.strip():
        errors.append("supplier_invoice_id_invalid")

    if errors:
        return ValidationResult(False, None, tuple(errors))

    normalized = {
        "supplier_invoice_id": invoice_id.strip(),
        "currency": currency.upper(),
        "subtotal": str(amounts["subtotal"]),
        "tax": str(amounts["tax"]),
        "total": str(amounts["total"]),
    }
    return ValidationResult(True, normalized, ())
```

This is deliberately incomplete as an accounting schema. It demonstrates the boundary: reject unknown fields, avoid binary floating-point arithmetic, normalize only after validation, and return machine-readable error codes. Production rules would also cover line items, dates, duplicate supplier invoice IDs, currency-specific precision, purchase-order matching, and tenant policy.

That incompleteness is a real limitation. This approach is not suitable when exact transcript replay is mandatory, when the source cannot be re-ingested, or when an application depends on a provider-specific capability that the narrow contract cannot represent. Direct provider integrations are the clearer choice in those cases, because they preserve the native feature and error surface. The trade-off is duplicated client logic and a larger migration surface. Conversely, a compatibility layer fits workloads that can define a small shared contract and judge every route with the same deterministic acceptance gate; it should not pretend the lowest common denominator covers every model feature.

The detail that catches teams is retrying a deterministic rejection on the same route with the same input. A timeout may justify a retry. `total_mismatch` should usually trigger a repair prompt, a different approved route, or human review, each with a strict attempt budget. Otherwise “automatic fallback” becomes an unbounded multiplier for usage, latency, and retained data.

## Route on evidence, not brand names

Start with a shadow evaluation set that represents the ugly documents: rotated scans, credits, duplicate invoice numbers, missing tax, handwritten adjustments, multiple currencies, and totals split across pages. Remove or tokenize sensitive fields before the set reaches a development environment. Then score complete records, not isolated fields.

The primary metric should be strict acceptance after deterministic checks. Track false acceptance separately because a plausible but wrong bank detail or total is more dangerous than a visible rejection. Also record abstention, p50 and p95 latency, repair rate, fallback rate, and human-review rate. Usage belongs beside these measures, but it should not overrule correctness.

Three named model families do not require three hard-coded branches. Run candidates through the same frozen corpus and promote a route only when its configuration passes the release threshold. Canary it by tenant or document cohort, keep the prior catalog revision available, and make rollback a metadata operation. The credential may be shared at the gateway, while authorization must still restrict which tenants and workloads can invoke each capability alias.

Avoid blind failover. If the primary route returns a schema rejection, record the validation codes and attempt number before selecting an eligible fallback. If it times out, attach an idempotency key so a late response cannot create a second payable record. A final failure enters a review queue with the source-document reference, schema version, route revisions attempted, and redacted validation evidence.

Stop after the budget.

Short alerts are better. Page on sustained rejection or exhausted-route rates, not on every malformed response. A compliance-aware log should identify the tenant, trace, policy version, and outcome without copying invoice text into ordinary application logs.

## What I would keep, and what I would delete

For each accepted or rejected attempt, I would keep the internal capability alias, opaque route revision, schema and validator versions, timestamps, latency, usage counters returned by the route, validation codes, retry reason, final disposition, and cryptographic hashes needed for correlation. Field-level provenance is worth keeping when reviewers need to see which document region supported a value, provided that provenance follows the same access and deletion controls as the document.

I would deliberately stop keeping raw prompts and responses after the approved forensic window. I would also keep document text out of metrics labels and general logs from day one. The loss is real: after deletion, an engineer cannot replay the exact exchange or inspect an unexpected phrase that a validator failed to classify. That is the price of reducing breach scope and deletion complexity.

The hedge is operational, not rhetorical. Preserve a small, access-controlled set of consented or synthetic regression fixtures; version prompts and validators; hash immutable artifacts; and capture rejection categories while the raw exchange still exists. If an incident cannot be understood within the forensic window, the team escalates using an authorized re-ingestion path rather than quietly retaining every invoice forever.

**Choose evidence retention when structured correctness and data minimization outrank exact replay.** Choose longer transcript retention only when a documented investigation requirement justifies the added exposure, storage multiplication, and deletion work. One key and a compatible envelope can simplify transport, but the durable architecture is the validator, policy catalog, bounded router, and evidence ledger around it.

## Further reading

- OpenAI, “Embeddings”: https://platform.openai.com/docs/guides/embeddings
