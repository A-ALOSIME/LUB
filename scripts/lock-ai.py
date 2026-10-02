"""Maintain pinned wheel hashes from PyPI; review lock diffs before installing."""
import importlib.metadata
import json
from pathlib import Path
from urllib.request import urlopen

directory = Path(__file__).resolve().parent.parent / "services/ai"
production = ["annotated-doc", "annotated-types", "anyio", "click", "fastapi", "h11", "idna", "pydantic", "pydantic-core", "starlette", "typing-extensions", "typing-inspection", "uvicorn"]
testing = ["httpx2", "httpcore2", "truststore"]
for filename, names, prefix in [("requirements.lock", production, ""), ("requirements-test.lock", testing, "-r requirements.lock\n")]:
    lines = ["# Exact versions and wheel hashes from https://pypi.org; Python 3.12.\n", prefix]
    for name in sorted(names):
        version = importlib.metadata.version(name)
        with urlopen(f"https://pypi.org/pypi/{name}/{version}/json", timeout=15) as response:
            package = json.load(response)
        hashes = sorted({file["digests"]["sha256"] for file in package["urls"] if file["packagetype"] == "bdist_wheel"})
        if not hashes:
            raise RuntimeError("No wheel available")
        lines.append(name + "==" + version + " \\\n" + " \\\n".join("    --hash=sha256:" + value for value in hashes) + "\n")
    (directory / filename).write_text("".join(lines), encoding="utf-8")
print("Python wheel lock files updated; review before installing.")
