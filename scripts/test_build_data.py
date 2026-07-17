#!/usr/bin/env python3
"""
test_build_data.py — blank-row guard tests for build_data.py

Root cause this locks down: when a source CSV yields a DictReader row whose
TR_CODE and SCHEME_CODE are both empty (blank line, all-empty-comma line, or a
garbled non-CSV line that parses under a wrong header), `snap_file` backfills
the snapshot from the filename, so the `if not snap: continue` guard alone lets
the row through and produces an artifact `{tr:'',sc:'',...}` in the output.

Run:

    python scripts/test_build_data.py
    python -m unittest scripts.test_build_data

No external test runner required (stdlib unittest only).
"""
import csv
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_data as bd


def _write_csv(path, fieldnames, rows):
    """Write a CSV with the given header + rows (row values keyed by fieldname)."""
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            # DictWriter tolerates extras/missing; coerce to the header set.
            w.writerow({k: r.get(k, "") for k in fieldnames})


class BlankRowHelperTests(unittest.TestCase):
    """Direct unit tests for the _blank_row helper (the contract every reader
    relies on)."""

    def test_both_empty_is_blank(self):
        self.assertTrue(bd._blank_row({"TR_CODE": "", "SCHEME_CODE": ""}))

    def test_whitespace_only_is_blank(self):
        self.assertTrue(bd._blank_row({"TR_CODE": "   ", "SCHEME_CODE": "\t"}))

    def test_none_values_is_blank(self):
        # DictReader yields None for missing trailing columns on short rows.
        self.assertTrue(bd._blank_row({"TR_CODE": None, "SCHEME_CODE": None}))

    def test_missing_keys_is_blank(self):
        # DictReader row from a wrong-header source has neither key.
        self.assertTrue(bd._blank_row({}))

    def test_trustee_present_is_not_blank(self):
        self.assertFalse(bd._blank_row({"TR_CODE": "BCT", "SCHEME_CODE": ""}))

    def test_scheme_present_is_not_blank(self):
        self.assertFalse(bd._blank_row({"TR_CODE": "", "SCHEME_CODE": "AD"}))


class ReadDdiBlankRowTests(unittest.TestCase):
    """End-to-end: drive the real read_ddi() against a temp CSV that contains
    a blank source row (empty TR_CODE + SCHEME_CODE) and a real row, and assert
    the blank row is dropped while the real row survives."""

    DDI_AGING_FIELDS = [
        "SNAPSHOT_DATE", "TR_CODE", "SCHEME_CODE", "SHORT_CODE", "TOTAL",
        "DAY_00_06", "DAY_07_14", "DAY_15_21", "DAY_22_30", "DAY_31_MORE",
    ]

    def test_read_ddi_aging_drops_blank_source_row(self):
        with tempfile.TemporaryDirectory() as d:
            aging_path = os.path.join(d, "ddi-aging-20260717.csv")
            # blank row: SNAPSHOT_DATE empty (falls back to filename) + empty TR/SC.
            # This is exactly the defect shape: snap resolves from the filename,
            # so `if not snap` does NOT catch it.
            blank = {
                "SNAPSHOT_DATE": "", "TR_CODE": "", "SCHEME_CODE": "",
                "SHORT_CODE": "", "TOTAL": "", "DAY_00_06": "", "DAY_07_14": "",
                "DAY_15_21": "", "DAY_22_30": "", "DAY_31_MORE": "",
            }
            real = {
                "SNAPSHOT_DATE": "20260717", "TR_CODE": "BCT", "SCHEME_CODE": "AD",
                "SHORT_CODE": "REE", "TOTAL": "5", "DAY_00_06": "4",
                "DAY_07_14": "1", "DAY_15_21": "0", "DAY_22_30": "0",
                "DAY_31_MORE": "0",
            }
            _write_csv(aging_path, self.DDI_AGING_FIELDS, [blank, real])

            with mock.patch.object(bd, "DDI_AGING_GLOB", aging_path), \
                 mock.patch.object(bd, "DDI30_GLOB", os.path.join(d, "ddi-30day-nonexistent.csv")):
                last30, aging, snaps30, snapsAging = bd.read_ddi()

            self.assertEqual(len(aging), 1, "blank source row should be dropped")
            self.assertEqual(aging[0]["sc"], "AD")
            self.assertNotEqual(aging[0]["tr"], "")
            self.assertEqual(snapsAging, ["20260717"])

    def test_read_ddi_30day_drops_blank_source_row(self):
        """Same guard must fire in the 30-day loop (shared bug-class)."""
        DDI30_FIELDS = [
            "SNAPSHOT_DATE", "TR_CODE", "SCHEME_CODE", "SHORT_CODE",
            "DDI_REQUEST_DATE", "COUNT", "SUBMITTED_TO_BANK",
            "SUCCESS", "REJECTED",
        ]
        with tempfile.TemporaryDirectory() as d:
            p30 = os.path.join(d, "ddi-30day-20260717.csv")
            blank = {k: "" for k in DDI30_FIELDS}
            real = {
                "SNAPSHOT_DATE": "20260717", "TR_CODE": "BCT", "SCHEME_CODE": "AD",
                "SHORT_CODE": "REE", "DDI_REQUEST_DATE": "2026-07-17",
                "COUNT": "3", "SUBMITTED_TO_BANK": "2", "SUCCESS": "2",
                "REJECTED": "0",
            }
            _write_csv(p30, DDI30_FIELDS, [blank, real])

            with mock.patch.object(bd, "DDI30_GLOB", p30), \
                 mock.patch.object(bd, "DDI_AGING_GLOB", os.path.join(d, "ddi-aging-nonexistent.csv")):
                last30, aging, snaps30, snapsAging = bd.read_ddi()

            self.assertEqual(len(last30), 1, "blank source row should be dropped in 30-day loop")
            self.assertEqual(last30[0]["sc"], "AD")


if __name__ == "__main__":
    unittest.main(verbosity=2)
