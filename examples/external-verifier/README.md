# External Verifier Example

This example models a third-party verifier decision bound to a canonical action fingerprint.

Approved action:

```text
Verifier decision references state_hash sha256:aaa111.
```

Executed action:

```text
Runtime action references either the same state hash or a different state hash.
```

Security lesson:

```text
External proofs should bind to the action state. A valid proof for one fingerprint should not silently cover another fingerprint.
```

