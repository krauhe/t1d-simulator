"""Retrieve official Europe PMC full-text XML where its public service supplies it."""
from pathlib import Path
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json, hashlib, xml.etree.ElementTree as ET
out=Path(__file__).resolve().parent
refs=out.parents[1]/"references"
items=[("Oz_2009_HumanBrainGlycogenHypoglycemia.xml","PMC2731528","Human Brain Glycogen"),("Jacobson_2021_CognitivePerformance32YearsDCCT.xml","PMC8583716","Cognitive Performance"),("Vallon_2020_RW_KidneyGlucoseTransporters.xml","PMC7483786","Glucose transporters")]
def run(item):
    filename,pmcid,expected=item
    url=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
    row=dict(file=filename,url=url,attempted_at=datetime.now(timezone.utc).isoformat())
    try:
        with urlopen(url,timeout=30) as r: body=r.read(); row.update(status=r.status,final_url=r.url)
        article=ET.fromstring(body); title="".join(article.find(".//article-title").itertext())
        if expected.lower() not in title.lower() or article.find(".//body") is None: raise ValueError("Title/body mismatch")
        target=refs/filename
        if target.exists(): raise ValueError("Existing target not overwritten")
        target.write_bytes(body)
        row.update(title=title,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),identity_verified=True)
    except Exception as exc: row["error"]=str(exc)
    return row
with ThreadPoolExecutor(max_workers=3) as pool: rows=list(pool.map(run,items))
(out/"open-xml-acquisition.json").write_text(json.dumps(rows,indent=2),encoding="utf-8")
for row in rows: print(json.dumps(row))
