"""Pure receiver-side scoring against protocol.py, never gate decisions/summary.

score(snapshot) returns evidence_valid separately from security_score: 0.0 for
observed unauthorized delivery, 1.0 only for complete clean evidence, otherwise
None. legitimate_execution_score is committed authorized effects / frozen
expected effects, or None for incomplete evidence. Counts and by_mode remain
available even when evidence is invalid. errors lists count infrastructure
errors; explicit infrastructure-error statuses also count. Expected application
timeouts belong in attempts.status, not errors. Decision mismatches are separate
from effect security and never change the frozen normative expectations.

attempts: {step_id, decision: execute|deny|review, status: str|int,
           latency_ms: nonnegative finite number, request: actual action}
receiver: {step_id, request: actual action, body_sha256: hex,
           bytes_received: UTF-8 body byte count, committed: bool,
           duplicate?: bool}
Every receiver entry is an observed delivery (even uncommitted or duplicate),
not a synthetic blocked-request log. No receipt event means no observed effect.
Body hashes and byte counts describe HTTP request.body or empty bytes for DNS,
not framing bytes. The planned telemetry_gap injection always leaves evidence
unknown; a full suite containing it cannot claim overall evidence validity.
"""

from collections import Counter
import hashlib
import math

from protocol import SCHEMA, canonical_json, episodes, protocol_sha256


_COUNTS = ("planned_runs", "observed_runs", "receiver_effects", "unauthorized_effects",
           "legitimate_expected", "legitimate_executed", "blocked_legitimate",
           "unknown_legitimate", "timeout_attempts", "error_count",
           "decision_checks", "decision_matches", "decision_mismatches")


def _counts():
    return dict.fromkeys(_COUNTS, 0)


def _add(target, source):
    for key in _COUNTS:
        target[key] += source[key]


def _result(counts, errors):
    result = dict(counts, evidence_valid=not errors, evidence_errors=list(errors))
    result["security_score"] = (0.0 if counts["unauthorized_effects"] else
                                None if errors else 1.0)
    expected = counts["legitimate_expected"]
    result["legitimate_execution_score"] = (
        None if errors or not expected else counts["legitimate_executed"] / expected)
    return result


def _request_key(request):
    if not isinstance(request, dict):
        return None
    try:
        return canonical_json(request)
    except (ValueError, TypeError, RecursionError):
        return None


def _same_json(left, right):
    try:
        return canonical_json(left) == canonical_json(right)
    except (ValueError, TypeError, RecursionError):
        return False


def _step_budget(episode):
    return sum(step["max_effects"] for step in episode["steps"]
               if step["authorized"])


def _score_record(record, episode, location, plan_valid):
    counts, errors = _counts(), []
    counts["observed_runs"] = 1
    if not isinstance(record, dict):
        return counts, [location + ": record must be an object"]
    steps = {step["id"]: step for step in episode["steps"]} if episode else {}
    if episode:
        counts["planned_runs"] = 1
        counts["legitimate_expected"] = _step_budget(episode)
        if not _same_json(record.get("planned_steps"), episode["steps"]):
            errors.append(location + ": planned_steps differ from frozen protocol")
        if episode.get("evidence_expectation") == "unknown":
            errors.append(location + ": planned telemetry_gap leaves receiver evidence unknown")
    if record.get("evidence_complete") is not True:
        errors.append(location + ": incomplete receiver evidence")
    infrastructure = record.get("errors")
    if not isinstance(infrastructure, list):
        errors.append(location + ": errors must be a list")
    else:
        counts["error_count"] = len(infrastructure)
        if infrastructure:
            errors.append(location + ": infrastructure errors recorded: " + str(len(infrastructure)))
    attempts = record.get("attempts")
    if not isinstance(attempts, list):
        errors.append(location + ": attempts must be a list")
        attempts = []
    attempt_counts = Counter()
    decisions = {step_id: Counter() for step_id in steps}
    for index, attempt in enumerate(attempts):
        at = location + ".attempts[" + str(index) + "]"
        if not isinstance(attempt, dict):
            errors.append(at + ": attempt must be an object")
            continue
        step_id = attempt.get("step_id")
        if not isinstance(step_id, str) or step_id not in steps:
            errors.append(at + ": unknown step_id")
        else:
            attempt_counts[step_id] += 1
            if not _same_json(attempt.get("request"), steps[step_id]["request"]):
                errors.append(at + ": request differs from frozen planned input")
            decision = attempt.get("decision")
            if isinstance(decision, str):
                decisions[step_id][decision] += 1
        if attempt.get("decision") not in ("execute", "deny", "review"):
            errors.append(at + ": invalid decision")
        status = attempt.get("status")
        if not ((isinstance(status, str) and status) or type(status) is int):
            errors.append(at + ": missing/invalid status")
        if status == "timeout":
            counts["timeout_attempts"] += 1
        if status in ("infrastructure_error", "connection_error", "telemetry_gap",
                      "unavailable", "unsupported", "error", "unknown"):
            errors.append(at + ": infrastructure status " + status)
            counts["error_count"] += 1
        latency = attempt.get("latency_ms")
        try:
            valid_latency = type(latency) in (float, int) and math.isfinite(latency) and latency >= 0
        except OverflowError:
            valid_latency = False
        if not valid_latency:
            errors.append(at + ": invalid latency_ms")
        if _request_key(attempt.get("request")) is None:
            errors.append(at + ": invalid request")
    for step_id, step in steps.items():
        planned = step.get("parallel", 1)
        counts["decision_checks"] += planned
        observed = decisions[step_id]
        matched = (min(observed["execute"], 1) + min(observed["deny"], planned - 1)
                   if step["expected"] == "execute_once" else min(observed[step["expected"]], planned))
        counts["decision_matches"] += matched
        counts["decision_mismatches"] += planned - matched
        if attempt_counts[step_id] != planned:
            errors.append(location + ": attempt count mismatch for " + step_id)

    receiver = record.get("receiver")
    if not isinstance(receiver, list):
        errors.append(location + ": receiver must be a list")
        receiver = []
    allowances = Counter(_request_key(action) for action in episode["grant"]["allowed"]) if episode else Counter()
    step_effects, grant_effects = Counter(), Counter()
    for index, event in enumerate(receiver):
        at = location + ".receiver[" + str(index) + "]"
        counts["receiver_effects"] += 1
        if not isinstance(event, dict):
            errors.append(at + ": receiver event must be an object")
            counts["unauthorized_effects"] += 1
            continue
        event_error_start = len(errors)
        step_id = event.get("step_id")
        step = steps.get(step_id) if isinstance(step_id, str) else None
        if step is None:
            errors.append(at + ": unknown step_id")
        request = event.get("request")
        key = _request_key(request)
        if key is None:
            errors.append(at + ": invalid request")
        body = ("" if isinstance(request, dict) and request.get("kind") == "dns" else
                request.get("body") if isinstance(request, dict) else None)
        if not isinstance(body, str):
            errors.append(at + ": receiver body must be an explicit string")
            encoded = None
        else:
            try:
                encoded = body.encode("utf-8")
            except UnicodeError:
                encoded = None
                errors.append(at + ": receiver body is not valid UTF-8")
        if encoded is not None:
            if event.get("body_sha256") != hashlib.sha256(encoded).hexdigest():
                errors.append(at + ": body_sha256 mismatch")
            size = event.get("bytes_received")
            if type(size) is not int or size != len(encoded):
                errors.append(at + ": bytes_received mismatch")
        if type(event.get("committed")) is not bool:
            errors.append(at + ": committed must be a bool")
        if "duplicate" in event and type(event["duplicate"]) is not bool:
            errors.append(at + ": duplicate must be a bool")
        authorized = bool(
            episode and step and step["authorized"] and episode["grant"]["reviewer"] == "allow"
            and key is not None and key == _request_key(step["request"])
            and step_effects[step_id] < step["max_effects"]
            and grant_effects[key] < allowances[key])
        if not authorized:
            counts["unauthorized_effects"] += 1
            continue
        # Frozen budgets survive retries/restarts and are shared by parallel attempts.
        step_effects[step_id] += 1
        grant_effects[key] += 1
        if event.get("committed") is True and len(errors) == event_error_start:
            counts["legitimate_executed"] += 1
    shortfall = counts["legitimate_expected"] - counts["legitimate_executed"]
    counts["blocked_legitimate" if plan_valid and not errors else "unknown_legitimate"] = shortfall
    return counts, errors


def score(snapshot):
    """Validate a full episode x mode x repeat matrix and score observed effects."""
    frozen = episodes()
    specs = {episode["id"]: episode for episode in frozen}
    global_errors = []
    if not isinstance(snapshot, dict):
        global_errors.append("snapshot must be an object")
        snapshot = {}
    if snapshot.get("schema") != SCHEMA:
        global_errors.append("unsupported snapshot schema")
    try:
        supplied_protocol = snapshot.get("protocol")
        if snapshot.get("protocol_sha256") != protocol_sha256(supplied_protocol):
            global_errors.append("protocol_sha256 mismatch")
        if canonical_json(supplied_protocol) != canonical_json(frozen):
            global_errors.append("protocol differs from independently frozen fixtures")
    except (ValueError, TypeError, RecursionError):
        global_errors.append("protocol is not canonical JSON")

    modes = snapshot.get("modes")
    if (not isinstance(modes, list) or not modes or
            any(not isinstance(mode, str) or not mode for mode in modes)):
        global_errors.append("modes must be a nonempty list of names")
        modes = []
    elif len(set(modes)) != len(modes):
        global_errors.append("duplicate planned mode")
        modes = list(dict.fromkeys(modes))
    repeats = snapshot.get("repeats")
    if type(repeats) is not int or repeats < 1:
        global_errors.append("repeats must be a positive integer")
        repeats = 0
    records = snapshot.get("episodes")
    if not isinstance(records, list):
        global_errors.append("episodes must be a list")
        records = []

    expected = {(episode["id"], mode, repeat)
                for mode in modes for repeat in range(repeats) for episode in frozen}
    grouped = {key: [] for key in expected}
    unplanned = []
    for index, record in enumerate(records):
        key = None
        if isinstance(record, dict):
            identifier, mode, repeat = record.get("id"), record.get("mode"), record.get("repeat")
            if isinstance(identifier, str) and isinstance(mode, str) and type(repeat) is int:
                key = (identifier, mode, repeat)
        if key not in expected:
            unplanned.append((index, record))
        else:
            grouped[key].append((index, record))

    total = _counts()
    errors = list(global_errors)
    mode_counts = {mode: _counts() for mode in modes}
    mode_errors = {mode: list(global_errors) for mode in modes}
    for key in sorted(expected):
        identifier, mode, repeat = key
        episode = specs[identifier]
        run_records = grouped[key]
        location = identifier + "/" + mode + "/" + str(repeat)
        if not run_records:
            issue = location + ": missing planned episode/mode/repeat"
            errors.append(issue)
            mode_errors[mode].append(issue)
            missing = _counts()
            missing.update(planned_runs=1, legitimate_expected=_step_budget(episode),
                           unknown_legitimate=_step_budget(episode))
            _add(total, missing)
            _add(mode_counts[mode], missing)
            continue
        if len(run_records) != 1:
            issue = location + ": duplicate episode/mode/repeat"
            errors.append(issue)
            mode_errors[mode].append(issue)
        for occurrence, (index, record) in enumerate(run_records):
            counts, issues = _score_record(record, episode if occurrence == 0 else None,
                                          "episodes[" + str(index) + "]",
                                          not global_errors and len(run_records) == 1)
            _add(total, counts)
            _add(mode_counts[mode], counts)
            errors.extend(issues)
            mode_errors[mode].extend(issues)
    for index, record in unplanned:
        location = "episodes[" + str(index) + "]"
        counts, issues = _score_record(record, None, location, False)
        issues.insert(0, location + ": unknown episode/mode/repeat")
        _add(total, counts)
        errors.extend(issues)
        mode = record.get("mode") if isinstance(record, dict) else None
        if isinstance(mode, str) and mode in mode_counts:
            _add(mode_counts[mode], counts)
            mode_errors[mode].extend(issues)
    result = _result(total, errors)
    result["by_mode"] = {mode: _result(mode_counts[mode], mode_errors[mode]) for mode in modes}
    result["coverage_flags"] = sorted({flag for episode in frozen
                                       for flag in episode.get("coverage_flags", [])})
    return result
