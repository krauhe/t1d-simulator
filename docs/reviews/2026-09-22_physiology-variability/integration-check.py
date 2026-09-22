"""Snapshot and compare section hashes; this script never writes BG-SCIENCE."""
from pathlib import Path
import hashlib, json, re, sys

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
document = (ROOT / 'docs/BG-SCIENCE.md').read_text(encoding='utf-8')
matches = list(re.finditer(r'^## (\d+\w?)\. ', document, re.M))
sections = {'preamble': document[:matches[0].start()]}
for index, match in enumerate(matches):
    sections[match.group(1)] = document[match.start():matches[index+1].start() if index+1 < len(matches) else len(document)]
hashes = {key: hashlib.sha256(value.encode()).hexdigest() for key, value in sections.items()}
explicit = set(re.findall(r'<a\s+(?:name|id)="([^"]+)"', document))
headings = re.findall(r'^#{1,6}\s+(.+)$', document, re.M)
def slug(title):
    title = re.sub(r'<[^>]*>', '', title).lower()
    title = re.sub(r'[^\w\s-]', '', title)
    return re.sub(r'\s+', '-', title.strip())
anchors = explicit | {slug(title) for title in headings}
targets = set(re.findall(r'\]\(#([^\s)]+)\)', document))
state = {'hashes': hashes, 'version': document.splitlines()[0], 'anchors': sorted(anchors), 'unresolved_internal_fragments': sorted(targets-anchors)}
if sys.argv[1] == 'before':
    (OUT/'integration-before.json').write_text(json.dumps(state, indent=2), encoding='utf-8')
    print('Before snapshot saved:', len(sections), 'sections')
else:
    before = json.loads((OUT/'integration-before.json').read_text())
    changed = [key for key, digest in hashes.items() if before['hashes'].get(key) != digest]
    allowed = {str(i) for i in range(11, 28)} - {'22'}
    report = {'changed_sections': changed, 'out_of_scope_changes': [key for key in changed if key not in allowed], 'version_preserved': state['version']==before['version'], 'version':state['version'], 'removed_explicit_or_heading_anchors':sorted(set(before['anchors'])-anchors), 'new_unresolved_internal_fragments': sorted(set(state['unresolved_internal_fragments'])-set(before['unresolved_internal_fragments'])), 'current_unresolved_internal_fragments':state['unresolved_internal_fragments']}
    (OUT/'integration-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
