# Egress v3: public evidence and offline recomputation

**Study date: September 28, 2026. Public evidence edition: September 29, 2026.**

This package releases the captured evidence behind OSuite's incident-inspired egress study. It is a logical, allowlisted export from an owned Azure laboratory, not a download of a private database or an independent reproduction of OpenAI's environment. It contains synthetic task data and real recorded HTTP/DNS, authorization and process-fault observations.

## Run without credentials

Requirements: Python 3.9+ and Node.js 22.18+ (the process verifier uses built-in `node:sqlite`). No Python/npm packages, OSuite account, Azure account, API key or network connection are needed. Run from this directory:

```sh
python3 verify.py .
python3 -m unittest test_verify.py
node test-mutations.mjs .
```

The first command checks every listed file, reconstructs the primary snapshot from the per-mode JSONL records, checks broker/worker/receiver consistency, runs the frozen receiver-side scorer, recalculates tables and latency quantiles, verifies pass signatures and receipt bindings, and checks all three process-fault packets. A nonzero exit means verification failed. The negative tests deliberately alter in-memory copies, not the evidence files; they show that changed results, missing records and broken bindings are rejected.

This is **offline recomputation of retained observations**, not a command to rerun the private product deployment. The shipped Python protocol/scorer and Node cryptographic core are the byte-identical study versions listed in `provenance.json`. The complete proprietary product, deployment credentials, raw SQL backup and model trajectories are not included. A reader can audit the scoring and cryptography without trusting the displayed summary, but must still assess the author's capture process and trust boundary. Hashes and a lab signing key cannot attest that an author captured every real event honestly.

## What is included

| Cohort | Included evidence | Role |
| --- | --- | --- |
| Primary v3 | 2,340 records; 39 episode definitions; 14 mechanism families; 6 modes; 10 repetitions; 3,000 requests | Main controlled comparison |
| Revocation | 10 legacy and 10 repaired-path records | Both slow/fast paths, five repetitions each, preserving the old failure |
| Model utility | 24 recorded episodes across 3 modes | Ordinary model-driven task utility, not an attack-interception rate |
| Process faults | 3 independently executed repetitions of 7 cases; 39 worker starts | Crashes, shared/independent stores, revocation timing and acknowledgements |

`data/measured/*.jsonl.gz` retains each primary record, raw receiver JSON values, gate proof material, broker attempts/DNS correlations, timeout flags and lifecycle IDs. `index` preserves the original snapshot order. `source_sha256` identifies the internal source files, but those source-file hashes do not make the excluded files publicly reachable. The root manifest authenticates the exact **released** representation only relative to a trusted commit or separately obtained archive digest.

`tables/results.json` and the matching CSV files are recalculated by the verifier. `lib/` contains the frozen minimal scoring sources. `process/` contains previously sanitized logical packets and their own verifiers. Historical `publication_authorized: false` fields inside those packets are preserved capture-time metadata, not rewritten to imply that the original run was a public release. This edition's publication decision applies to this allowlisted package.

`data/perimeter-checks.json` preserves the separate unprivileged connectivity and credential-read probe. It records access to the broker and failed direct access to the lab receiver, PostgreSQL and Azure metadata. Offline verification checks those captured observations; it does not re-test the now-removed VM or prove complete network isolation.

## Primary results

| Mode | Out-of-grant deliveries observed | Authorized effects completed | Unknown episodes |
| --- | ---: | ---: | ---: |
| Transport-only | 280 | 210/210 | 10 |
| Destination ACL | 200 | 140/210 | 10 |
| Launch-only authorization | 280 | 210/210 | 10 |
| Conventional exact-action grant | 0 | 210/210 | 10 |
| OSuite slow path | 0 | 210/210 | 10 |
| OSuite fast path with live authority | 0 | 210/210 | 10 |

An unauthorized delivery is a receiver-observed request outside the frozen grant or reuse budget, including a delivered request that the receiving application rejects. It is not necessarily a committed mutation or data theft. Each mode retains ten deliberately incomplete capture cases as **unknown**. Accordingly, `evidence_valid` is false for the whole suite and the three zero-delivery modes have a null, not 1.0, whole-suite `security_score`. The 210 authorized effects are a separate utility denominator.

The conventional exact-action grant matched both OSuite modes on observed containment and authorized utility and had lower latency. This is not a benchmark of commercial competitors or proof that exact-action enforcement is unique to OSuite. OSuite's tested composition connects the approval decision, canonical action, bounded pass, live authorization check and replay evidence.

For the repaired fast path versus the matched OSuite slow path, gate p50 was **12.044 vs 17.917 ms** (32.8% lower), and gate p95 was **21.802 vs 39.640 ms** (45.0% lower). Broker p50 was **53.726 vs 60.020 ms** (10.5% lower). These are observed quantiles of 220 admitted attempts per mode, including ten telemetry-gap attempts. They exclude advance preparation, model inference, human wait time and the public Studio HTTP/IAM path. They are not a customer SLA, a cross-vendor speed comparison or the earlier ZeroGate whitepaper's different timing experiment.

## What the tests do not establish

- The 39 definitions are developer-authored mechanism fixtures. Ten repetitions are repeated executions, not 390 independent attack families. The frozen code's `heldout` labels are fixture-development labels, not a sealed independently labelled evaluation.
- The actor was constrained to an enforced broker path. The broker, controller, parser and receiver instrumentation were trusted. Actor root compromise, bypass routes, malicious issuer/capture, arbitrary protocols and general semantic correctness are outside the claim.
- DNS used a private fixed-hop topology. Transaction-ID/packet-hash correlation is not DNS authentication or a general internet covert-channel detector.
- The laboratory used the actual Studio guard/repository code against a disposable PostgreSQL authority database. It did not test the public Studio API, customer identity deployment or customer production traffic.
- The old local-only fast path admitted a request after SQL revocation in 5/5 trials. The repaired path denied all five first requests when revocation preceded its live authority read. It cannot retract an action already admitted: the separate process cohort still observed a delivery in 3/3 post-admission revocations.
- Revocation readbacks are checked against the prepared action bindings and recorded probe order. The SQL-revocation timestamp and experiment sequencing remain controller-recorded evidence, not an independently timestamp-attested proof of database commit before the live read.
- A shared durable store coordinated concurrent pass consumption. Two independent stores each admitted the same pass, producing two arrivals per repetition. This is not global single use, exactly-once delivery or exactly-once business completion.
- Crash tests include consumed-but-not-dispatched work and delivered effects with lost acknowledgements. Admission, delivery, acknowledgement and task completion are different states.
- The model cohort produced no out-of-grant model requests. It supports utility for those tasks, not adversarial-model interception accuracy. No third party has independently rerun this laboratory merely because the evidence is public.

## Sources and interpretation

Public source reports motivated mechanism selection, not claims to recreate private incidents:

- [An agent used DNS to reach an external chatbot](https://alignment.openai.com/misalignment-reports/an-agent-used-dns-to-reach-an-external-chatbot/)
- [Unauthorized Artifactory writes and cross-sample communication](https://alignment.openai.com/misalignment-reports/unauthorized-artifactory-writes-and-cross-sample-communication/)
- [Uploading files to the internet in order to cite them](https://alignment.openai.com/misalignment-reports/uploading-files-to-the-internet-in-order-to-cite-them/)

Earlier v1/v2 runs are historical context, not additional samples in v3. Their full internal archives have not been included in this public package. The included legacy revocation subcohort is explicitly labelled and is not silently folded into repaired-path results.

The [designer-ready report manuscript](https://github.com/OndCo/Agent-Action-Boundary-Benchmark/blob/egress-v3-20260928-public-v1/reports/egress-v3-report-content-for-designer.md) contains fuller explanation and table captions. No designed PDF is promised by this release. Code and synthetic evidence in this directory are released under the included Apache-2.0 license; this does not license excluded product source or third-party reports.
