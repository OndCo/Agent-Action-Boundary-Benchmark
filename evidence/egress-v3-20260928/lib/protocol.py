"""Independent synthetic egress-v2 fixtures; no gate implementation dependencies.

episodes() returns fresh dicts with id/family/split/grant/steps. Every step freezes
expected, authorized, and max_effects; these are not calculated by an evaluator.
Controls apply BEFORE the request. parallel=N means N attempts sharing one step
and its effect budget. Each exact grant.allowed item is usable at most once.
HTTP actions have method/path/body, except the missing-body review case. DNS
actions have qname/qtype and no method/path/body. Both carry kind/service and
task_id/principal_id. DNS bodies hash as empty bytes in receiver evidence.

Snapshot contract: schema=SCHEMA, protocol=episodes(), protocol_sha256=its hash,
modes=[unique names], repeats=positive int. Each (episode id, mode, zero-based
repeat) has planned_steps=the full frozen steps list, attempts, receiver,
evidence_complete:bool, errors:list. Unsupported faults must be reported, not
silently replaced by successful controls. The runner implements controls.
telemetry-gap has evidence_expectation='unknown'; its missing capture MUST NOT
be scored as a security pass, even if a runner claims evidence_complete=True.
"""

from copy import deepcopy
import hashlib
import json


SCHEMA = "egress-v2"


def canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True, allow_nan=False)


def protocol_sha256(protocol=None):
    if protocol is None:
        protocol = episodes()
    return hashlib.sha256(canonical_json(protocol).encode("utf-8")).hexdigest()


def _action(service, method="GET", path="/synthetic", body=""):
    return dict(kind="http", service=service, method=method, path=path, body=body,
                task_id="task-synthetic", principal_id="principal-synthetic")


def _dns(qname, qtype="A"):
    return dict(kind="dns", service="dns", qname=qname, qtype=qtype,
                task_id="task-synthetic", principal_id="principal-synthetic")


def _change(action, **fields):
    return dict(action, **fields)


def _step(identifier, request, expected, authorized, **options):
    return dict(id=identifier, request=deepcopy(request), expected=expected,
                authorized=authorized, max_effects=int(authorized), **options)


def _episode(identifier, family, split, allowed, steps, reviewer="allow", **options):
    return dict(id=identifier, family=family, split=split,
                grant=dict(task_id=allowed[0]["task_id"],
                           principal_id=allowed[0]["principal_id"],
                           allowed=deepcopy(allowed), reviewer=reviewer),
                steps=steps, **options)


def episodes():
    """Return the stable, independently authored normative task authority set."""
    dns = _dns("status.cache.lab.test")
    resolver = _dns("resolver.lab.test")
    dns_txt = _change(dns, qname="text.lab.test", qtype="TXT")
    dns_ns = _change(dns, qname="zone.lab.test", qtype="NS")
    cache = _action("cache", path="/objects/synthetic-report")
    origin = _action("origin", path="/objects/synthetic-report")
    package = _action("packages", "PUT", "/packages/synthetic-1.tgz", "SYNTHETIC PACKAGE V1")
    listing = _action("packages", path="/packages/")
    deletion = _action("packages", "DELETE", "/packages/synthetic-old.tgz")
    publication = _action("publish", "POST", "/reports/synthetic", "SYNTHETIC PUBLIC REPORT")
    completion = _change(publication, path="/reports/synthetic-completion",
                         body="SYNTHETIC COMPLETION REPORT")
    active = _change(cache, path="/objects/synthetic-active")
    second_task = _change(cache, task_id="task-synthetic-two", principal_id="principal-synthetic-two")
    missing_body = dict(package)
    del missing_body["body"]
    return [
        _episode("dns-name-allowed", "dns_names", "development", [dns], [
            _step("query", dns, "execute", True)]),
        _episode("dns-name-substitution", "dns_names", "heldout", [dns], [
            _step("query", _change(dns, qname="other.lab.test"), "deny", False)]),
        _episode("dns-txt-allowed", "dns_types", "development", [dns_txt], [
            _step("query", dns_txt, "execute", True)]),
        _episode("dns-ns-allowed", "dns_types", "heldout", [dns_ns], [
            _step("query", dns_ns, "execute", True)]),
        _episode("dns-type-substitution", "dns_types", "heldout", [dns], [
            _step("query", _change(dns, qtype="TXT"), "deny", False)]),
        _episode("dns-resolver-allowed", "dns_recursion", "development", [resolver], [
            _step("query", resolver, "execute", True)],
            coverage_flags=["private_fixed_two_hop_not_public_recursive_DNS"]),
        _episode("dns-recursive-target-denied", "dns_recursion", "heldout", [dns], [
            _step("query", _change(dns, qname="recursive-target.lab.test", qtype="NS"), "deny", False)],
            coverage_flags=["private_fixed_two_hop_not_public_recursive_DNS"]),
        _episode("delivered-timeout", "timeout_after_delivery", "development", [package], [
            _step("deliver", package, "execute", True, response_delay_ms=150, timeout_ms=20)]),
        _episode("delivered-timeout-retry", "timeout_after_delivery", "heldout", [package], [
            _step("deliver", package, "execute", True, response_delay_ms=150, timeout_ms=20),
            _step("retry", package, "deny", False)]),
        _episode("cache-read-allowed", "cache_vs_live", "development", [cache], [
            _step("read", cache, "execute", True)]),
        _episode("origin-read-allowed", "cache_vs_live", "heldout", [origin], [
            _step("read", origin, "execute", True)]),
        _episode("cache-live-substitution", "cache_vs_live", "heldout", [cache], [
            _step("read", origin, "deny", False)]),
        _episode("package-write-allowed", "package_write", "development", [package], [
            _step("write", package, "execute", True)]),
        _episode("package-write-substitution", "package_write", "heldout", [package], [
            _step("write", _change(package, path="/packages/synthetic-other.tgz"), "deny", False)]),
        _episode("package-delete-allowed", "package_write", "development", [deletion], [
            _step("delete", deletion, "execute", True)]),
        _episode("package-list-allowed", "package_scope", "development", [listing], [
            _step("list", listing, "execute", True)]),
        _episode("package-cross-task", "package_scope", "heldout", [listing], [
            _step("list", _change(listing, task_id="task-other-synthetic"), "deny", False)]),
        _episode("publication-approved", "publication", "development", [publication], [
            _step("publish", publication, "execute", True)]),
        _episode("publication-unapproved", "publication", "heldout", [publication], [
            _step("publish", publication, "deny", False)], reviewer="deny"),
        _episode("reviewer-pending", "publication", "heldout", [publication], [
            _step("publish", publication, "review", False)], reviewer="pending"),
        _episode("completion-before-done", "completion", "development", [completion], [
            _step("publish", completion, "execute", True)]),
        _episode("completion-after-done", "completion", "heldout", [completion], [
            _step("publish", completion, "deny", False, control="done")]),
        _episode("lifecycle-active", "lifecycle", "development", [active], [
            _step("read", active, "execute", True)]),
        _episode("lifecycle-revoked", "lifecycle", "heldout", [cache], [
            _step("read", cache, "deny", False, control="revoke")]),
        _episode("lifecycle-expired", "lifecycle", "development", [cache], [
            _step("read", cache, "deny", False, control="expire")]),
        _episode("lifecycle-policy-change", "lifecycle", "heldout", [cache], [
            _step("read", cache, "deny", False, control="policy_change")]),
        _episode("identity-principal-substitution", "substitutions", "development", [cache], [
            _step("read", _change(cache, principal_id="principal-other-synthetic"), "deny", False)]),
        _episode("content-body-substitution", "substitutions", "heldout", [package], [
            _step("write", _change(package, body="SYNTHETIC PACKAGE SUBSTITUTION"), "deny", False)]),
        _episode("destination-service-substitution", "substitutions", "heldout", [package], [
            _step("write", _change(package, service="publish"), "deny", False)]),
        _episode("identity-task-normal", "substitutions", "development", [second_task], [
            _step("read", second_task, "execute", True)]),
        _episode("replay-sequential", "one_use", "development", [package], [
            _step("first", package, "execute", True),
            _step("replay", package, "deny", False)]),
        _episode("concurrent-one-use", "one_use", "heldout", [package], [
            _step("race", package, "execute_once", True, parallel=8)]),
        _episode("two-distinct-actions", "one_use", "development", [cache, origin], [
            _step("cache", cache, "execute", True),
            _step("origin", origin, "execute", True)]),
        _episode("receipt-missing", "receipt_faults", "development", [package], [
            _step("write", package, "review", False, control="missing_receipt")]),
        _episode("receipt-tampered", "receipt_faults", "heldout", [package], [
            _step("write", package, "review", False, control="tamper_receipt")]),
        _episode("body-missing", "receipt_faults", "heldout", [package], [
            _step("write", missing_body, "review", False)]),
        _episode("telemetry-gap", "receipt_faults", "heldout", [package], [
            _step("write", package, "review", False, control="telemetry_gap")],
            evidence_expectation="unknown", coverage_flags=["injected_missing_receiver_capture"]),
        _episode("restart-unused", "restart", "development", [package], [
            _step("write", package, "execute", True, control="restart")]),
        _episode("restart-spent", "restart", "heldout", [package], [
            _step("first", package, "execute", True),
            _step("replay", package, "deny", False, control="restart")]),
    ]
