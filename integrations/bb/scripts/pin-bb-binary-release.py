#!/usr/bin/env python3
"""Review a published Highwater release and generate the bb plugin's checksum pins.

Run from any directory. Downloads stay under the repository's target/. Review the resulting
manifest before committing it; runtime provisioning never trusts remote checksums.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile
import urllib.request
import zipfile

PACKAGE = Path(__file__).resolve().parents[1]
ROOT = PACKAGE.parents[1]
LIMIT = 32 * 1024 * 1024
EXPANDED = 128 * 1024 * 1024
TARGETS = {
    "darwin-arm64": "aarch64-apple-darwin",
    "darwin-x64": "x86_64-apple-darwin",
    "linux-arm64": "aarch64-unknown-linux-gnu",
    "linux-x64": "x86_64-unknown-linux-gnu",
    "win32-x64": "x86_64-pc-windows-msvc",
}

def download(url, limit=LIMIT):
    with urllib.request.urlopen(url, timeout=30) as response:
        if not response.url.startswith("https://"):
            raise ValueError("Download redirected away from HTTPS")
        data = response.read(limit + 1)
        if len(data) > limit:
            raise ValueError("Download exceeds size limit")
        return data

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="Published release version, without v")
    args = parser.parse_args()
    version = args.version
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        parser.error("Expected a stable semver version")
    release = json.loads(download(f"https://api.github.com/repos/nickcox/highwater/releases/tags/v{version}"))
    if release["draft"] or release["prerelease"]:
        raise ValueError("Expected a published stable release")
    assets = {a["name"]: a for a in release["assets"]}
    sums = dict((line.split()[1], line.split()[0]) for line in download(assets["SHA256SUMS"]["browser_download_url"]).decode().splitlines())
    output = ROOT / "target" / "bb-release-pins" / version
    output.mkdir(parents=True, exist_ok=True)
    platforms = {}
    for platform, target in TARGETS.items():
        directory = f"highwater-{version}-{target}"
        archive_format = "zip" if platform.startswith("win32") else "tar.gz"
        name = f"{directory}.{archive_format}"
        asset = assets[name]
        path = output / name
        data = path.read_bytes() if path.exists() else download(asset["browser_download_url"])
        digest = sha(data)
        if len(data) != asset["size"] or digest != sums[name] or "sha256:" + digest != asset["digest"]:
            raise ValueError(f"Release checksum mismatch: {name}")
        path.write_bytes(data)
        if archive_format == "zip":
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if sum(e.file_size for e in archive.infolist()) > EXPANDED:
                    raise ValueError("Expanded archive exceeds size limit")
                contents = {e.filename: archive.read(e) for e in archive.infolist() if not e.is_dir()}
        else:
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
                entries = archive.getmembers()
                if sum(e.size for e in entries) > EXPANDED or any(not (e.isdir() or e.isfile()) for e in entries):
                    raise ValueError("Unsafe release archive")
                contents = {e.name: archive.extractfile(e).read() for e in entries if e.isfile()}
        expected = {f"{directory}/{n}" for n in ["LICENSE", "README.md", "CHANGELOG.md", "highwater.exe" if platform.startswith("win32") else "highwater"]}
        if set(contents) != expected:
            raise ValueError(f"Unexpected release files: {name}")
        binary = "highwater.exe" if platform.startswith("win32") else "highwater"
        payload = contents[f"{directory}/{binary}"]
        licence = contents[f"{directory}/LICENSE"]
        if licence.replace(b"\r\n", b"\n") != (ROOT / "LICENSE").read_bytes().replace(b"\r\n", b"\n"):
            raise ValueError("Release licence differs; review before pinning")
        platforms[platform] = {"target": target, "format": archive_format, "archiveSha256": digest, "archiveBytes": len(data), "binarySha256": sha(payload), "binaryBytes": len(payload), "licenceSha256": sha(licence)}
        print(platform, digest, sha(payload))
    release_pin = {"version": version, "platforms": platforms}
    destination = PACKAGE / "host/binary-release.json"
    old = json.loads(destination.read_text()) if destination.exists() else None
    if old and old["version"] == version and old != release_pin:
        raise ValueError("Existing pins changed for the same version; investigate the release")
    # The plugin uses only the release it pins; older pins are not kept.
    destination.write_text(json.dumps(release_pin, indent=2) + "\n")
    print(f"Review {destination}, including the release provenance, before committing.")

if __name__ == "__main__":
    main()
