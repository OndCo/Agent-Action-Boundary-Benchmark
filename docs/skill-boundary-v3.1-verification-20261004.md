# Skill-boundary v3.1: local verification, 4 October 2026

Status: authored development evidence, not a jointly frozen protocol, independent
human annotation, held-out evaluation, deployment or publication announcement.

## Preserved results

| Report | Mapping | Oracle-input authorization | Full pipeline |
| --- | ---: | ---: | ---: |
| [Initial separated measurement](../reports/skill-boundary-v3.1-development-2026-10-04T16-52-36-056Z.json) | 48/52 | 52/52 | 52/52 |
| [After unresolved-resource repair](../reports/skill-boundary-v3.1-development-2026-10-04T20-18-53-139Z.json) | 52/52 | 52/52 | 52/52 |

Both reports remain unchanged. Their source manifests describe the files at each
measurement, not a promise that every current working file matches both versions.
Original v3 source, schema and report are also unchanged.

The 52 records represent 13 oracle/authorization contexts across four runtime
lanes. They are not 52 independent semantic labels. The expected controls are
12 allow, 32 block and eight review. The final full pipeline has zero false
allows among 40 required non-admissions, zero false blocks among 12 expected
allows and eight correct reviews among eight expected reviews. No external
business action is executed by this runner.

## Repair and checks

The initial mapper rendered an absent document identifier as `document/unknown`.
That was not a resolved target, even though authorization correctly requested
review. The v3.1 wrapper now reports `null` and clears the action fingerprint.
It derives missing fields from the operation schema rather than hidden case IDs
or expected labels. Four targeted regressions cover the four runtime lanes.

The combined v3/v3.1 suite passed 69 tests:

```sh
node --test tests/skill-boundary-v3-core.test.mjs tests/skill-boundary-v3.1-core.test.mjs
node scripts/run-skill-boundary-v3.1-experiment.mjs
```

The second command writes a new dated report; it does not replace the two linked
reports. Tests also cover runtime narrowing, explicit denial, unsupported
constraints, incomplete evidence and independent scorer fault injection.

## Research boundary

See the [development scope](skill-boundary-v3.1-development.md). Reference actions
are constructed separately from the mapper, but still by the same engineering
effort. External labels, adjudication, a joint semantic freeze and genuinely
unseen skill/runtime holdouts remain to be established with collaborators.
Cross-runtime agreement alone is not correctness. No joint-paper or customer
production claim follows from these development results.
