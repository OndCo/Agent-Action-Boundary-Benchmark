# Draft Email: Skill Boundary v3 Follow-Up

Subject: Skill boundary v3 one-page summary

Dear Shuwen and Prof. Polyzos,

Thank you, this is very helpful. I agree that the next step should be to freeze the core semantics and evaluation protocol before expanding the benchmark.

I prepared a short one-page v3 summary here:

https://github.com/OndCo/Agent-Action-Boundary-Benchmark/blob/main/docs/skill-boundary-v3-one-page-summary.md

The summary focuses on the pieces that seem most important to settle first:

- the smaller vendor-neutral skill boundary contract;
- the per-operation authority structure;
- the rule that runtime authorization may narrow, deny, or require review, but should never widen the skill-declared boundary;
- the separation between runtime-to-action mapping accuracy and authorization-decision accuracy;
- the held-out skill families and runtime mappings for the next evaluation phase.

I also kept the longer artifact and runnable report unchanged for reference:

- v3 artifact note: https://github.com/OndCo/Agent-Action-Boundary-Benchmark/blob/main/docs/skill-boundary-v3-research-artifact.md
- v3 runnable report: https://github.com/OndCo/Agent-Action-Boundary-Benchmark/blob/main/reports/skill-boundary-v3-experiment.md
- v3 machine-readable output: https://github.com/OndCo/Agent-Action-Boundary-Benchmark/blob/main/reports/skill-boundary-v3-experiment.json
- v3 schema: https://github.com/OndCo/Agent-Action-Boundary-Benchmark/blob/main/schemas/neutral-skill-boundary-contract-v3.schema.json

My current view is that the one-page summary should be the object we use for discussion, while the longer files are just supporting material. If the narrowing-only rule, held-out protocol, and metric split look right to you both, then I think the next useful step would be to jointly refine the formal semantics and expected outcomes before expanding the benchmark.

Best,
Zexun
