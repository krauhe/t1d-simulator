"""Read-only chapter checks and local HTTP/identity evidence; never edit source prose."""
from pathlib import Path
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor
import json, re, hashlib
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
KB = Path('C:/Dropbox/Kristian/Diabetes/t1d-serious-games-knowledge-base')
CHAPTER = KB / 'knowledge/physiology/variability-and-safety.qmd'
prose = CHAPTER.read_text(encoding='utf-8')
urls = sorted(set(re.findall(r'\]\((https://[^\s)]+)\)', prose)))

def get(url):
    result = {'url': url, 'date': '2026-09-22'}
    try:
        with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20) as response:
            data = response.read()
            result.update(status=response.status, final_url=response.geturl(), bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        body = data.decode('utf-8', errors='replace')
        if data.startswith(b'%PDF'):
            result['content_kind'] = 'pdf; identity inspected during acquisition'
        else:
            title = re.search(r'<title[^>]*>(.*?)</title>', body, re.S)
            result['title'] = re.sub('<[^>]+>', '', title.group(1)).strip() if title else None
            result['challenge'] = any(term in body.lower() for term in ['checking your browser', 'are you a robot', 'recaptcha', 'verify you are human'])
            if '<article' in body[:2000]:
                article = ET.fromstring(data)
                result['title'] = ' '.join(article.find('.//article-title').itertext())
    except Exception as error:
        result.update(error=str(error), status=getattr(error, 'code', None))
    return result

with ThreadPoolExecutor(max_workers=6) as pool:
    links = list(pool.map(get, urls))
(OUT / 'chapter-links.json').write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding='utf-8')

# Metadata and abstracts are explicitly not substitutes for original full texts.
ids = ['9815011', '3882489', '30636519', '25305282', '2226381', '16043731', '24606397', '30116732']
metadata = []
for pmid in ids:
    url = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:' + pmid + '%20AND%20SRC:MED&format=json&resultType=core'
    try:
        with urlopen(url, timeout=20) as response:
            data = json.load(response)
            metadata.append({'requested_pmid': pmid, 'url': url, 'status': response.status, 'records': data['resultList']['result']})
    except Exception as error:
        metadata.append({'requested_pmid': pmid, 'url': url, 'error': str(error)})
(OUT / 'abstract-identity.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')

body, refs = prose.split('## References', 1)
body_urls = set(re.findall(r'\]\((https://[^\s)]+)\)', body))
ref_urls = set(re.findall(r'\]\((https://[^\s)]+)\)', refs))
local_missing = [target for target in re.findall(r'\]\((?!https://)([^\s)]+\.qmd)\)', prose) if not (CHAPTER.parent / target).exists()]
checks = {'chapter': str(CHAPTER), 'unique_external_urls': len(urls), 'uncited_references': sorted(ref_urls-body_urls), 'missing_references': sorted(body_urls-ref_urls), 'missing_internal_links': local_missing, 'callout_fences_even': prose.count(':::') % 2 == 0, 'hash': hashlib.sha256(CHAPTER.read_bytes()).hexdigest(), 'word_count': len(prose.split()), 'build_not_run': True}
(OUT / 'verification.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
print(json.dumps(checks, indent=2))
for link in links:
    print(link['status'], link.get('title'), link['url'])
for item in metadata:
    for record in item.get('records', []):
        print('METADATA', item['requested_pmid'], record.get('title'), record.get('pmcid'), record.get('doi'))
