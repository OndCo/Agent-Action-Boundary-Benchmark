from copy import deepcopy
from pathlib import Path
import unittest

import verify

ROOT = Path(__file__).resolve().parent


class EvidenceMutationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = verify.load_primary(ROOT)
        cls.protocol = verify.load_json(ROOT / 'data/protocol.json')
        cls.recorded = verify.load_json(ROOT / 'data/recorded-score.json')

    def rejected(self, rows, recorded=None):
        with self.assertRaises((ValueError, AssertionError)):
            verify.recompute_primary(rows, self.protocol,
                                     self.recorded if recorded is None else recorded)

    def test_original_evidence_recomputes(self):
        result = verify.recompute_primary(self.rows, self.protocol, self.recorded)
        self.assertEqual(result['record_count'], 2340)
        self.assertEqual(result['attempt_count'], 3000)
        self.assertIsNone(result['score']['by_mode']['osuite_fast']['security_score'])

    def test_removed_record_is_not_ignored(self):
        self.rejected(self.rows[:-1])

    def test_duplicate_record_is_not_ignored(self):
        self.rejected(self.rows[:-1] + [self.rows[0]])

    def test_changed_aggregate_is_recomputed(self):
        recorded = deepcopy(self.recorded)
        recorded['by_mode']['osuite_fast']['unauthorized_effects'] = 1
        self.rejected(self.rows, recorded)

    def test_changed_receiver_evidence_is_rejected(self):
        rows = deepcopy(self.rows)
        row = next(row for row in rows if row['record']['receiver'])
        row['record']['receiver'][0]['body_sha256'] = '0' * 64
        self.rejected(rows)

    def test_missing_broker_completion_is_rejected(self):
        rows = deepcopy(self.rows)
        row = next(row for row in rows if any(e['type'] == 'attempt_finished' for e in row['events']))
        row['events'] = [e for e in row['events'] if e['type'] != 'attempt_finished']
        self.rejected(rows)

    def test_telemetry_gap_cannot_be_changed_to_safe(self):
        rows = deepcopy(self.rows)
        row = next(row for row in rows if row['record'].get('capture_fault'))
        row['record']['evidence_complete'] = True
        row['record']['receiver'] = verify.project_receiver(row['receiver_raw'], row['broker']['queries'])
        self.rejected(rows)

    def test_revocation_readback_must_bind_to_same_action(self):
        row = verify.read_rows(ROOT / 'data/revocation-current.jsonl.gz')[0]
        verify.validate_revocation(row)
        row['result']['sql_revocation']['observations'][0]['action_id'] = 'unrelated-action'
        with self.assertRaises(ValueError):
            verify.validate_revocation(row)

    def test_revocation_probe_order_must_be_preserved(self):
        row = verify.read_rows(ROOT / 'data/revocation-current.jsonl.gz')[0]
        row['result']['first'], row['result']['second'] = row['result']['second'], row['result']['first']
        with self.assertRaises(ValueError):
            verify.validate_revocation(row)


if __name__ == '__main__':
    unittest.main()
