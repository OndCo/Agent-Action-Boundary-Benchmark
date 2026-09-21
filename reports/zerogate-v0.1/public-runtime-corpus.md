# Action Pass public runtime corpus

This report is generated from real public GitHub Actions workflow files. It is not customer production traffic and does not contain independent semantic labels. It is used to measure parser coverage, abstention, unsupported cases, and routing distribution on non-synthetic runtime artifacts.

## Summary

| Metric | Value |
| --- | ---: |
| Source repositories | 28 |
| Workflow files | 302 |
| Action-like records | 2500 |
| Canonicalized records | 2059 |
| Abstain or unsupported records | 441 |
| Canonicalization success rate | 0.8236 |
| Abstain or unsupported rate | 0.1764 |
| Fast lane rate | 0.3848 |
| Slow lane rate | 0.4372 |
| Block lane rate | 0.0016 |
| Unsupported lane rate | 0.1764 |
| Measured semantic accuracy | null |
| Measured false-allow rate | null |

## Source manifest

| Field | Value |
| --- | --- |
| Snapshot file | source-workflows.json |
| Snapshot sha256 | 349b3b7b233e929fc32b27341af194a5542feefe797dba867305caca946c0239 |
| Records sha256 | 7a9db3e06e4f67c2c4892f1b6676769d6741bbd29341d7378b640a2cc1733fea |
| Fetch timestamp | 2026-09-20T22:38:25.301Z |
| Repositories requested | 30 |
| Repositories with workflow files | 28 |
| Record limit | 2500 |
| File limit per repo | 12 |

## Independent labeling pack

| Field | Value |
| --- | --- |
| Status | pending_independent_annotation |
| Records | 240 |
| JSON file | labeling-pack.json |
| Markdown file | labeling-pack.md |
| JSON sha256 | 6ff7b7493928b3bd1d807800838ba40d0968de922368307c67903d5337811083 |

## Confidence intervals

| Metric | Estimate | Wilson 95% CI |
| --- | ---: | --- |
| Canonicalization success | 0.8236 | 0.808165--0.838042 |
| Abstain or unsupported | 0.1764 | 0.161958--0.191835 |
| Fast lane | 0.3848 | 0.365918--0.404036 |
| Slow lane | 0.4372 | 0.417866--0.456726 |
| Unsupported lane | 0.1764 | 0.161958--0.191835 |

## Repository-level split

| Split | Repositories | Records | Canonicalization | Abstain/unsupported | Fast | Slow | Unsupported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Reference | 16 | 1785 | 0.807843 | 0.192157 | 0.367507 | 0.438655 | 0.192157 |
| Held-out | 6 | 715 | 0.862937 | 0.137063 | 0.427972 | 0.433566 | 0.137063 |

Held-out repositories: facebook/react, home-assistant/core, huggingface/transformers, langchain-ai/langchainjs, microsoft/semantic-kernel, modelcontextprotocol/servers

## Repository coverage

| Repository | Workflow files | Records | Canonicalization | Abstain/unsupported |
| --- | ---: | ---: | ---: | ---: |
| apache/airflow | 12 | 7 | 0.714286 | 0.285714 |
| facebook/react | 12 | 114 | 0.95614 | 0.04386 |
| getsentry/sentry | 12 | 164 | 0.768293 | 0.231707 |
| grafana/grafana | 12 | 86 | 0.627907 | 0.372093 |
| hashicorp/terraform | 11 | 83 | 0.795181 | 0.204819 |
| home-assistant/core | 12 | 323 | 0.829721 | 0.170279 |
| huggingface/transformers | 12 | 71 | 0.901408 | 0.098592 |
| langchain-ai/langchain | 12 | 108 | 0.75 | 0.25 |
| langchain-ai/langchainjs | 12 | 69 | 0.971014 | 0.028986 |
| microsoft/autogen | 12 | 226 | 0.955752 | 0.044248 |
| microsoft/semantic-kernel | 12 | 77 | 0.714286 | 0.285714 |
| microsoft/vscode | 12 | 293 | 0.716724 | 0.283276 |
| modelcontextprotocol/servers | 5 | 61 | 0.885246 | 0.114754 |
| n8n-io/n8n | 12 | 50 | 0.64 | 0.36 |
| nodejs/node | 12 | 75 | 0.693333 | 0.306667 |
| prometheus/prometheus | 12 | 129 | 0.945736 | 0.054264 |
| python/cpython | 12 | 155 | 0.909677 | 0.090323 |
| pytorch/pytorch | 12 | 78 | 0.730769 | 0.269231 |
| rust-lang/rust | 3 | 44 | 0.886364 | 0.113636 |
| supabase/supabase | 12 | 83 | 0.86747 | 0.13253 |

## Lane distribution

| Lane | Records |
| --- | ---: |
| block | 4 |
| fast | 962 |
| slow | 1093 |
| unsupported | 441 |

## Canonicalization status

| Status | Records |
| --- | ---: |
| abstained | 299 |
| canonicalized | 2059 |
| unsupported | 142 |

## Action families

| Family | Records |
| --- | ---: |
| build_test_lint_shell | 67 |
| complex_shell | 299 |
| container_action | 4 |
| contextual_destructive_shell | 37 |
| destructive_shell | 4 |
| external_action | 25 |
| external_action_mutable | 244 |
| external_action_pinned | 895 |
| general_shell | 724 |
| local_action | 117 |
| mutation_or_secret_shell | 84 |

## Sample records

| Repository | Type | Lane | Status | Family | Reason |
| --- | --- | --- | --- | --- | --- |
| microsoft/vscode | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| nodejs/node | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| python/cpython | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| rust-lang/rust | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| vercel/next.js | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| facebook/react | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| pytorch/pytorch | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| tensorflow/tensorflow | uses_action | fast | canonicalized | external_action_pinned | external action uses immutable sha ref |
| microsoft/vscode | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| nodejs/node | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| python/cpython | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| rust-lang/rust | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| vercel/next.js | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| facebook/react | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| pytorch/pytorch | shell_run | slow | canonicalized | general_shell | shell command is action-like but not confidently low-risk |
| tensorflow/tensorflow | shell_run | slow | canonicalized | contextual_destructive_shell | context-dependent destructive-looking shell command requires review rather than automatic block |
| microsoft/vscode | shell_run | block | canonicalized | destructive_shell | literal destructive shell command requires fail-closed handling |
| vercel/next.js | shell_run | block | canonicalized | destructive_shell | literal destructive shell command requires fail-closed handling |
| home-assistant/core | shell_run | block | canonicalized | destructive_shell | literal destructive shell command requires fail-closed handling |
| microsoft/vscode | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| nodejs/node | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| python/cpython | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| rust-lang/rust | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| vercel/next.js | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| facebook/react | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| pytorch/pytorch | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| tensorflow/tensorflow | shell_run | unsupported | abstained | complex_shell | complex shell control flow needs a stronger shell parser before safe local pass consumption |
| microsoft/vscode | shell_run | fast | canonicalized | build_test_lint_shell | build/test/lint command is locally classifiable and has no obvious external mutation signal |
| prometheus/prometheus | uses_action | slow | canonicalized | container_action | container action needs supply-chain and image-digest review |
| microsoft/vscode | shell_run | slow | canonicalized | contextual_destructive_shell | context-dependent destructive-looking shell command requires review rather than automatic block |

## Claim boundary

This corpus should not be used to claim 100% accuracy. Without independent human labels, it can only support coverage, abstention, routing-distribution, and unsupported-surface claims. Accuracy and false-allow claims remain limited to the deterministic stress oracle.

## Dataset limitations

- The corpus is GitHub Actions only; it does not represent browser, MCP, SaaS, shell, or wallet traffic broadly.
- Repository selection is intentionally public and reproducible, not random over all GitHub repositories.
- Workflow records are action-like runtime artifacts, not independently labeled semantic ground truth.
- Parser coverage is measured; semantic correctness and false-allow rate are intentionally left null until independent labels are available.
- The stratified sample table is for auditability, not for estimating corpus-wide rates.
