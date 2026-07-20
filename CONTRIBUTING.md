# Contributing

Thank you for helping improve the Agent Action Boundary Benchmark.

This project welcomes practical cases, runtime adapters, documentation fixes, and report improvements.

## Good Contributions

Good issues or pull requests usually include:

- a concrete agent runtime scenario
- an approved action
- an executed action
- the expected drift classes
- the expected control outcome
- enough explanation for a security reviewer to understand the boundary

## Adding A Benchmark Case

Add one JSON object per line to:

```text
benchmarks/approval-execution-drift.jsonl
```

Then run:

```bash
npm test
npm run report
```

The case should pass before opening a pull request.

## Case Writing Rules

Use synthetic data only.

Do not include:

- real customer names
- real API keys
- real credentials
- production account IDs
- private incident details
- personal data

Prefer examples that make the boundary obvious:

- read becomes publish
- demo resource becomes production resource
- internal note becomes external email
- draft recommendation becomes ledger mutation
- approved state hash differs from executed state hash

## Pull Request Checklist

- [ ] The benchmark passes with `npm test`.
- [ ] New cases use synthetic data.
- [ ] The expected drift classes are explained in the case description.
- [ ] Documentation was updated if behavior changed.

