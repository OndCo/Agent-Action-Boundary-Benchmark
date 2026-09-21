# ZeroGate v0.1 Research Release

ZeroGate is the Action Pass lane in the Agent Action Boundary Benchmark. It tests a simple research question: can agent governance preserve action-boundary safety while moving the ordinary commit decision out of a remote approval loop?

The release is intentionally split into runnable code and frozen evidence. The lightweight runner in this repository can be executed with `npm run action-pass:lanes`. The larger snapshot in `reports/zerogate-v0.1/` contains the artifact used for the ZeroGate paper and claim-boundary review.

## What This Release Includes

| Artifact | Path |
| --- | --- |
| Paper PDF | `papers/zerogate-v0.1/zerogate-action-pass.pdf` |
| Claim and dataset audit | `docs/zerogate-v0.1/dataset-audit.md` |
| Action Pass schema note | `docs/zerogate-v0.1/action-pass-schema.md` |
| FeliCa/Suica design notes | `docs/zerogate-v0.1/felica-suica-design-notes.md` |
| Governance landscape notes | `docs/zerogate-v0.1/agent-governance-landscape-notes.md` |
| Main fast/slow/block benchmark | `reports/zerogate-v0.1/fast-slow-benchmark.json` |
| Concurrent load study | `reports/zerogate-v0.1/load-study.json` |
| Public runtime corpus | `reports/zerogate-v0.1/public-runtime-corpus.json` |
| Independent-labeling pack | `reports/zerogate-v0.1/labeling-pack.json` |
| Multi-runtime fixture corpus | `reports/zerogate-v0.1/multi-runtime-fixture.json` |
| Hosted Studio smoke canary | `reports/zerogate-v0.1/live-studio-smoke.json` |

## Headline Snapshot

| View | Result |
| --- | ---: |
| Weighted synthetic common-case observations | 5,760 |
| Adversarial stress cases | 360 |
| Action families | 12 |
| Mutation classes | 30 |
| Weighted exact lane match | 1.0000 |
| Weighted false-allow / violation rate | 0 |
| Weighted fast-path coverage | 0.7500 |
| Zero-wait ratio | 0.8771 |
| Public workflow files | 302 |
| Public action-like records | 2,500 |
| Public canonicalization coverage | 0.8236 |
| Public abstain or unsupported rate | 0.1764 |
| Multi-runtime fixture cases | 528 |
| Runtime surfaces in fixture | 12 |
| Concurrent load-study operations | 700,000 |
| Concurrent load-study throughput | 64,925.28 ops/s |
| Load-study false allow rate | 0 |
| Partial commits without receipt | 0 |

## How To Verify The Snapshot

```bash
npm install
npm run zerogate:v0.1:verify
```

The verifier checks that the public release contains the expected report files and that the stored JSON metrics match the release claims.

## How To Run The Lightweight Reference Benchmark

```bash
npm run action-pass:lanes
```

This runner is deliberately smaller than the paper artifact. It exists so readers can inspect the Action Pass object model and lane behavior without needing the full OSuite monorepo.

## Claim Boundary

This release is not a customer production SLA claim. It separates four kinds of evidence:

- Synthetic and fixture tests check whether the reference semantics are implemented consistently.
- Public GitHub Actions records measure parser coverage, abstention, and unsupported surfaces, not semantic accuracy.
- The load study exercises the real local evaluator path under concurrency, not hosted network latency or external SaaS execution.
- Production-path canaries show live hosted action recording and external verifier/SaaS side-effect binding, not broad customer traffic distribution.

The strongest current claim is structural: a bounded Action Pass can preserve a full-governance decision at the runtime boundary while allowing the common commit path to be checked locally.
