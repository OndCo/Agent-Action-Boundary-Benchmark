# Action Pass multi-runtime fixture corpus

This fixture corpus checks whether a vendor-neutral skill boundary can be projected into multiple runtime event shapes and then consumed by the same Action Pass commit evaluator. It is a fixture, not a public empirical corpus and not customer traffic.

## Summary

| Metric | Value |
| --- | ---: |
| Cases | 528 |
| Runtimes | 12 |
| Skill families | 4 |
| Variants per family/runtime | 11 |
| Runtime-to-action mapping accuracy | 1 |
| Authorization-decision accuracy | 1 |

## Lane distribution

| Lane | Count |
| --- | ---: |
| fast | 96 |
| slow | 144 |
| block | 288 |

## Runtime split

| Runtime | Cases | Mapping accuracy | Authorization accuracy |
| --- | ---: | ---: | ---: |
| mcp_tool_call | 44 | 1 | 1 |
| sdk_call | 44 | 1 | 1 |
| shell_command | 44 | 1 | 1 |
| workflow_node | 44 | 1 | 1 |
| browser_dom_action | 44 | 1 | 1 |
| saas_api | 44 | 1 | 1 |
| web3_transaction | 44 | 1 | 1 |
| a2a_message | 44 | 1 | 1 |
| agent_harness_hook | 44 | 1 | 1 |
| dify_workflow | 44 | 1 | 1 |
| n8n_workflow | 44 | 1 | 1 |
| deepseek_harness_plugin | 44 | 1 | 1 |

## Variant split

| Variant | Cases | Mapping accuracy | Authorization accuracy |
| --- | ---: | ---: | ---: |
| equivalent_projection | 48 | 1 | 1 |
| runtime_narrows_authority | 48 | 1 | 1 |
| policy_digest_drift | 48 | 1 | 1 |
| state_predicate_missing | 48 | 1 | 1 |
| privacy_boundary_exposed | 48 | 1 | 1 |
| resource_substitution | 48 | 1 | 1 |
| destination_widening | 48 | 1 | 1 |
| operation_widening | 48 | 1 | 1 |
| holder_session_mismatch | 48 | 1 | 1 |
| receipt_sink_unavailable | 48 | 1 | 1 |
| ambiguous_runtime_evidence | 48 | 1 | 1 |

## First 48 cases

| Runtime | Family | Variant | Expected | Observed | Reason |
| --- | --- | --- | --- | --- | --- |
| mcp_tool_call | refund_boundary | equivalent_projection | fast | fast | local_commit_satisfied |
| mcp_tool_call | refund_boundary | runtime_narrows_authority | fast | fast | local_commit_satisfied |
| mcp_tool_call | refund_boundary | policy_digest_drift | slow | slow | policy_digest_drift |
| mcp_tool_call | refund_boundary | state_predicate_missing | slow | slow | state_predicate_evidence_missing |
| mcp_tool_call | refund_boundary | privacy_boundary_exposed | slow | slow | privacy_boundary_review_required |
| mcp_tool_call | refund_boundary | resource_substitution | block | block | approval_execution_divergence |
| mcp_tool_call | refund_boundary | destination_widening | block | block | approval_execution_divergence |
| mcp_tool_call | refund_boundary | operation_widening | block | block | approval_execution_divergence |
| mcp_tool_call | refund_boundary | holder_session_mismatch | block | block | runtime_session_mismatch |
| mcp_tool_call | refund_boundary | receipt_sink_unavailable | block | block | receipt_sink_unavailable |
| mcp_tool_call | refund_boundary | ambiguous_runtime_evidence | block | block | approval_execution_divergence |
| mcp_tool_call | customer_document_share | equivalent_projection | fast | fast | local_commit_satisfied |
| mcp_tool_call | customer_document_share | runtime_narrows_authority | fast | fast | local_commit_satisfied |
| mcp_tool_call | customer_document_share | policy_digest_drift | slow | slow | policy_digest_drift |
| mcp_tool_call | customer_document_share | state_predicate_missing | slow | slow | state_predicate_evidence_missing |
| mcp_tool_call | customer_document_share | privacy_boundary_exposed | slow | slow | privacy_boundary_review_required |
| mcp_tool_call | customer_document_share | resource_substitution | block | block | approval_execution_divergence |
| mcp_tool_call | customer_document_share | destination_widening | block | block | approval_execution_divergence |
| mcp_tool_call | customer_document_share | operation_widening | block | block | approval_execution_divergence |
| mcp_tool_call | customer_document_share | holder_session_mismatch | block | block | runtime_session_mismatch |
| mcp_tool_call | customer_document_share | receipt_sink_unavailable | block | block | receipt_sink_unavailable |
| mcp_tool_call | customer_document_share | ambiguous_runtime_evidence | block | block | approval_execution_divergence |
| mcp_tool_call | cloud_iam_change | equivalent_projection | fast | fast | local_commit_satisfied |
| mcp_tool_call | cloud_iam_change | runtime_narrows_authority | fast | fast | local_commit_satisfied |
| mcp_tool_call | cloud_iam_change | policy_digest_drift | slow | slow | policy_digest_drift |
| mcp_tool_call | cloud_iam_change | state_predicate_missing | slow | slow | state_predicate_evidence_missing |
| mcp_tool_call | cloud_iam_change | privacy_boundary_exposed | slow | slow | privacy_boundary_review_required |
| mcp_tool_call | cloud_iam_change | resource_substitution | block | block | approval_execution_divergence |
| mcp_tool_call | cloud_iam_change | destination_widening | block | block | approval_execution_divergence |
| mcp_tool_call | cloud_iam_change | operation_widening | block | block | approval_execution_divergence |
| mcp_tool_call | cloud_iam_change | holder_session_mismatch | block | block | runtime_session_mismatch |
| mcp_tool_call | cloud_iam_change | receipt_sink_unavailable | block | block | receipt_sink_unavailable |
| mcp_tool_call | cloud_iam_change | ambiguous_runtime_evidence | block | block | approval_execution_divergence |
| mcp_tool_call | dao_treasury_prepare | equivalent_projection | fast | fast | local_commit_satisfied |
| mcp_tool_call | dao_treasury_prepare | runtime_narrows_authority | fast | fast | local_commit_satisfied |
| mcp_tool_call | dao_treasury_prepare | policy_digest_drift | slow | slow | policy_digest_drift |
| mcp_tool_call | dao_treasury_prepare | state_predicate_missing | slow | slow | state_predicate_evidence_missing |
| mcp_tool_call | dao_treasury_prepare | privacy_boundary_exposed | slow | slow | privacy_boundary_review_required |
| mcp_tool_call | dao_treasury_prepare | resource_substitution | block | block | approval_execution_divergence |
| mcp_tool_call | dao_treasury_prepare | destination_widening | block | block | approval_execution_divergence |
| mcp_tool_call | dao_treasury_prepare | operation_widening | block | block | approval_execution_divergence |
| mcp_tool_call | dao_treasury_prepare | holder_session_mismatch | block | block | runtime_session_mismatch |
| mcp_tool_call | dao_treasury_prepare | receipt_sink_unavailable | block | block | receipt_sink_unavailable |
| mcp_tool_call | dao_treasury_prepare | ambiguous_runtime_evidence | block | block | approval_execution_divergence |
| sdk_call | refund_boundary | equivalent_projection | fast | fast | local_commit_satisfied |
| sdk_call | refund_boundary | runtime_narrows_authority | fast | fast | local_commit_satisfied |
| sdk_call | refund_boundary | policy_digest_drift | slow | slow | policy_digest_drift |
| sdk_call | refund_boundary | state_predicate_missing | slow | slow | state_predicate_evidence_missing |

## Claim boundary

The fixture supports a narrow claim: the same boundary semantics can be replayed across several runtime shapes when adapters project them into the same CAVA action object. It does not prove that every real runtime parser is accurate. That question belongs to held-out, independently labeled corpora.
