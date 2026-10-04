# Skill-boundary v3.1: opt-in authorization repair

Status: authored engineering development, not a frozen joint research protocol,
independent human annotation, held-out evaluation, or production execution claim.

## Compatibility and scope

Import `lib/skill-boundary-v3.1-core.mjs` explicitly to select
`skill-boundary-authorization.v3.1-development`. Existing v3 exports, schema,
case inventory and reports are unchanged. Legacy v3 still exhibits SB-01;
processing its report with a new client does not upgrade its guarantees.

This is a bounded authorization repair, not the product's
`osuite.execution_boundary.v1` execution profile. It does not implement executable
binding, dependency capture, descendant-effect closure, mandatory interception,
live revocation, durable consumption, or actual refund execution. Runtime and
execution manifests remain outside the neutral requested-authority schema.

The limited reference parser is reused. A new opt-in wrapper represents a missing
resource identifier as `null` and withholds its action fingerprint; it does not
mint a resource named `unknown`. It uses the declared resource-pattern field and
the mapper's missing-evidence list, not case names or hidden labels. Explicitly
supplied identifiers are unchanged. Other parser defaults and its narrow shell
vocabulary remain. Correct authorization on its output cannot establish that it
captured a real execution correctly. The oracle-input entry point isolates mapping
errors from that decision measurement; it does not authenticate evidence.

## Supported semantics

`authorizeNeutralActionV31({ contract, action, evidence, runtime_authorization })`
accepts an explicit neutral action and evidence status, without invoking a mapper.
An empty runtime policy means no additional restriction within this development
model. The caller is responsible for supplying authoritative policy and trustworthy
evidence; a skill's declaration or identity string is not an actual authority grant.

- Complete operation tuples are alternatives. Fields within a tuple are conjoined;
  fields from different tuples cannot be mixed to obtain permission.
- Requested and runtime maxima intersect using the smaller value. Optional
  `allowed_operations` and `allowed_principals` intersect requested sets. Empty
  intersections deny; `denied_operations` overrides permission for that operation.
- `amount_usd_lte` and `amount_usd` are USD, with at most two decimal places and
  nonnegative integer cents no greater than `Number.MAX_SAFE_INTEGER`. Comparisons
  use exact integer cents. Numeric strings, non-finite values, negative amounts,
  fractional cents and overflow are not coerced or rounded. There is no tolerance
  or FX conversion; a supplied currency other than USD blocks.
  An optional `amount_usd: undefined` placeholder from the legacy mapper is absent,
  not invalid monetary evidence for a nonmonetary operation. A requested/runtime
  amount limit or evidence requirement still makes an absent amount unresolved;
  explicitly supplied invalid values, including `null`, still require review.
- `max_records` is a nonnegative safe integer with inclusive limits, including
  zero. An `external_egress: false` restriction cannot be removed by runtime `true`.
  The five internal destination labels in the original fixture vocabulary imply
  internal egress; the two email labels imply external egress. Other destinations
  need explicit boolean `parameters.external_egress` evidence when egress is capped.
  A known external destination takes precedence over a supplied `false` egress flag.
  These are semantic labels, not observations of actual network traffic.
- Resource matching supports only one literal namespace followed by one identifier,
  such as `refund_case/{case_id}`. Identifiers contain ASCII letters, digits, `_`
  or `-`. Traversal, percent-encoded aliases, extra path segments and empty IDs do
  not match. Unsupported resource-pattern semantics reject configuration.
- Runtime `required_evidence[operation]` is unioned with the tuple's requirements.
  Evidence may have status `complete` or `missing`, with a `missing_fields` array.
  Absent, ambiguous, contradictory, untrusted or unmapped evidence requires review.
  Missing numeric fields also require review even if metadata claims completeness.

Precedence: invalid configuration produces `block` with
`outcome: invalid_configuration`; a resolved applicable denial or demonstrated
boundary violation blocks even when unrelated required evidence is missing;
otherwise uncertainty requires review; only a complete matching tuple allows.
An explicit runtime denial for a known operation is checked before evidence
metadata validation. Missing or invalid action/operation evidence still requires
review unless the runtime context alone already establishes an empty authority set.
Untrusted action evidence cannot by itself establish a tuple violation. A review
or invalid-configuration result does not authorize execution. This module only
returns decisions; it does not enforce them on an external runtime.

The supported constraint vocabulary is exactly `amount_usd_lte`, `max_records`,
and `external_egress`. Unsupported runtime keys/constraints and malformed bounds
reject configuration instead of becoming unrestricted. Ranges, implicit currency
conversion, aggregate budgets and atomic multi-action workflows are not supported.
Empty-intersection tests here cover operation/principal sets, not an invented
range extension to the frozen v3 schema.

## Measurements and labels

The runner declares neutral oracle actions, evidence status and expected control
directly in source. It never uses the mapper, `runtimeArgs`, `materializeAction`,
or the evaluated authorizer to construct expected answers. These labels are still
locally authored development judgments, not independent human ground truth.

There are 48 legacy development representations plus four SB-01 widening variants:
52 runtime records, based on 12 legacy scenario groups and one policy variant.
Repeating an oracle across four runtimes does not create four independent labels.
No held-out family/mapping cases are opened, changed or added.

The raw report separates mapping correctness, oracle-input authorization, and
mapped end-to-end decisions. Mapping compares declared neutral fields and evidence
status, not runtime-specific metadata or `source_action_key`. A missing document
ID is hand-labeled as an unresolved resource (`null`), rather than a real document
named `unknown`. The first separated report measured mapping at 48/52 while both
decision tracks were 52/52. That report is retained. The new wrapper addresses
this observed discrepancy without changing any expected label. Its final score
must be taken from a newly executed report, not assumed from the fix.

Decision matrices and false-allow/block/review counts include explicit denominators.
Configuration errors and missing predictions are separate score outcomes, not
automatically correct blocks. `scoreDevelopmentRecords` recomputes scores from
raw records without calling the evaluated mapper or authorizer. Runtime predictions
receive an input allowlist, not case names, expected outcomes, or oracle comments.

## Commands and evidence

```sh
node --test tests/skill-boundary-v3.1-core.test.mjs
node --test tests/skill-boundary-v3-core.test.mjs tests/skill-boundary-v3.1-core.test.mjs
node scripts/run-skill-boundary-v3.1-experiment.mjs
```

The runner writes only a new timestamped
`reports/skill-boundary-v3.1-development-<timestamp>.json`, using exclusive creation.
It cannot select or overwrite a v3 report. `--stdout` emits the same raw JSON without
creating a report. Reports include SHA-256 identities for the legacy mapper, new
source, test file and this scope note; hashes are provenance, not attestation.

TDD red observation: the initial new test file called unchanged v3 and ran four
SB-01 assertions. All four failed with observed `allow` versus expected `block`.
The test then switched to the opt-in v3.1 entry point before repair implementation.
Green verification and generated reports must be recorded from actual runs, not
inferred from the presence of this document. No joint approval, held-out accuracy,
or live execution guarantee follows from passing these development tests.
