"""Tests for scripts/update-prices.py. Run with:

    python3 -m unittest discover -s scripts/tests
"""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

# The script's file name has a hyphen, so it is loaded by path. Dataclasses look their
# module up in sys.modules, so it is registered there first.
SCRIPT = Path(__file__).resolve().parent.parent / "update-prices.py"
spec = importlib.util.spec_from_file_location("update_prices", SCRIPT)
prices = importlib.util.module_from_spec(spec)
sys.modules["update_prices"] = prices
spec.loader.exec_module(prices)


class Repository:
    """A throwaway git repository with controlled commit times."""

    def __init__(self, root: Path):
        self.root = root
        root.mkdir(parents=True, exist_ok=True)
        self.git("init", "-q", "-b", "main")

    def git(self, *args: str, when: str = "2026-01-01T00:00:00Z") -> str:
        env = {**os.environ, "GIT_AUTHOR_DATE": when, "GIT_COMMITTER_DATE": when,
               "GIT_AUTHOR_NAME": "test", "GIT_AUTHOR_EMAIL": "test@example.com",
               "GIT_COMMITTER_NAME": "test", "GIT_COMMITTER_EMAIL": "test@example.com"}
        return subprocess.run(["git", "-C", str(self.root), *args], check=True,
                              capture_output=True, text=True, env=env).stdout

    def commit(self, when: str, files: dict[str, str | None], links: dict[str, str] = {}) -> None:
        for path, content in files.items():
            target = self.root / path
            if content is None:
                target.unlink()
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(textwrap.dedent(content))
        for path, destination in links.items():
            target = self.root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.is_symlink() or target.exists():
                target.unlink()
            target.symlink_to(destination)
        self.git("add", "-A", when=when)
        self.git("commit", "-q", "-m", f"change at {when}", when=when)


def cost(input_rate: float, output_rate: float, extra: str = "") -> str:
    return f"[cost]\ninput = {input_rate}\noutput = {output_rate}\n{extra}"


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        root = Path(self.directory.name)
        self.models_dev = Repository(root / "models.dev")
        self.data = root / "data"
        (self.data / "amendments").mkdir(parents=True)
        (self.data / "billing-modes.toml").write_text("")

    def tearDown(self):
        self.directory.cleanup()

    def amend(self, name: str, text: str) -> None:
        (self.data / "amendments" / name).write_text(textwrap.dedent(text))

    def model(self, provider: str, model: str) -> dict:
        return prices.build(self.models_dev.root, self.data)["providers"][provider][model]

    def test_history_records_each_price_change_by_commit_time(self):
        path = "providers/lab/models/m.toml"
        self.models_dev.commit("2026-01-01T00:00:00Z", {path: cost(1, 2)})
        self.models_dev.commit("2026-02-01T00:00:00Z", {path: cost(1, 2, "cache_read = 0.1\n")})
        self.models_dev.commit("2026-03-01T00:00:00Z", {path: 'name = "metadata only"\n' + cost(1, 2, "cache_read = 0.1\n")})
        timeline = self.model("lab", "m")["prices"]
        self.assertEqual([interval["start"] for interval in timeline],
                         [None, "2026-02-01T00:00:00Z"])
        self.assertEqual(timeline[1]["rates"], {"input": 1.0, "output": 2.0, "cacheRead": 0.1})
        self.assertNotIn("basis", timeline[1])
        self.assertEqual(len(timeline[1]["commit"]), 12)

    def test_tiers_and_free_listings_are_kept(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {
            "providers/lab/models/tiered.toml": cost(2, 10) + textwrap.dedent("""
                [[cost.tiers]]
                tier = { type = "context", size = 272_000 }
                input = 4
                output = 15
                """),
            "providers/reseller/models/free.toml": cost(0, 0),
            "providers/reseller/models/unpriced.toml": 'name = "no cost table"\n',
        })
        built = prices.build(self.models_dev.root, self.data)["providers"]
        self.assertEqual(built["lab"]["tiered"]["prices"][0]["rates"]["tiers"],
                         [{"above": 272000, "input": 4.0, "output": 15.0}])
        self.assertEqual(built["reseller"]["free"]["prices"][0]["rates"],
                         {"input": 0.0, "output": 0.0})
        self.assertNotIn("unpriced", built["reseller"])

    def test_extends_takes_the_extended_files_cost_and_follows_its_changes(self):
        lab = "providers/lab/models/m.toml"
        reseller = "providers/reseller/models/m.toml"
        self.models_dev.commit("2026-01-01T00:00:00Z", {lab: cost(1, 2), reseller: cost(0, 0)})
        self.models_dev.commit("2026-06-01T00:00:00Z",
                               {reseller: '[extends]\nfrom = "lab/m"\n'})
        self.models_dev.commit("2026-06-02T00:00:00Z", {lab: cost(3, 4)})
        model = self.model("reseller", "m")
        self.assertEqual([(interval["start"], interval["rates"]) for interval in model["prices"]], [
            (None, {"input": 0.0, "output": 0.0}),
            ("2026-06-01T00:00:00Z", {"input": 1.0, "output": 2.0}),
            ("2026-06-02T00:00:00Z", {"input": 3.0, "output": 4.0}),
        ])
        self.assertEqual(model["labEquivalent"], "lab/m")

    def test_extends_can_omit_the_cost(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {
            "providers/lab/models/m.toml": cost(1, 2),
            "providers/reseller/models/m.toml": '[extends]\nfrom = "lab/m"\nomit = ["cost"]\n',
        })
        self.assertNotIn("reseller", prices.build(self.models_dev.root, self.data)["providers"])

    def test_base_model_links_to_the_labs_own_entry(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {
            "providers/zai/models/glm-5.toml": cost(1, 2),
            "providers/cloud/models/glm-5.toml": 'base_model = "zhipuai/glm-5"\n' + cost(1, 2),
            "providers/openai/models/gpt-x.toml": 'base_model = "openai/gpt-x-sol"\n' + cost(5, 6),
            "providers/copilot/models/gpt-x-sol.toml": 'base_model = "openai/gpt-x-sol"\n' + cost(5, 6),
            "providers/nvidia/models/nvidia/own.toml": 'base_model = "nvidia/own"\n' + cost(1, 1),
        })
        built = prices.build(self.models_dev.root, self.data)["providers"]
        self.assertEqual(built["cloud"]["glm-5"]["labEquivalent"], "zai/glm-5")
        # The lab's own provider lists the lab model under another ID.
        self.assertEqual(built["copilot"]["gpt-x-sol"]["labEquivalent"], "openai/gpt-x")
        # A lab's own entry is not its own equivalent.
        self.assertNotIn("labEquivalent", built["nvidia"]["nvidia/own"])
        self.assertNotIn("labEquivalent", built["openai"]["gpt-x"])

    def test_alias_follows_its_target_until_it_has_its_own_price(self):
        self.models_dev.commit("2026-01-01T00:00:00Z",
                               {"providers/lab/models/m.toml": cost(1, 2)},
                               links={"providers/lab/models/alias.toml": "m.toml"})
        self.models_dev.commit("2026-02-01T00:00:00Z", {"providers/lab/models/m.toml": cost(3, 4)})
        self.assertEqual([(interval["start"], interval["rates"]["input"])
                          for interval in self.model("lab", "alias")["prices"]],
                         [(None, 1.0), ("2026-02-01T00:00:00Z", 3.0)])

    def test_alias_can_point_into_another_providers_folder(self):
        self.models_dev.commit("2026-01-01T00:00:00Z",
                               {"providers/china/models/m.toml": cost(1, 2)},
                               links={"providers/global/models/m.toml": "../../china/models/m.toml"})
        self.assertEqual(self.model("global", "m")["prices"][0]["rates"]["input"], 1.0)

    def test_open_ended_amendment_for_an_alias_compares_the_followed_price(self):
        self.models_dev.commit("2026-01-01T00:00:00Z",
                               {"providers/china/models/m.toml": cost(1, 2)},
                               links={"providers/global/models/m.toml": "../../china/models/m.toml"})
        self.amend("manual.toml", """
            [[amendment]]
            provider = "global"
            model = "m"
            valid_from = "2026-02-01T00:00:00Z"
            replaces = { input = 1.0, output = 2.0 }
            input = 1.1
            output = 2.2
            source = "https://example.com/global-pricing"
            basis = "documented"
            """)
        self.assertEqual([(interval["start"], interval["rates"]["input"])
                          for interval in self.model("global", "m")["prices"]],
                         [(None, 1.0), ("2026-02-01T00:00:00Z", 1.1)])

    def test_deleted_files_keep_their_history(self):
        path = "providers/lab/models/retired.toml"
        self.models_dev.commit("2026-01-01T00:00:00Z", {path: cost(1, 2)})
        self.models_dev.commit("2026-02-01T00:00:00Z", {path: None})
        self.assertEqual(self.model("lab", "retired")["prices"][0]["rates"]["input"], 1.0)

    def test_dated_amendment_applies_for_its_period(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {"providers/openai/models/m.toml": cost(5, 30)})
        self.models_dev.commit("2026-08-25T04:37:24Z", {"providers/openai/models/m.toml": cost(4, 20)})
        self.amend("manual.toml", """
            [[amendment]]
            provider = "openai"
            model = "m"
            valid_from = "2026-08-21T00:00:00Z"
            valid_until = "2026-08-25T04:37:24Z"
            input = 4.0
            output = 20.0
            source = "https://example.com/announcement"
            basis = "documented"
            """)
        timeline = self.model("openai", "m")["prices"]
        self.assertEqual([(interval["start"], interval["rates"]["input"], interval.get("basis"))
                          for interval in timeline], [
            (None, 5.0, None),
            ("2026-08-21T00:00:00Z", 4.0, "documented"),
            ("2026-08-25T04:37:24Z", 4.0, None),
        ])
        self.assertEqual(timeline[1]["source"], "https://example.com/announcement")

    def test_open_ended_amendment_stops_when_models_dev_changes(self):
        path = "providers/lab/models/m.toml"
        self.models_dev.commit("2026-01-01T00:00:00Z", {path: cost(1, 2)})
        self.models_dev.commit("2026-03-01T00:00:00Z", {path: cost(7, 8)})
        self.amend("manual.toml", """
            [[amendment]]
            provider = "lab"
            model = "m"
            valid_from = "2026-02-01T00:00:00Z"
            replaces = { input = 1.0, output = 2.0 }
            input = 1.5
            output = 2.5
            source = "https://example.com/page"
            basis = "documented"
            """)
        self.assertEqual([(interval["start"], interval["rates"]["input"])
                          for interval in self.model("lab", "m")["prices"]],
                         [(None, 1.0), ("2026-02-01T00:00:00Z", 1.5), ("2026-03-01T00:00:00Z", 7.0)])

    def test_until_listed_amendment_adds_a_model_until_models_dev_lists_it(self):
        self.models_dev.commit("2026-03-01T00:00:00Z", {"providers/lab/models/new.toml": cost(2, 3)})
        self.amend("manual.toml", """
            [[amendment]]
            provider = "lab"
            model = "new"
            valid_from = "2026-01-15T00:00:00Z"
            until_listed = true
            input = 1.0
            output = 3.0
            source = "https://example.com/pricing"
            basis = "firstObserved"
            [[amendment]]
            provider = "lab"
            model = "unlisted"
            valid_from = "2026-01-15T00:00:00Z"
            until_listed = true
            input = 9.0
            output = 9.0
            source = "https://example.com/pricing"
            basis = "firstObserved"
            """)
        built = prices.build(self.models_dev.root, self.data)["providers"]["lab"]
        self.assertEqual([(interval["start"], interval["rates"]["input"])
                          for interval in built["new"]["prices"]],
                         [(None, 2.0), ("2026-01-15T00:00:00Z", 1.0), ("2026-03-01T00:00:00Z", 2.0)])
        self.assertEqual(built["unlisted"]["prices"][0]["rates"]["input"], 9.0)

    def test_until_listed_ignores_a_listing_without_a_price(self):
        path = "providers/lab/models/new.toml"
        self.models_dev.commit("2026-01-01T00:00:00Z", {path: 'name = "announced"\n'})
        self.models_dev.commit("2026-03-01T00:00:00Z", {path: cost(2, 3)})
        self.amend("manual.toml", """
            [[amendment]]
            provider = "lab"
            model = "new"
            valid_from = "2026-02-01T00:00:00Z"
            until_listed = true
            input = 1.0
            output = 3.0
            source = "https://example.com/pricing"
            basis = "firstObserved"
            """)
        self.assertEqual([(interval["start"], interval["rates"]["input"])
                          for interval in self.model("lab", "new")["prices"]],
                         [(None, 1.0), ("2026-03-01T00:00:00Z", 2.0)])

    def test_earlier_amendment_in_a_file_wins_and_unknown_files_come_last(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {"providers/lab/models/m.toml": cost(1, 2)})
        entry = """
            [[amendment]]
            provider = "lab"
            model = "m"
            valid_from = "{start}"
            valid_until = "2026-03-01T00:00:00Z"
            input = {rate}
            output = 2.0
            source = "https://example.com"
            basis = "documented"
            """
        self.amend("manual.toml", entry.format(start="2026-02-10T00:00:00Z", rate=3.0)
                   + entry.format(start="2026-02-01T00:00:00Z", rate=4.0))
        self.amend("other.toml", entry.format(start="2026-01-15T00:00:00Z", rate=9.0))
        self.assertEqual([(interval["start"], interval["rates"]["input"])
                          for interval in self.model("lab", "m")["prices"]], [
            (None, 1.0), ("2026-01-15T00:00:00Z", 9.0), ("2026-02-01T00:00:00Z", 4.0),
            ("2026-02-10T00:00:00Z", 3.0), ("2026-03-01T00:00:00Z", 1.0)])

    def test_manual_amendments_take_precedence_over_imported_ones(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {"providers/lab/models/m.toml": cost(1, 2)})
        imported = """
            [[amendment]]
            provider = "lab"
            model = "m"
            valid_from = "2026-02-01T00:00:00Z"
            valid_until = "2026-03-01T00:00:00Z"
            input = {rate}
            output = 2.0
            source = "https://example.com/{name}"
            basis = "documented"
            origin = "model-prices@abc:data/{name}"
            """
        self.amend("imported-model-prices.toml",
                   imported.format(rate=3.0, name="research_corrections.toml")
                   + imported.format(rate=4.0, name="corrections.toml"))
        self.assertEqual(self.model("lab", "m")["prices"][1]["rates"]["input"], 4.0)
        self.amend("manual.toml", imported.format(rate=5.0, name="x").replace(
            'origin = "model-prices@abc:data/x"', ""))
        self.assertEqual(self.model("lab", "m")["prices"][1]["rates"]["input"], 5.0)

    def test_invalid_amendments_are_rejected(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {"providers/lab/models/m.toml": cost(1, 2)})
        base = """
            [[amendment]]
            provider = "lab"
            model = "m"
            valid_from = "2026-02-01T00:00:00Z"
            input = 1.0
            output = 2.0
            basis = "documented"
            """
        cases = {
            "without an end or replaces": base + 'source = "https://example.com"\n',
            "without a source": base + 'valid_until = "2026-03-01T00:00:00Z"\n',
            "with an unknown basis": base.replace('"documented"', '"guessed"')
            + 'source = "x"\nvalid_until = "2026-03-01T00:00:00Z"\n',
            "ending before it starts": base + 'source = "x"\nvalid_until = "2026-01-01T00:00:00Z"\n',
        }
        for name, text in cases.items():
            with self.subTest(name):
                self.amend("manual.toml", text)
                with self.assertRaises(prices.PriceDataError):
                    prices.build(self.models_dev.root, self.data)

    def test_billing_modes_are_validated_and_copied(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {"providers/lab/models/m.toml": cost(1, 2)})
        (self.data / "billing-modes.toml").write_text(textwrap.dedent("""
            [[mode]]
            harness = "pi"
            provider = "openai-codex"
            price_provider = "openai"
            billing = "subscription"
            valid_until = "2026-06-01T00:00:00Z"
            source = "https://example.com"
            """))
        self.assertEqual(prices.build(self.models_dev.root, self.data)["billingModes"], [{
            "provider": "openai-codex", "billing": "subscription", "harness": "pi",
            "priceProvider": "openai", "validUntil": "2026-06-01T00:00:00Z",
            "source": "https://example.com",
        }])
        (self.data / "billing-modes.toml").write_text(
            '[[mode]]\nprovider = "x"\nbilling = "monthly"\nsource = "y"\n')
        with self.assertRaises(prices.PriceDataError):
            prices.build(self.models_dev.root, self.data)

    def test_serialized_table_is_deterministic_json(self):
        self.models_dev.commit("2026-01-01T00:00:00Z", {
            "providers/b/models/m.toml": cost(1, 2), "providers/a/models/m.toml": cost(1, 2)})
        first = prices.serialize(prices.build(self.models_dev.root, self.data))
        second = prices.serialize(prices.build(self.models_dev.root, self.data))
        self.assertEqual(first, second)
        self.assertEqual(list(json.loads(first)["providers"]), ["a", "b"])


class ImportTest(unittest.TestCase):
    def test_model_prices_files_convert_to_amendments_that_load(self):
        with tempfile.TemporaryDirectory() as directory:
            repository = Repository(Path(directory) / "model-prices")
            # Real entries from wakamex/model-prices, shortened.
            repository.commit("2026-10-10T00:00:00Z", {
                "data/corrections.toml": """
                    [[correction]]
                    provider = "openai"
                    model = "gpt-5.6-sol"
                    valid_from = "2026-08-21T00:00:00Z"
                    valid_until = "2026-08-25T04:37:24Z"
                    input = 4.0
                    output = 20.0
                    cache_read = 0.4
                    cache_write = 5.0
                    tiers = [{ above = 272000, input = 8.0, output = 30.0, cache_read = 0.8, cache_write = 10.0 }]
                    source = "https://openai.com/index/gpt-5-6/"
                    note = "OpenAI dropped the API pricing of GPT-5.6 Sol."

                    [[correction]]
                    provider = "deepseek"
                    model = "deepseek-v4-pro"
                    valid_from = "2026-08-16T16:00:00Z"
                    input = 0.87
                    output = 1.74
                    replaces = { input = 0.435, output = 0.87, cache_read = 0.003625 }
                    modes = { thinking = { output = 4.0 } }
                    source = "https://api-docs.deepseek.com/quick_start/pricing"
                    """,
                "data/research_corrections.toml": "",
                "data/observed.json": json.dumps({"providers": {"alibaba": {"qwen-mt-flash": [
                    {"rates": {"input": 0.16, "output": 0.49}, "valid_from": "2026-01-16T07:29:01Z",
                     "source": "https://web.archive.org/web/20260116072901/https://example.com"},
                    {"rates": {"input": 0.2, "output": 0.5}, "valid_from": "2026-04-01T00:00:00Z",
                     "source": "https://www.alibabacloud.com/help/en/model-studio/model-pricing"},
                ]}}}),
            })
            amendments, commit = prices.convert_model_prices(repository.root)
            output = Path(directory) / "imported-model-prices.toml"
            output.write_text(prices.write_amendments(amendments, "header"))
            loaded = prices.load_amendments(output)

        sol, deepseek, first, second = loaded
        self.assertEqual((sol.provider, sol.model, sol.basis, sol.file),
                         ("openai", "gpt-5.6-sol", "documented", "corrections.toml"))
        self.assertEqual(sol.rates["tiers"], [{"above": 272000, "input": 8.0, "output": 30.0,
                                               "cache_read": 0.8, "cache_write": 10.0}])
        self.assertEqual(deepseek.replaces, {"input": 0.435, "output": 0.87, "cache_read": 0.003625})
        self.assertIsNone(deepseek.end)
        self.assertEqual((first.basis, first.file, first.end, first.until_listed),
                         ("firstObserved", "observed.json", second.start, False))
        self.assertTrue(second.until_listed)
        self.assertIn(f"model-prices@{commit[:12]}", amendments[0]["origin"])
        # Modes are not imported.
        self.assertNotIn("modes", amendments[1])


if __name__ == "__main__":
    unittest.main()
