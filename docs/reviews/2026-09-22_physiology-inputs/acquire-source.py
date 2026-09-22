"""Acquire only a confirmed PDF from a known lawful source, without overwriting."""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("url")
parser.add_argument("target")
parser.add_argument("--html-title", help="Expected article title for a lawful full-text HTML fallback")
args = parser.parse_args()
target = Path(args.target)
if target.exists():
    raise SystemExit("Refusing to overwrite an existing article")
try:
    request = urllib.request.Request(args.url, headers={"User-Agent": "Mozilla/5.0 scholarly-review"})
    with urllib.request.urlopen(request, timeout=25) as response:
        content = response.read(20_000_000)
        result = {"requested_url": args.url, "final_url": response.url, "status": response.status,
                  "content_type": response.headers.get("Content-Type"), "bytes": len(content)}
    if args.html_title and args.html_title.lower() in content.decode("utf-8", errors="replace").lower():
        target.write_bytes(content)
        result.update(acquired=True, path=str(target), sha256=hashlib.sha256(content).hexdigest(),
                      note="HTML identity matched; inspect Methods/Results before declaring full-text appraisal")
    elif not content.startswith(b"%PDF-"):
        result.update(acquired=False, reason="Response is not a PDF; no article file written")
    else:
        target.write_bytes(content)
        result.update(acquired=True, path=str(target), sha256=hashlib.sha256(content).hexdigest())
except Exception as error:
    result = {"requested_url": args.url, "acquired": False, "status": getattr(error, "code", None), "error": str(error)}
print(json.dumps(result, ensure_ascii=False, indent=2))
