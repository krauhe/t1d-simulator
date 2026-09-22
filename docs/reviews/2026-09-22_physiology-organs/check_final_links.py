"""Check article destinations from this PC; distinguish interstitials from verified resources."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
from html import unescape
from io import BytesIO
from pypdf import PdfReader
import json, re, hashlib, sys
sys.stdout.reconfigure(encoding="utf-8")
out=Path(__file__).resolve().parent
kb=Path("C:/Dropbox/Kristian/Diabetes/t1d-serious-games-knowledge-base/knowledge/physiology/glucose-insulin-system.qmd")
files=[kb,*out.glob("section-*-replacement.md")]
urls=set()
for file in files: urls.update(re.findall(r"\]\((https?://[^)]+)\)",file.read_text(encoding="utf-8")))
urls.update(["https://pubmed.ncbi.nlm.nih.gov/23968694/","https://pubmed.ncbi.nlm.nih.gov/29897851/","https://pubmed.ncbi.nlm.nih.gov/23876631/","https://pubmed.ncbi.nlm.nih.gov/28151548/","https://pubmed.ncbi.nlm.nih.gov/34051936/","https://www.jci.org/articles/view/105650/files/pdf","https://escholarship.org/uc/item/0zx0g82r"])
def get(url):
    with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 scholarly-review"}),timeout=30) as r: return r.status,r.url,r.read()
def run(url):
    row=dict(url=url,checked_at=datetime.now(timezone.utc).isoformat())
    try:
        status,final,body=get(url)
        row.update(status=status,final_url=final,bytes=len(body))
        if body.startswith(b"%PDF"):
            reader=PdfReader(BytesIO(body)); bodytext=" ".join(p.extract_text() for p in reader.pages)
            row.update(title_excerpt=bodytext[:500],fulltext=True)
            if "jci.org" in url:
                if not re.search(r"Brain\s+Metabolism\s+during\s+Fasting",bodytext,re.I): raise ValueError("Owen title not matched")
                target=out.parents[1]/"references/Owen_1967_BrainMetabolismDuringFasting.pdf"
                if not target.exists(): target.write_bytes(body)
                row.update(saved_as=str(target),sha256=hashlib.sha256(body).hexdigest())
        else:
            html=body.decode("utf-8",errors="replace")
            title=re.search(r"<title[^>]*>(.*?)</title>",html,re.S|re.I)
            row["title"]=unescape(title[1].strip()) if title else "MISSING"
            row["interstitial"]=bool(re.search("Checking your browser|recaptcha|not a robot|<title>pubmed.ncbi",html,re.I))
    except Exception as exc: row["error"]=str(exc)
    pmid=re.search(r"pubmed.ncbi.nlm.nih.gov/(\d+)/",url)
    if pmid:
        api="https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="+quote("EXT_ID:"+pmid[1]+" AND SRC:MED")+"&format=json&resultType=core"
        try:
            s,f,b=get(api); record=json.loads(b)["resultList"]["result"][0]
            row.update(metadata_url=api,metadata_status=s,record=record)
        except Exception as exc: row["metadata_error"]=str(exc)
    return row
with ThreadPoolExecutor(max_workers=5) as pool: rows=list(pool.map(run,sorted(urls)))
(out/"final-link-verification.json").write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding="utf-8")
for row in rows: print(row["url"],row.get("status"),row.get("title",row.get("title_excerpt",""))[:90],row.get("record",{}).get("title"),row.get("error",""))
