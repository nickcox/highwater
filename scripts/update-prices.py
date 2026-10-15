#!/usr/bin/env python3
"""Build Highwater's price table from models.dev history and amendments.

Highwater embeds data/prices/prices.json and never downloads prices at runtime.
This script produces that file offline, from checkouts that are already downloaded:

    # Convert wakamex/model-prices' corrections into Highwater's amendment format.
    python3 scripts/update-prices.py import-amendments --model-prices ../model-prices

    # Replay models.dev's git history, apply every amendment, write prices.json.
    python3 scripts/update-prices.py build --models-dev ../models.dev

    # Fail if prices.json does not match what build would write.
    python3 scripts/update-prices.py build --models-dev ../models.dev --check

See data/prices/README.md for the formats and for why the data is shaped this way.
"""

from __future__ import annotations

import argparse
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import math
import posixpath
from pathlib import Path
import subprocess
import sys
import tomllib
from typing import Any, Iterator

REPOSITORY = Path(__file__).resolve().parent.parent
DATA = REPOSITORY / "data" / "prices"
MODELS_DEV_URL = "https://github.com/sst/models.dev"
MODEL_PRICES_URL = "https://github.com/wakamex/model-prices"
SCHEMA = 1

RATE_FIELDS = ("input", "output", "cache_read", "cache_write")
BASES = ("documented", "firstObserved")
BILLING = ("perToken", "subscription")
# models.dev lab IDs whose own API is listed under a different provider ID.
LAB_PROVIDERS = {"bytedance-seed": "volcengine", "stepfun": "stepfun-ai", "zhipuai": "zai"}
# Lower number wins when two amendments cover the same time. Within one file, the
# earlier amendment wins, as in model-prices. A file not listed here comes last.
PRECEDENCE = {
    "manual.toml": 0,
    "corrections.toml": 1,
    "research_corrections.toml": 2,
    "observed.json": 3,
}
EARLIEST = datetime.min.replace(tzinfo=timezone.utc)


class PriceDataError(Exception):
    pass


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise PriceDataError(f"time without a time zone: {value}")
    return parsed.astimezone(timezone.utc)


def format_time(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Rates
# ---------------------------------------------------------------------------


def _number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if math.isfinite(value) and value >= 0 else None


def _values(source: dict[str, Any]) -> dict[str, float]:
    found = {}
    for name in RATE_FIELDS:
        value = _number(source.get(name))
        if value is not None:
            found[name] = value
    return found


def rates_from_cost(cost: Any) -> dict[str, Any] | None:
    """Standard per-million rates and long-prompt tiers from a models.dev `[cost]` table.

    A table without both input and output rates is not a usable price.
    """
    if not isinstance(cost, dict):
        return None
    rates: dict[str, Any] = _values(cost)
    if "input" not in rates or "output" not in rates:
        return None
    tiers = []
    for tier in cost.get("tiers") or []:
        size = (tier.get("tier") or {}).get("size") if isinstance(tier, dict) else None
        values = _values(tier) if isinstance(tier, dict) else {}
        if isinstance(size, int) and values:
            tiers.append({"above": size, **values})
    legacy = cost.get("context_over_200k")
    if not tiers and isinstance(legacy, dict) and _values(legacy):
        tiers.append({"above": 200_000, **_values(legacy)})
    if tiers:
        rates["tiers"] = sorted(tiers, key=lambda tier: tier["above"])
    return rates


def rates_from_amendment(item: dict[str, Any], where: str) -> dict[str, Any]:
    rates: dict[str, Any] = _values(item)
    if "input" not in rates or "output" not in rates:
        raise PriceDataError(f"{where}: input and output rates are required")
    tiers = []
    for tier in item.get("tiers") or []:
        if not isinstance(tier, dict) or not isinstance(tier.get("above"), int):
            raise PriceDataError(f"{where}: each tier needs an integer `above`")
        tiers.append({"above": tier["above"], **_values(tier)})
    if tiers:
        rates["tiers"] = sorted(tiers, key=lambda tier: tier["above"])
    return rates


def output_rates(rates: dict[str, Any] | None) -> dict[str, Any] | None:
    """Rates as prices.json stores them, with camelCase names."""
    if rates is None:
        return None

    def converted(values: dict[str, Any]) -> dict[str, Any]:
        names = {"cache_read": "cacheRead", "cache_write": "cacheWrite"}
        return {names.get(key, key): value for key, value in values.items() if key != "tiers"}

    stored = converted(rates)
    if rates.get("tiers"):
        stored["tiers"] = [converted(tier) for tier in rates["tiers"]]
    return stored


# ---------------------------------------------------------------------------
# models.dev history
# ---------------------------------------------------------------------------


@dataclass
class Entry:
    start: datetime
    commit: str
    rates: dict[str, Any] | None


@dataclass
class Listing:
    """One models.dev model file's price history."""

    entries: list[Entry] = field(default_factory=list)
    link: tuple[str, str] | None = None
    canonical: str | None = None
    deprecated: bool = False

    def add(self, start: datetime, commit: str, rates: dict[str, Any] | None) -> None:
        if self.entries and self.entries[-1].rates == rates:
            return
        if self.entries and self.entries[-1].start == start:
            self.entries[-1] = Entry(start, commit, rates)
        else:
            self.entries.append(Entry(start, commit, rates))


def git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    ).stdout


def _changes(repo: Path) -> Iterator[tuple[str, str, datetime, list[tuple[str, str]]]]:
    """Yield (commit, committed_at, [(status, path)]) for model file changes on main."""
    log = git(
        repo, "log", "--reverse", "--first-parent", "--diff-merges=first-parent",
        "--no-renames", "--name-status", "--format=%x00%H %cI", "--", "providers",
    )
    commit, committed_at, files = "", EARLIEST, []
    for line in log.splitlines():
        if line.startswith("\0"):
            if files:
                yield commit, committed_at, files
            commit, stamp = line[1:].split(" ", 1)
            committed_at, files = parse_time(stamp), []
            continue
        status, _, path = line.partition("\t")
        parts = path.split("/")
        if (status in {"A", "M", "D"} and path.endswith(".toml")
                and len(parts) >= 4 and parts[0] == "providers" and parts[2] == "models"):
            files.append((status, path))
    if files:
        yield commit, committed_at, files


def _read_blobs(repo: Path, specs: list[str]) -> list[bytes | None]:
    process = subprocess.run(
        ["git", "-C", str(repo), "cat-file", "--batch"],
        input="".join(f"{spec}\n" for spec in specs).encode(),
        check=True, capture_output=True,
    )
    output, offset, blobs = process.stdout, 0, []
    for _ in specs:
        end = output.index(b"\n", offset)
        header = output[offset:end].split()
        offset = end + 1
        if len(header) < 3 or header[1] != b"blob":
            blobs.append(None)
            continue
        size = int(header[2])
        blobs.append(output[offset:offset + size])
        offset += size + 1
    return blobs


def _link_target(blob: bytes) -> str | None:
    """A symlinked model file's blob is just the relative path of its target."""
    text = blob.decode(errors="replace").strip()
    if "\n" in text or "=" in text or not text.endswith(".toml"):
        return None
    return text


def _key(path: str) -> tuple[str, str]:
    _, provider, _, *model = path.removesuffix(".toml").split("/")
    return provider, "/".join(model)


def _merge(base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in overrides.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _omit(document: dict[str, Any], paths: list[str]) -> dict[str, Any]:
    document = json.loads(json.dumps(document))
    for path in paths:
        parts, current = path.split("."), document
        for part in parts[:-1]:
            current = current.get(part) if isinstance(current, dict) else None
        if isinstance(current, dict):
            current.pop(parts[-1], None)
    return document


def read_history(repo: Path) -> dict[tuple[str, str], Listing]:
    """Replay every models.dev model file change on main into price histories.

    Files written with `[extends]` (used by some providers, including GitHub Copilot,
    from late May to early June 2026) take the extended file's fields at the same
    commit, and change again whenever the extended file changes.
    """
    changes = list(_changes(repo))
    blobs = iter(_read_blobs(repo, [
        f"{commit}:{path}" for commit, _, files in changes for status, path in files
        if status != "D"
    ]))
    listings: dict[tuple[str, str], Listing] = {}
    documents: dict[tuple[str, str], dict[str, Any]] = {}
    extends: dict[tuple[str, str], dict[str, Any]] = {}

    def resolved(key: tuple[str, str], seen: frozenset = frozenset()) -> dict[str, Any] | None:
        if key in extends:
            config = extends[key]["extends"]
            source = config.get("from", "")
            target = tuple(source.split("/", 1)) if "/" in source else None
            if target is None or target in seen:
                return None
            base = resolved(target, seen | {key})
            if base is None:
                return None
            overrides = {name: value for name, value in extends[key].items() if name != "extends"}
            return _omit(_merge(base, overrides), config.get("omit") or [])
        return documents.get(key)

    for commit, committed_at, files in changes:
        touched: set[tuple[str, str]] = set()
        for status, path in files:
            key = _key(path)
            touched.add(key)
            listing = listings.setdefault(key, Listing())
            documents.pop(key, None)
            extends.pop(key, None)
            if status == "D":
                continue
            blob = next(blobs)
            if blob is None:
                continue
            target = _link_target(blob)
            if target is not None:
                # A link can point into another provider's folder, such as StepFun's
                # global models linking to its China ones.
                linked = posixpath.normpath(posixpath.join(posixpath.dirname(path), target))
                parts = linked.split("/")
                listing.link = (_key(linked) if len(parts) >= 4 and parts[0] == "providers"
                                and parts[2] == "models" else None)
                continue
            try:
                document = tomllib.loads(blob.decode())
            except (tomllib.TOMLDecodeError, UnicodeDecodeError):
                continue
            listing.link = None
            if isinstance(document.get("extends"), dict):
                extends[key] = document
                listing.canonical = document["extends"].get("from")
            else:
                documents[key] = document
                base = document.get("base_model")
                listing.canonical = base if isinstance(base, str) else None
            listing.deprecated = document.get("status") == "deprecated"
        # Re-resolve every file whose own content or extended file changed in this commit.
        dependants = {key for key, document in extends.items()
                      if tuple(document["extends"].get("from", "").split("/", 1)) in touched}
        for key in sorted(touched | dependants):
            if key in documents or key in extends:
                document = resolved(key)
                start = committed_at
                listings[key].add(start, commit[:12],
                                  rates_from_cost(document.get("cost")) if document else None)
    return listings


# ---------------------------------------------------------------------------
# Amendments
# ---------------------------------------------------------------------------


@dataclass
class Amendment:
    provider: str
    model: str
    start: datetime
    end: datetime | None
    rates: dict[str, Any]
    source: str
    basis: str
    file: str
    replaces: dict[str, float] | None = None
    until_listed: bool = False

    @property
    def precedence(self) -> int:
        return PRECEDENCE.get(self.file, len(PRECEDENCE))


def load_amendments(path: Path) -> list[Amendment]:
    document = tomllib.loads(path.read_text())
    found = []
    for index, item in enumerate(document.get("amendment", [])):
        where = f"{path.name} amendment {index + 1}"
        for name in ("provider", "model", "valid_from", "source", "basis"):
            if not isinstance(item.get(name), str) or not item[name]:
                raise PriceDataError(f"{where}: `{name}` is required")
        if item["basis"] not in BASES:
            raise PriceDataError(f"{where}: `basis` must be one of {', '.join(BASES)}")
        start = parse_time(item["valid_from"])
        end = parse_time(item["valid_until"]) if "valid_until" in item else None
        if end is not None and end <= start:
            raise PriceDataError(f"{where}: `valid_until` must be after `valid_from`")
        replaces = item.get("replaces")
        until_listed = item.get("until_listed", False) is True
        if end is None and not replaces and not until_listed:
            raise PriceDataError(
                f"{where}: an amendment without `valid_until` needs `replaces` or `until_listed`")
        if replaces is not None and (not isinstance(replaces, dict) or not _values(replaces)):
            raise PriceDataError(f"{where}: `replaces` must list rates")
        file = item.get("origin", "").rsplit("/", 1)[-1] if path.name != "manual.toml" else ""
        found.append(Amendment(
            provider=item["provider"], model=item["model"], start=start, end=end,
            rates=rates_from_amendment(item, where), source=item["source"],
            basis=item["basis"], file=file or path.name,
            replaces=_values(replaces) if replaces else None, until_listed=until_listed,
        ))
    return found


def _toml_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "[" + ", ".join(_toml_value(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{ " + ", ".join(f"{key} = {_toml_value(item)}" for key, item in value.items()) + " }"
    raise TypeError(f"cannot write {type(value).__name__} as TOML")


def write_amendments(amendments: list[dict[str, Any]], header: str) -> str:
    lines = [f"# {line}" if line else "#" for line in header.splitlines()]
    for amendment in amendments:
        lines += ["", "[[amendment]]"]
        lines += [f"{key} = {_toml_value(value)}" for key, value in amendment.items()]
    return "\n".join(lines) + "\n"


def convert_model_prices(repo: Path) -> tuple[list[dict[str, Any]], str]:
    """Convert model-prices' correction and observation files into amendments."""
    commit = git(repo, "rev-parse", "HEAD").strip()
    data = repo / "data"
    converted: list[dict[str, Any]] = []

    def common(item: dict[str, Any], origin: str) -> dict[str, Any]:
        rates = {name: float(item[name]) for name in RATE_FIELDS
                 if _number(item.get(name)) is not None}
        if "input" not in rates or "output" not in rates:
            return {}
        result: dict[str, Any] = {"provider": item["provider"], "model": item["model"]}
        result["valid_from"] = format_time(parse_time(item["valid_from"]))
        if item.get("valid_until"):
            result["valid_until"] = format_time(parse_time(item["valid_until"]))
        if item.get("replaces"):
            result["replaces"] = {name: float(value) for name, value in item["replaces"].items()
                                  if name in RATE_FIELDS}
        result.update(rates)
        tiers = [{"above": tier["above"], **{name: float(tier[name]) for name in RATE_FIELDS
                                            if _number(tier.get(name)) is not None}}
                 for tier in item.get("tiers") or []]
        if tiers:
            result["tiers"] = tiers
        result["source"] = item["source"]
        result["basis"] = item.get("basis", "documented")
        if item.get("note"):
            result["note"] = " ".join(str(item["note"]).split())
        result["origin"] = origin
        return result

    for name in ("corrections.toml", "research_corrections.toml"):
        for item in tomllib.loads((data / name).read_text()).get("correction", []):
            amendment = common(item, f"model-prices@{commit[:12]}:data/{name}")
            if amendment:
                converted.append(amendment)

    observed = json.loads((data / "observed.json").read_text())["providers"]
    for provider, models in sorted(observed.items()):
        for model, entries in sorted(models.items()):
            for position, entry in enumerate(entries):
                item = {"provider": provider, "model": model, **entry["rates"],
                        "valid_from": entry["valid_from"], "source": entry["source"],
                        "basis": "firstObserved"}
                if position + 1 < len(entries):
                    item["valid_until"] = entries[position + 1]["valid_from"]
                amendment = common(item, f"model-prices@{commit[:12]}:data/observed.json")
                if amendment:
                    if "valid_until" not in amendment:
                        # model-prices applies an observation until models.dev lists the model.
                        amendment = {**{key: value for key, value in amendment.items()
                                        if key not in {"source", "basis", "note", "origin"}},
                                     "until_listed": True,
                                     **{key: amendment[key] for key in ("source", "basis", "origin")}}
                    converted.append(amendment)
    return converted, commit


# ---------------------------------------------------------------------------
# Building the table
# ---------------------------------------------------------------------------


@dataclass
class Rated:
    rates: dict[str, Any] | None
    basis: str
    source: str


class Table:
    def __init__(self, listings: dict[tuple[str, str], Listing], amendments: list[Amendment]):
        self.listings = listings
        self.amendments: dict[tuple[str, str], list[Amendment]] = {}
        for amendment in sorted(amendments, key=lambda item: item.precedence):
            self.amendments.setdefault((amendment.provider, amendment.model), []).append(amendment)

    def _listing_at(self, key: tuple[str, str], at: datetime) -> Entry | None:
        listing = self.listings.get(key)
        if listing is None or not listing.entries:
            return None
        starts = [entry.start for entry in listing.entries]
        # A call before a model's first recorded price uses that first price.
        return listing.entries[max(bisect_right(starts, at) - 1, 0)]

    def _listed_by(self, key: tuple[str, str], at: datetime) -> bool:
        """Whether models.dev listed a price for the model at or before `at`."""
        listing = self.listings.get(key)
        return any(entry.rates is not None and entry.start <= at
                   for entry in (listing.entries if listing else []))

    def _target(self, key: tuple[str, str], at: datetime) -> tuple[str, str] | None:
        """The file an alias follows at `at`, before the alias has a price of its own."""
        listing = self.listings.get(key)
        if listing is None or listing.link is None:
            return None
        if listing.entries and listing.entries[0].start <= at:
            return None
        return listing.link

    def _recorded(self, key: tuple[str, str], at: datetime, seen: frozenset) -> Entry | None:
        """What models.dev alone listed for the model at `at`, following an alias."""
        target = self._target(key, at)
        if target is not None and target not in seen:
            return self._recorded(target, at, seen | {key})
        return self._listing_at(key, at)

    def rated(self, key: tuple[str, str], at: datetime, seen: frozenset = frozenset()) -> Rated | None:
        for amendment in self.amendments.get(key, []):
            if not (amendment.start <= at and (amendment.end is None or at < amendment.end)):
                continue
            if amendment.replaces is not None:
                recorded = self._recorded(key, at, seen)
                if recorded is None or recorded.rates is None or any(
                        recorded.rates.get(name) != value
                        for name, value in amendment.replaces.items()):
                    continue
            if amendment.until_listed and self._listed_by(key, at):
                continue
            return Rated(amendment.rates, amendment.basis, amendment.source)
        target = self._target(key, at)
        if target is not None and target not in seen:
            return self.rated(target, at, seen | {key})
        entry = self._listing_at(key, at)
        if entry is None:
            return None
        return Rated(entry.rates, "modelsDevCommit", entry.commit)

    def change_times(self, key: tuple[str, str], seen: frozenset = frozenset()) -> set[datetime]:
        times = {entry.start for entry in self.listings.get(key, Listing()).entries}
        for amendment in self.amendments.get(key, []):
            times |= {amendment.start} | ({amendment.end} if amendment.end else set())
        listing = self.listings.get(key)
        if listing and listing.link and listing.link not in seen:
            times |= self.change_times(listing.link, seen | {key})
        return times

    def timeline(self, key: tuple[str, str]) -> list[dict[str, Any]]:
        intervals: list[dict[str, Any]] = []
        for at in [EARLIEST, *sorted(self.change_times(key))]:
            found = self.rated(key, at)
            if found is None:
                continue
            interval = {"start": None if at is EARLIEST else format_time(at),
                        "rates": output_rates(found.rates)}
            # Most intervals come from a models.dev commit, so that basis is implied by
            # `commit`; an amendment's interval has `basis` and `source` instead.
            if found.basis == "modelsDevCommit":
                interval["commit"] = found.source
            else:
                interval["basis"] = found.basis
                interval["source"] = found.source
            if intervals and {**intervals[-1], "start": None} == {**interval, "start": None}:
                continue
            intervals.append(interval)
        # A file without a price before its first one adds nothing: a call before a
        # model's first price uses that first price. A model never priced is left out.
        while intervals and intervals[0]["rates"] is None:
            intervals.pop(0)
        if intervals:
            intervals[0]["start"] = None
        return intervals

    def lab_equivalent(self, key: tuple[str, str]) -> str | None:
        """The lab's own API entry for a model, from its models.dev canonical ID."""
        listing = self.listings.get(key)
        canonical = listing.canonical if listing else None
        if not canonical or "/" not in canonical:
            return None
        lab, model = canonical.split("/", 1)
        provider = LAB_PROVIDERS.get(lab, lab)
        if (provider, model) == key:
            return None
        if self.listings.get((provider, model), Listing()).entries:
            return f"{provider}/{model}"
        # The lab's own provider may list the model under another ID, such as a dated one.
        serving = sorted(
            (other.deprecated, other_key[1])
            for other_key, other in self.listings.items()
            if other_key[0] == provider and other_key != key
            and other.canonical == canonical and other.entries
        )
        return f"{provider}/{serving[0][1]}" if serving else None


def load_billing_modes(path: Path) -> list[dict[str, Any]]:
    document = tomllib.loads(path.read_text())
    modes = []
    for index, item in enumerate(document.get("mode", [])):
        where = f"{path.name} mode {index + 1}"
        for name in ("provider", "billing", "source"):
            if not isinstance(item.get(name), str) or not item[name]:
                raise PriceDataError(f"{where}: `{name}` is required")
        if item["billing"] not in BILLING:
            raise PriceDataError(f"{where}: `billing` must be one of {', '.join(BILLING)}")
        mode = {"provider": item["provider"], "billing": item["billing"]}
        for name in ("harness", "price_provider", "valid_from", "valid_until"):
            if name in item:
                value = item[name]
                if name.startswith("valid_"):
                    value = format_time(parse_time(value))
                mode[{"price_provider": "priceProvider", "valid_from": "validFrom",
                      "valid_until": "validUntil"}.get(name, name)] = value
        mode["source"] = item["source"]
        modes.append(mode)
    return modes


def build(models_dev: Path, data: Path) -> dict[str, Any]:
    listings = read_history(models_dev)
    amendments = [amendment for path in sorted((data / "amendments").glob("*.toml"))
                  for amendment in load_amendments(path)]
    table = Table(listings, amendments)
    keys = sorted({*listings, *table.amendments})
    providers: dict[str, dict[str, Any]] = {}
    for key in keys:
        prices = table.timeline(key)
        if not prices:
            continue
        model: dict[str, Any] = {"prices": prices}
        equivalent = table.lab_equivalent(key)
        if equivalent:
            model["labEquivalent"] = equivalent
        providers.setdefault(key[0], {})[key[1]] = model
    head = git(models_dev, "log", "-1", "--format=%H %cI").split()
    imported = data / "amendments" / "imported-model-prices.toml"
    origin = next((line.split("@", 1)[1].split()[0] for line in imported.read_text().splitlines()
                   if line.startswith("# Source: model-prices@")), None) if imported.exists() else None
    return {
        "schema": SCHEMA,
        "modelsDev": {"source": MODELS_DEV_URL, "commit": head[0],
                      "committedAt": format_time(parse_time(head[1]))},
        "amendmentsImportedFrom": {"source": MODEL_PRICES_URL, "commit": origin} if origin else None,
        "billingModes": load_billing_modes(data / "billing-modes.toml"),
        "providers": providers,
    }


def serialize(table: dict[str, Any]) -> str:
    """One model per line, so price updates show as small diffs."""
    compact = {"separators": (",", ":"), "sort_keys": True, "ensure_ascii": False}
    lines = ["{"]
    header = {key: value for key, value in table.items() if key != "providers"}
    for key in sorted(header):
        lines.append(f"{json.dumps(key)}:{json.dumps(header[key], **compact)},")
    lines.append('"providers":{')
    providers = sorted(table["providers"].items())
    for provider_index, (provider, models) in enumerate(providers):
        lines.append(f"{json.dumps(provider)}:{{")
        items = sorted(models.items())
        for index, (model, value) in enumerate(items):
            comma = "," if index + 1 < len(items) else ""
            lines.append(f"{json.dumps(model, ensure_ascii=False)}:{json.dumps(value, **compact)}{comma}")
        lines.append("}" + ("," if provider_index + 1 < len(providers) else ""))
    lines += ["}", "}"]
    return "\n".join(lines) + "\n"


IMPORT_HEADER = """Generated by scripts/update-prices.py import-amendments. Do not edit: add corrections
to manual.toml, which takes precedence.

Source: model-prices@{commit} ({url})
Converted from data/corrections.toml, data/research_corrections.toml and
data/observed.json. Copyright (c) 2026 wakamex, MIT licence: see data/prices/LICENSE.model-prices."""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest="command", required=True)
    importer = commands.add_parser("import-amendments", help="convert model-prices corrections")
    importer.add_argument("--model-prices", type=Path, required=True)
    importer.add_argument("--data", type=Path, default=DATA)
    builder = commands.add_parser("build", help="write prices.json")
    builder.add_argument("--models-dev", type=Path, required=True)
    builder.add_argument("--data", type=Path, default=DATA)
    builder.add_argument("--check", action="store_true",
                         help="fail instead of writing when prices.json would change")
    args = parser.parse_args(argv)

    try:
        if args.command == "import-amendments":
            amendments, commit = convert_model_prices(args.model_prices)
            output = args.data / "amendments" / "imported-model-prices.toml"
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(write_amendments(
                amendments, IMPORT_HEADER.format(commit=commit, url=MODEL_PRICES_URL)))
            # The written file must load under the same rules build applies.
            load_amendments(output)
            print(f"wrote {len(amendments)} amendments to {output}")
            return 0
        text = serialize(build(args.models_dev, args.data))
        output = args.data / "prices.json"
        if args.check:
            if not output.exists() or output.read_text() != text:
                print(f"{output} does not match its inputs; run build", file=sys.stderr)
                return 1
            print(f"{output} matches its inputs")
            return 0
        output.write_text(text)
        print(f"wrote {output} ({len(text.encode()):,} bytes)")
        return 0
    except PriceDataError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
