# MCP Tool Call Example

This example models an MCP server call that preserves the operation name but changes the affected resource.

Approved action:

```text
Read demo customer profile customer/demo-0001.
```

Executed action:

```text
Read production customer profile customer/prod-8842.
```

Security lesson:

```text
Tool-call governance needs resource binding, not only tool-name allowlists.
```

