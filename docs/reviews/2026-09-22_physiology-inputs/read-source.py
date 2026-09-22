"""Read retained articles for this audit; no source files are modified."""
import argparse
from html.parser import HTMLParser
from pathlib import Path


class TextReader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("p", "sec", "section", "title", "h1", "h2", "h3", "tr", "abstract"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


parser = argparse.ArgumentParser()
parser.add_argument("path")
parser.add_argument("--pages", help="Comma-separated one-based PDF pages")
parser.add_argument("--find", help="Start at the first occurrence of this exact text")
parser.add_argument("--start", type=int, default=0)
parser.add_argument("--length", type=int, default=18000)
args = parser.parse_args()
path = Path(args.path)
if path.suffix.lower() == ".pdf":
    from pypdf import PdfReader
    reader = PdfReader(path)
    selected = [int(x) - 1 for x in args.pages.split(",")] if args.pages else range(len(reader.pages))
    result = "\n".join(f"PAGE {i + 1}\n{reader.pages[i].extract_text()}" for i in selected)
else:
    reader = TextReader()
    reader.feed(path.read_text(encoding="utf-8"))
    result = "\n".join(" ".join(line.split()) for line in "".join(reader.parts).splitlines() if line.strip())
start = args.start
if args.find:
    start = result.find(args.find)
    if start < 0:
        raise SystemExit(f"Text not found: {args.find}")
print(f"SOURCE {path.name}; total characters {len(result)}; output starts {start}\n")
print(result[start:start + args.length])
