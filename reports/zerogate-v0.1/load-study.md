# ZeroGate Action Pass Concurrent Load Study

This run exercises the real `buildActionPass` and `evaluateActionPassCommit` implementation path from `packages/cava-core`. The workload inputs are synthetic so that the run is reproducible, but lane decisions, receipts, replay checks, slot-conflict handling, and authority checks are produced by the package code under concurrent worker load.

## Configuration

- Workers: 14
- Operations per worker: 50000
- Total operations: 700000
- Node: v22.18.0
- Platform: darwin arm64
- CPU: Apple M4 Pro

## Results

- Throughput: 64925.28 ops/s
- Latency per operation: p50=0.08025ms, p95=0.18375ms, p99=0.475083ms, max=36.425584ms
- Expected lane match: 1
- False allow rate: 0
- Receipt object constructed rate: 1
- Receipt persisted-before-commit rate: 0.986723
- Receipt completeness (persisted): 0.986723
- Partial commit without receipt: 0

## FeliCa/Suica-Inspired Checks

- Duplicate nonce block rate: 1
- Same-slot conflict slow-review rate: 1
- Missing receipt sink block rate: 1
- Receipt-not-persisted block rate: 1
- Missing authority evidence slow-review rate: 1
- Holder mismatch block rate: 1
- Runtime session mismatch block rate: 1
- Pass revocation block rate: 1
- Revocation epoch drift slow-review rate: 1
- State predicate drift slow-review rate: 1
- Aggregate budget exhaustion block rate: 1
- Privacy boundary exposure slow-review rate: 1

## Important Boundary

This is a real implementation load study, not live customer production traffic. It should be used as evidence that the published evaluator path can sustain a short local commit decision under concurrent load, not as a claim about every deployed OSuite topology or external SaaS side effect.
