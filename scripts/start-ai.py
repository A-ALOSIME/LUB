"""Start the local independent service without passing database/auth secrets."""
import os
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent
environment = {key: value for key, value in os.environ.items() if key.upper() in {"PATH", "SYSTEMROOT", "TEMP", "TMP", "HOME", "USERPROFILE", "LANG"}}
token = os.environ.get("AI_SERVICE_TOKEN", "")
if not token and (root / ".env.local").exists():
    match = re.search(r"^AI_SERVICE_TOKEN=(.*)$", (root / ".env.local").read_text(encoding="utf-8"), re.MULTILINE)
    if match:
        token = match[1].strip().strip("\"'")
environment["AI_SERVICE_TOKEN"] = token
environment["PYTHONIOENCODING"] = "utf-8"
python = root / "services/ai/.venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
raise SystemExit(subprocess.call([str(python), "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000", "--workers", "1", "--no-access-log"], cwd=root / "services/ai", env=environment))
