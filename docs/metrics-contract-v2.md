# Metric Contract v2

Status: scoring correction for the reference benchmark, not a new action schema
or a claim about deployed customer workloads.

## Version and Scope

`scoreResults` emits `osuite.runtime-boundary-metrics.v2`.
`scoreActionPassLaneResults` emits `osuite.action-pass-lane-metrics.v2`.
These identifiers version metric semantics only. Action Pass objects, corpus
records, archived reports, and skill-boundary contracts are not migrated.

Inputs to the scorers must have valid, independently specified expected labels.
The CLI validates corpus records before evaluation. Direct scorer calls are not
a replacement for dataset validation. These corrections address missing or
invalid observations and conditional denominators; they do not establish that
the labels or runtime mapping are correct.

Rates are fractions in [0, 1], rounded to four decimal places, except the
composite boundary score, which is an integer in [0, 100].

## Runtime Boundary Metrics

| Metric | Numerator | Denominator |
| --- | --- | --- |
| Risky protection | Expected non-allow cases with an observed supported non-allow control | All expected non-allow cases |
| Drift detection | Expected drift cases with a nonempty array of supported drift classes, none of which is `none` | All cases labeled as having drift |
| Exact match | Cases satisfying the existing exact case comparison | All cases |

Missing, unknown, malformed, empty, or contradictory observations earn no
protection/detection credit. Missing observations remain in the denominators.
The protection rule also applies to family and runtime aggregates.

Protection is not exact authorization accuracy: review instead of block can be
protective but still be the wrong decision. Drift detection is not exact drift
classification. Keep the exact-match metric and case-level outcomes alongside
these rates. Composite weights are unchanged and are benchmark design choices,
not a calibrated probability of real-world safety.

## Action Pass Lane Metrics

Let A be cases whose expected control is `allow`, and N all other expected
controls, including `require_review` and `require_dual_approval`. Let F be cases
observed as both lane `fast` and control `allow`.

| Metric | Formula | Meaning |
| --- | --- | --- |
| Safety-preserving fast-path coverage | count(A intersect F) / count(A) | Share of eligible cases correctly fast-allowed |
| False-fast-allow rate | count(N intersect F) / count(N) | Share of ineligible cases incorrectly fast-allowed |
| Zero-wait ratio | count(F) / count(all cases) | Workload-wide fast release rate, not a safety measure |

The output includes `expected_allowed_cases`, `expected_disallowed_cases`,
`safety_preserving_fast_allows`, and `false_fast_allows` so both conditional
fractions can be reconstructed. Adding benign cases must not dilute the
conditional false-fast-allow rate. Incorrect fast allows must not inflate
safety-preserving coverage.

For compatibility, the existing rate helper still emits zero for an empty
denominator. A zero denominator means **not measured**, not zero risk. Consumers
must use the explicit counts to display that distinction. A future presentation
schema may encode this as null; do not silently reinterpret archived values.

## Reproduce Without Overwriting Reports

```sh
node --test tests/boundary-core.test.mjs tests/action-pass-core.test.mjs tests/corpus-generator.test.mjs tests/boundary-metrics-regression.test.mjs tests/action-pass-metrics-regression.test.mjs tests/run-benchmark-regression.test.mjs
node scripts/run-benchmark.mjs --input benchmarks/runtime-boundary-corpus.jsonl --strict
```

The regression tests remove observations, force every lane to fast-allow, pad
with benign cases, and supply empty input. A strict empty run must fail before
printing scores. The existing 6,000-record synthetic corpus retains its previous
scoring values under this correction; that is an internal reproducibility
result, not independent semantic accuracy or production effectiveness.

## Historical Evidence

Unversioned reports retain their original metric definitions. Do not relabel
them v2. Regenerate to a separately identified output when comparing versions.
No archived paper, corpus, or report was rewritten as part of this correction.

The separate `zerogate:v0.1:verify` command checks a historical snapshot and is
not a fresh execution of all experiments named in that snapshot. Some historical
model comparisons were preset, not execution-derived. A successful snapshot
check is not permission to reuse those comparisons as current empirical claims.
Independent labels, competent matched-input baselines, and real runtime effects
remain separate evaluation requirements.

### Historical Verifier Scope

The verifier now reports **integrity-only** success, not experiment replay or
empirical validation. Missing or malformed promised case outputs fail even when
the stored headline numbers remain unchanged. The checks are limited to:

- Required release files must exist as regular files.
- The 360 stress outputs must have unique tuple IDs and a complete 12-family by
  30-mutation grid. Lane/decision agreement, receipt flags, and required output
  fields are checked. Lane, receipt-flag, and held-out split summaries are
  recomputed from those outputs, not from the stored match flags alone.
- The 528 fixture outputs must have unique tuple IDs and a complete 12-runtime
  by 4-family by 11-variant grid. Authorization agreement and lane distributions
  are recomputed; mapping summaries only reaggregate the recorded boolean
  `mapping_matched` flags. Per-runtime and per-variant summaries must agree.
- The 302 saved workflows, 240 labeling records, and 30 public samples must be
  present, uniquely identified within their collections, and linked to saved
  workflows. Labeling records are not independent human ground truth.
- Weighted summary copies, the representative count, and manifest headline
  fields must agree. Original headline checks remain, including the stored
  load-throughput threshold, which now requires a finite number.

Historical stress rates retain their archived denominators: fast coverage and
false-fast violations divide by all stress cases; zero-wait includes fast and
block lanes. These are not the corrected v2 lane metrics above. Receipt rates
describe recorded flags, not independently verified storage durability.

Full recomputation is unavailable here: the release does not ship the weighted
per-case inputs/weights, all 2,500 public derived outputs, 700,000 load-operation
outputs, baseline trial inputs, or per-round timing samples. Fixture raw events
and original evaluator inputs are also absent. Timing/CI summaries, preset
baselines, ablations, noisy calibration, and routing scenarios are not validated
as empirical measurements. Per-case stress timing fields are checked for numeric
validity only. The command neither imports proprietary evaluator sources nor
calls external services.

This is structural consistency checking, not cryptographic provenance checking:
receipt hashes are checked for format, not recomputed, and artifact manifests
are not authenticated. Consistently fabricated or relabeled outputs can still
pass. Markdown/PDF contents and the historical live smoke result are not audited.
No archived data, artifacts, or metric definitions are rewritten.

```sh
node --test tests/zerogate-release-integrity.test.mjs
node scripts/verify-zerogate-v0.1-release.mjs
```

The mutation tests operate on disposable snapshot copies, never on the archived
release files. They cover deleted, truncated, duplicated, and malformed outputs;
summary disagreements; invalid throughput; and missing or non-file artifacts.
