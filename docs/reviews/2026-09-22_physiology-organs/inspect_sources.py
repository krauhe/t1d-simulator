"""Inspect retained physiological source sections without altering the originals."""
import argparse
from pathlib import Path
import re
from html import unescape
import sys
from pypdf import PdfReader
sys.stdout.reconfigure(encoding="utf-8")
p = argparse.ArgumentParser()
p.add_argument("filename")
p.add_argument("--pages", default="")
p.add_argument("--match", default="")
p.add_argument("--tables", action="store_true")
a = p.parse_args()
source = Path("docs/references") / a.filename
if source.suffix == ".pdf":
    pages = set()
    for part in a.pages.split(","):
        if part:
            span = [int(v) for v in part.split("-")]
            pages.update(range(span[0], span[-1] + 1))
    for n, page in enumerate(PdfReader(source).pages, 1):
        body = page.extract_text()
        if (not pages or n in pages) and (not a.match or re.search(a.match, body, re.I)):
            print(f"\nPAGE {n}\n{body}")
else:
    raw = source.read_text(encoding="utf-8")
    raw = re.sub(r"<(script|style)[\s\S]*?</\1>", "", raw)
    chunks = re.findall(r"<(?:p|title|article-title|table|table-wrap|h[1-6])(?:\s[^>]*)?>[\s\S]*?</(?:p|title|article-title|table|table-wrap|h[1-6])>", raw)
    if a.tables:
        chunks = re.findall(r"<table(?:\s[^>]*)?>[\s\S]*?</table>", raw)
    for chunk in chunks:
        body = unescape(re.sub("<[^>]+>", " ", chunk))
        body = re.sub(r"\s+", " ", body)
        if not a.match or re.search(a.match, body, re.I):
            print(body)
