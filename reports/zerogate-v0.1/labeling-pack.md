# Action Pass public runtime labeling pack

Status: pending_independent_annotation

This file is not an accuracy result. It is a frozen annotation pack intended for independent labeling. After labels are complete, runtime-to-action mapping accuracy should be reported separately from authorization-decision accuracy.

## Label schema

| Field | Meaning |
| --- | --- |
| annotator_id | string |
| intended_action_family | string |
| intended_operation | string |
| intended_effect | read|write|transfer|delete|publish|unknown |
| intended_resource | string |
| intended_destination | string|null |
| evidence_completeness | complete|partial|insufficient |
| expected_boundary_outcome | fast|slow|block|unsupported |
| confidence | high|medium|low |
| notes | string |

## Evaluation after labels

| Item | Plan |
| --- | --- |
| runtime_to_action_mapping_accuracy | Compare independently labeled intended action fields with parser output. |
| authorization_decision_accuracy | Compare independently labeled expected boundary outcome with lane decision after mapping. |
| agreement_metric | Use Cohen kappa for two annotators or Krippendorff alpha for three or more annotators before reporting accuracy. |
| freeze_rule | Labels should be frozen before parser or evaluator updates are made against this pack. |

## Records

The JSON file contains 240 records. The table below shows the first 80 for quick inspection.

| ID | Repository | Type | Parser lane | Parser status | Parser family | Source |
| --- | --- | --- | --- | --- | --- | --- |
| c28350a3b7b3d715 | microsoft/vscode | uses_action | fast | canonicalized | external_action_pinned | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-lib-package.yml |
| 76d2a364556943bc | nodejs/node | uses_action | fast | canonicalized | external_action_pinned | https://github.com/nodejs/node/blob/main/.github/workflows/auto-start-ci.yml |
| 10a699b9ed794e92 | python/cpython | uses_action | fast | canonicalized | external_action_pinned | https://github.com/python/cpython/blob/main/.github/workflows/add-issue-header.yml |
| c72cb853f8ae4d06 | rust-lang/rust | uses_action | fast | canonicalized | external_action_pinned | https://github.com/rust-lang/rust/blob/main/.github/workflows/ci.yml |
| 69751bc8185947ff | vercel/next.js | uses_action | fast | canonicalized | external_action_pinned | https://github.com/vercel/next.js/blob/canary/.github/workflows/automated_code_review.yml |
| 3e3146cba823ddac | facebook/react | uses_action | fast | canonicalized | external_action_pinned | https://github.com/facebook/react/blob/main/.github/workflows/compiler_discord_notify.yml |
| 440c4c0c65f32a9b | pytorch/pytorch | uses_action | fast | canonicalized | external_action_pinned | https://github.com/pytorch/pytorch/blob/main/.github/workflows/_binary-build-flash-attention-wheel-linux.yml |
| 57a6fbe102e34d02 | tensorflow/tensorflow | uses_action | fast | canonicalized | external_action_pinned | https://github.com/tensorflow/tensorflow/blob/master/.github/workflows/arm-cd.yml |
| 8653e24c2f843448 | huggingface/transformers | uses_action | fast | canonicalized | external_action_pinned | https://github.com/huggingface/transformers/blob/main/.github/workflows/add-model-like.yml |
| 8c90ec5e678ccfd0 | langchain-ai/langchain | uses_action | fast | canonicalized | external_action_pinned | https://github.com/langchain-ai/langchain/blob/master/.github/workflows/_compile_integration_test.yml |
| 607598322a7f47f7 | langchain-ai/langchainjs | uses_action | fast | canonicalized | external_action_pinned | https://github.com/langchain-ai/langchainjs/blob/main/.github/workflows/benchmark-tests.yml |
| 3e882bdb0f3da720 | microsoft/autogen | shell_run | fast | canonicalized | build_test_lint_shell | https://github.com/microsoft/autogen/blob/main/.github/workflows/checks.yml |
| 1d8e59a88dd9542b | microsoft/semantic-kernel | uses_action | fast | canonicalized | external_action_pinned | https://github.com/microsoft/semantic-kernel/blob/main/.github/workflows/close-inactive-issues.yml |
| 9f7c5a630d4af48a | modelcontextprotocol/servers | shell_run | fast | canonicalized | build_test_lint_shell | https://github.com/modelcontextprotocol/servers/blob/main/.github/workflows/python.yml |
| 849259d7f1977c15 | n8n-io/n8n | uses_action | fast | canonicalized | external_action_pinned | https://github.com/n8n-io/n8n/blob/master/.github/workflows/backport.yml |
| 19bc644e663d5a4b | supabase/supabase | uses_action | fast | canonicalized | external_action_pinned | https://github.com/supabase/supabase/blob/master/.github/workflows/ai-tests.yml |
| fdc24735bb821089 | grafana/grafana | uses_action | fast | canonicalized | external_action_pinned | https://github.com/grafana/grafana/blob/main/.github/workflows/actionlint.yml |
| a739c0e5afe00c19 | prometheus/prometheus | uses_action | fast | canonicalized | external_action_pinned | https://github.com/prometheus/prometheus/blob/main/.github/workflows/approve-workflows.yml |
| a122b73ee001a94b | hashicorp/terraform | uses_action | fast | canonicalized | external_action_pinned | https://github.com/hashicorp/terraform/blob/main/.github/workflows/build-terraform-cli.yml |
| 47cf096da11a01c9 | home-assistant/core | uses_action | fast | canonicalized | external_action_pinned | https://github.com/home-assistant/core/blob/dev/.github/workflows/builder.yml |
| 4952a96f6454e355 | getsentry/sentry | uses_action | fast | canonicalized | external_action_pinned | https://github.com/getsentry/sentry/blob/master/.github/workflows/acceptance.yml |
| c003136502be67aa | apache/airflow | uses_action | fast | canonicalized | external_action_pinned | https://github.com/apache/airflow/blob/main/.github/workflows/additional-ci-image-checks.yml |
| f31e8725a1c14204 | microsoft/vscode | shell_run | slow | canonicalized | general_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-lib-package.yml |
| 26e6740c7b229ef3 | nodejs/node | shell_run | slow | canonicalized | general_shell | https://github.com/nodejs/node/blob/main/.github/workflows/auto-start-ci.yml |
| a16b2a09e4d1cee9 | python/cpython | shell_run | slow | canonicalized | general_shell | https://github.com/python/cpython/blob/main/.github/workflows/build.yml |
| f2722eac672ddafd | rust-lang/rust | shell_run | slow | canonicalized | general_shell | https://github.com/rust-lang/rust/blob/main/.github/workflows/ci.yml |
| f94e8665d11204db | vercel/next.js | shell_run | slow | canonicalized | general_shell | https://github.com/vercel/next.js/blob/canary/.github/workflows/build_and_deploy.yml |
| 5899f7026a29693c | facebook/react | shell_run | slow | canonicalized | general_shell | https://github.com/facebook/react/blob/main/.github/workflows/compiler_discord_notify.yml |
| 4754a2cb3a3896a7 | pytorch/pytorch | shell_run | slow | canonicalized | general_shell | https://github.com/pytorch/pytorch/blob/main/.github/workflows/_binary-build-flash-attention-wheel-windows.yml |
| ba501aa1db599f00 | tensorflow/tensorflow | shell_run | slow | canonicalized | contextual_destructive_shell | https://github.com/tensorflow/tensorflow/blob/master/.github/workflows/arm-cd.yml |
| b1379fe75288a11d | huggingface/transformers | shell_run | slow | canonicalized | contextual_destructive_shell | https://github.com/huggingface/transformers/blob/main/.github/workflows/add-model-like.yml |
| 2d8149e26ff3bf3c | langchain-ai/langchain | shell_run | slow | canonicalized | general_shell | https://github.com/langchain-ai/langchain/blob/master/.github/workflows/_compile_integration_test.yml |
| 0930eb657edfc62d | langchain-ai/langchainjs | shell_run | slow | canonicalized | general_shell | https://github.com/langchain-ai/langchainjs/blob/main/.github/workflows/benchmark-tests.yml |
| eaceed556cb0dc5a | microsoft/autogen | uses_action | slow | canonicalized | external_action_mutable | https://github.com/microsoft/autogen/blob/main/.github/workflows/checks.yml |
| 4a7ae3c6cf828e32 | microsoft/semantic-kernel | shell_run | slow | canonicalized | general_shell | https://github.com/microsoft/semantic-kernel/blob/main/.github/workflows/devflow-pr-review.yml |
| 2b220f1edad0989c | modelcontextprotocol/servers | uses_action | slow | canonicalized | external_action_mutable | https://github.com/modelcontextprotocol/servers/blob/main/.github/workflows/claude.yml |
| 6af3ceecfbbccbce | n8n-io/n8n | shell_run | slow | canonicalized | general_shell | https://github.com/n8n-io/n8n/blob/master/.github/workflows/backport.yml |
| 5a61126649209d7e | supabase/supabase | shell_run | slow | canonicalized | general_shell | https://github.com/supabase/supabase/blob/master/.github/workflows/ai-tests.yml |
| 5ab12585fa80c866 | grafana/grafana | shell_run | slow | canonicalized | mutation_or_secret_shell | https://github.com/grafana/grafana/blob/main/.github/workflows/actionlint.yml |
| 603655352ca5e3e9 | prometheus/prometheus | shell_run | slow | canonicalized | general_shell | https://github.com/prometheus/prometheus/blob/main/.github/workflows/automerge-dependabot.yml |
| 6c64bb336ba44300 | hashicorp/terraform | shell_run | slow | canonicalized | general_shell | https://github.com/hashicorp/terraform/blob/main/.github/workflows/backport.yml |
| 9b609443162316a7 | home-assistant/core | uses_action | slow | canonicalized | external_action_mutable | https://github.com/home-assistant/core/blob/dev/.github/workflows/builder.yml |
| c158e0819faf1c81 | getsentry/sentry | shell_run | slow | canonicalized | general_shell | https://github.com/getsentry/sentry/blob/master/.github/workflows/acceptance.yml |
| 933f6a8e0b857bc2 | apache/airflow | shell_run | slow | canonicalized | contextual_destructive_shell | https://github.com/apache/airflow/blob/main/.github/workflows/additional-ci-image-checks.yml |
| a8e0644718d4119a | microsoft/vscode | shell_run | block | canonicalized | destructive_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-perf.yml |
| 35950594df0ac494 | vercel/next.js | shell_run | block | canonicalized | destructive_shell | https://github.com/vercel/next.js/blob/canary/.github/workflows/build_reusable.yml |
| 83b65a00ed98567a | home-assistant/core | shell_run | block | canonicalized | destructive_shell | https://github.com/home-assistant/core/blob/dev/.github/workflows/check-requirements.lock.yml |
| 564127ddcca098c2 | microsoft/vscode | shell_run | unsupported | abstained | complex_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-perf.yml |
| 73cf541418fc0e21 | nodejs/node | shell_run | unsupported | abstained | complex_shell | https://github.com/nodejs/node/blob/main/.github/workflows/author-ready-conflicts.yml |
| 77ee32b18ab4a43c | python/cpython | shell_run | unsupported | abstained | complex_shell | https://github.com/python/cpython/blob/main/.github/workflows/build.yml |
| ad0f8b9b327401a9 | rust-lang/rust | shell_run | unsupported | abstained | complex_shell | https://github.com/rust-lang/rust/blob/main/.github/workflows/ci.yml |
| 3a7ef5a33fae9e60 | vercel/next.js | shell_run | unsupported | abstained | complex_shell | https://github.com/vercel/next.js/blob/canary/.github/workflows/build_and_deploy.yml |
| dafb0644d221d9d1 | facebook/react | shell_run | unsupported | abstained | complex_shell | https://github.com/facebook/react/blob/main/.github/workflows/compiler_playground.yml |
| f640171bbd40e896 | pytorch/pytorch | shell_run | unsupported | abstained | complex_shell | https://github.com/pytorch/pytorch/blob/main/.github/workflows/_binary-build-flash-attention-wheel-linux.yml |
| fc8d5eed932128e7 | tensorflow/tensorflow | shell_run | unsupported | abstained | complex_shell | https://github.com/tensorflow/tensorflow/blob/master/.github/workflows/arm-cd.yml |
| 16b17b860ef723fb | huggingface/transformers | shell_run | unsupported | abstained | complex_shell | https://github.com/huggingface/transformers/blob/main/.github/workflows/add-model-like.yml |
| 6b5ba7649163870c | langchain-ai/langchain | uses_action | unsupported | unsupported | local_action | https://github.com/langchain-ai/langchain/blob/master/.github/workflows/_compile_integration_test.yml |
| 0ae572f76f19fdf4 | langchain-ai/langchainjs | shell_run | unsupported | abstained | complex_shell | https://github.com/langchain-ai/langchainjs/blob/main/.github/workflows/compatibility.yml |
| 7e91a5f5fa4b9fac | microsoft/autogen | shell_run | unsupported | abstained | complex_shell | https://github.com/microsoft/autogen/blob/main/.github/workflows/checks.yml |
| eabd3abf324b5670 | microsoft/semantic-kernel | uses_action | unsupported | unsupported | local_action | https://github.com/microsoft/semantic-kernel/blob/main/.github/workflows/devflow-pr-review.yml |
| 7e731b8ff38ca62e | modelcontextprotocol/servers | shell_run | unsupported | abstained | complex_shell | https://github.com/modelcontextprotocol/servers/blob/main/.github/workflows/python.yml |
| 26f9bebf3b7c809a | n8n-io/n8n | uses_action | unsupported | unsupported | local_action | https://github.com/n8n-io/n8n/blob/master/.github/workflows/backport.yml |
| 8fd241d949572778 | supabase/supabase | shell_run | unsupported | abstained | complex_shell | https://github.com/supabase/supabase/blob/master/.github/workflows/auto-label-issues.yml |
| cd7099c9591a4481 | grafana/grafana | shell_run | unsupported | abstained | complex_shell | https://github.com/grafana/grafana/blob/main/.github/workflows/actionlint.yml |
| 65f8c25b7d0294f5 | prometheus/prometheus | shell_run | unsupported | abstained | complex_shell | https://github.com/prometheus/prometheus/blob/main/.github/workflows/ci.yml |
| ee963d8a6063ab37 | hashicorp/terraform | shell_run | unsupported | abstained | complex_shell | https://github.com/hashicorp/terraform/blob/main/.github/workflows/build-terraform-cli.yml |
| 171fab8a1f018c1a | home-assistant/core | shell_run | unsupported | abstained | complex_shell | https://github.com/home-assistant/core/blob/dev/.github/workflows/builder.yml |
| 6106f5743918ca14 | getsentry/sentry | uses_action | unsupported | unsupported | local_action | https://github.com/getsentry/sentry/blob/master/.github/workflows/acceptance.yml |
| 0101a8e6098dae36 | apache/airflow | uses_action | unsupported | unsupported | local_action | https://github.com/apache/airflow/blob/main/.github/workflows/additional-ci-image-checks.yml |
| 8f96d60ecbe00b99 | microsoft/vscode | shell_run | fast | canonicalized | build_test_lint_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-lib-package.yml |
| 99b423333f85f7a8 | prometheus/prometheus | uses_action | slow | canonicalized | container_action | https://github.com/prometheus/prometheus/blob/main/.github/workflows/prombench.yml |
| e731edd1d6a78d63 | microsoft/vscode | shell_run | slow | canonicalized | contextual_destructive_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-perf.yml |
| b6a346b9794e5264 | nodejs/node | uses_action | unsupported | unsupported | external_action | https://github.com/nodejs/node/blob/main/.github/workflows/build-tarball.yml |
| 5f7af92483cab3ad | vercel/next.js | uses_action | slow | canonicalized | external_action_mutable | https://github.com/vercel/next.js/blob/canary/.github/workflows/pull_request_auto_label.yml |
| d53d9f1651df7b43 | microsoft/vscode | uses_action | unsupported | unsupported | local_action | https://github.com/microsoft/vscode/blob/main/.github/workflows/component-fixtures.yml |
| 0c485b2edce325b8 | python/cpython | shell_run | slow | canonicalized | mutation_or_secret_shell | https://github.com/python/cpython/blob/main/.github/workflows/jit.yml |
| 768bc4b085d2621f | microsoft/vscode | uses_action | fast | canonicalized | external_action_pinned | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-lib-package.yml |
| 9e74f3099ef1c199 | microsoft/vscode | shell_run | slow | canonicalized | general_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-lib-package.yml |
| 7b5478e1d6a0883a | microsoft/vscode | shell_run | fast | canonicalized | build_test_lint_shell | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-lib-package.yml |
| c3d4d7acf3fde745 | microsoft/vscode | uses_action | fast | canonicalized | external_action_pinned | https://github.com/microsoft/vscode/blob/main/.github/workflows/chat-perf.yml |
