# Live Studio Smoke Check

This file records a narrow production-reachability check for the ZeroGate / Action Pass work.

It is intentionally not part of the latency benchmark. The benchmark and load study measure the local Action Pass evaluator path. This smoke check only verifies that the hosted OSuite Studio action-recording path accepts and persists a low-risk research record.

## Scope

| Item | Value |
| --- | --- |
| Studio base URL | `https://studio.osuite.ai` |
| Runtime adapter | `codex_hooks` |
| Agent ID | `codex-runtime` |
| Operation | Create and read back a completed low-risk research action record |
| External side effect | None beyond the internal OSuite action record |
| Auth material | Redacted; provided through `OSUITE_API_KEY` |

## Observed result

| Check | Result |
| --- | --- |
| `osuite status` Studio health | `HTTP 200` |
| `POST /api/actions` | `201` |
| `GET /api/actions/{action_id}` | `200` |
| Persisted status | `completed` |
| Persisted action type | `research` |
| Persisted agent | `codex-runtime` |
| Action ID | `act_86a9196a-e40d-463f-8a4d-5fff1a0b4070` |

## Interpretation

This proves the live hosted action-recording path is reachable and can persist a bounded research action record from the configured runtime. It does not prove customer production throughput, gate latency, external SaaS execution, or Action Pass enforcement inside a third-party runtime.

For Action Pass performance and correctness, use:

- `latest.json` and `latest.md` for the deterministic fast/slow/block benchmark.
- `load-study.json` and `load-study.md` for the concurrent implementation load study over `packages/cava-core`.
