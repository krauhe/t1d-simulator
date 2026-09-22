"""Retrieve ordinary public full-text routes and retain auditable identity evidence."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from io import BytesIO
from pypdf import PdfReader
from html import unescape
import hashlib, json, re, sys
sys.stdout.reconfigure(encoding="utf-8")
out = Path(__file__).resolve().parent
refs = out.parents[1] / "references"
items = [
 ("Kuppermann_2018_DKAFluidInfusionTrial.html", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6051773/", "Clinical Trial of Fluid Infusion Rates"),
 ("Simpson_2007_RW_CerebralNutrientTransporters_VERIFIED.html", "https://pmc.ncbi.nlm.nih.gov/articles/PMC2094104/", "SUPPLY AND DEMAND"),
 ("Oz_2009_HumanBrainGlycogenHypoglycemia.html", "https://pmc.ncbi.nlm.nih.gov/articles/PMC2731528/", "Human Brain Glycogen Metabolism"),
 ("Jacobson_2021_CognitivePerformance32YearsDCCT.html", "https://pmc.ncbi.nlm.nih.gov/articles/PMC8583716/", "Cognitive Performance Declines"),
 ("Phillip_2021_Pooled52WeekDEPICT.pdf", "https://eprints.whiterose.ac.uk/id/eprint/169674/1/dom.14248.pdf", "Long-term efficacy and safety"),
 ("Dandona_2018_DEPICT1_52Weeks.pdf", "https://diabetesjournals.org/care/article-pdf/41/12/2552/527116/dc181087.pdf", "DEPICT-1 52-Week"),
 ("Vallon_2020_RW_KidneyGlucoseTransporters.html", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7483786/", "Glucose transporters in the kidney"),
]
def fetch(item):
    filename, url, expected = item
    row = dict(file=filename, url=url, expected_title=expected, attempted_at=datetime.now(timezone.utc).isoformat())
    try:
        with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 scholarly-review"}),timeout=35) as r:
            body=r.read(); row.update(status=r.status,final_url=r.url,bytes=len(body))
        if filename.endswith(".pdf"):
            if not body.startswith(b"%PDF"): raise ValueError("Not a PDF")
            reader=PdfReader(BytesIO(body))
            content=" ".join(p.extract_text() for p in reader.pages)
        else:
            raw=body.decode("utf-8")
            content=unescape(re.sub("<[^>]+>"," ",raw))
            if not re.search(r"Methods|METHODS|References|REFERENCES",content): raise ValueError("Full-text body not established")
        content=re.sub(r"\s+"," ",content)
        if expected.lower() not in content.lower(): raise ValueError("Expected title not found")
        target=refs/filename
        if target.exists(): raise ValueError("Target exists; not overwritten")
        target.write_bytes(body)
        row.update(identity_verified=True,sha256=hashlib.sha256(body).hexdigest())
    except Exception as exc: row["error"]=str(exc)
    return row
with ThreadPoolExecutor(max_workers=4) as pool:
    rows=list(pool.map(fetch,items))
(out/"additional-acquisition.json").write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding="utf-8")
for row in rows: print(json.dumps(row,ensure_ascii=False))
