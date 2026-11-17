"""Decrypt in memory and verify an existing snapshot in disposable local PGlite.

Run from the directory against which the private manifest paths were recorded.
Neither credentials nor raw records are printed or written to a plaintext file.
"""
import argparse
import gzip
import hashlib
import json
import pathlib
import subprocess
import sys

from cryptography.fernet import Fernet


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=pathlib.Path)
    parser.add_argument("--report", type=pathlib.Path)
    args = parser.parse_args()
    report = args.report or args.manifest.with_name("restore-report.json")
    stage = "manifest"
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        if manifest["project_ref"] != "rnstsczayhzrxzcstzpr":
            raise ValueError("Unexpected project")
        protected = [args.manifest, pathlib.Path(manifest["artifact"]), pathlib.Path(manifest["key_file"])]
        if report.resolve() in {path.resolve() for path in protected}:
            raise ValueError("Report must not overwrite backup inputs")
        stage = "decrypt"
        encrypted = pathlib.Path(manifest["artifact"]).read_bytes()
        expected = manifest.get("encrypted_sha256")
        if expected and hashlib.sha256(encrypted).hexdigest() != expected:
            raise ValueError("Archive checksum mismatch")
        key = pathlib.Path(manifest["key_file"]).read_bytes()
        raw = gzip.decompress(Fernet(key).decrypt(encrypted))
        stage = "local-restore"
        verifier = pathlib.Path(__file__).with_name("verify-pilot-snapshot.mjs")
        return subprocess.run(
            ["node", "--max-old-space-size=4096", str(verifier), str(report)],
            input=raw,
            check=False,
        ).returncode
    except Exception:
        # Exception details can contain record values, paths or credentials.
        print(json.dumps({"result": "FAIL_LOCAL_RESTORE", "stage": stage}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
