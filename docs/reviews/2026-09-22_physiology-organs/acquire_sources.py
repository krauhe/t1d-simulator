"""Record local source identity checks and retrieve selected lawful physiology originals."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib, json, re, sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
import xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding="utf-8")
out = Path(__file__).resolve().parent
refs = out.parents[1] / "references"
ids = "20546255 30132032 28143897 24014904 27042271 6714538 11213896 23933069 19890463 21910135 17579656 22027938 8544261 24095133 27288006 24015370 20723825 16848698 24018961 11172153 33289956 19604134 20223987 32946821 23735727".split()
def get(url):
    with urlopen(Request(url, headers={"User-Agent":"Mozilla/5.0 scholarly-review"}), timeout=35) as r:
        return r.status, r.url, r.read()
def metadata(pmid):
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=" + quote("EXT_ID:" + pmid + " AND SRC:MED") + "&format=json&resultType=core"
    row = {"pmid_requested":pmid,"url":url,"attempted_at":datetime.now(timezone.utc).isoformat()}
    try:
        status, final, body = get(url)
        row.update(http_status=status,final_url=final,record=json.loads(body)["resultList"]["result"][0])
    except Exception as exc: row["error"]=str(exc)
    return row
with ThreadPoolExecutor(max_workers=5) as pool:
    rows = list(pool.map(metadata, ids))
(out/"metadata.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf-8")
for row in rows:
    r=row.get("record",{})
    print(row["pmid_requested"],r.get("title"),r.get("pmcid"),r.get("doi"),row.get("error",""))
candidates = [
 ("Ghezzi_2018_RW_RenalGlucoseHandling_VERIFIED.xml","PMC6133168","Physiology of renal glucose handling"),
 ("Simpson_2007_RW_CerebralNutrientTransporters_VERIFIED.xml","PMC2094104","SUPPLY AND DEMAND"),
 ("Kuppermann_2018_DKAFluidInfusionTrial.xml","PMC6051773","Clinical Trial of Fluid Infusion"),
]
acquired=[]
for filename,pmcid,expected in candidates:
    url=f"https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
    row={"file":filename,"url":url,"attempted_at":datetime.now(timezone.utc).isoformat(),"expected_title":expected}
    try:
        status, final, body=get(url)
        xml=ET.fromstring(body)
        title="".join(xml.find(".//article-title").itertext())
        if expected.lower() not in title.lower() or xml.find(".//body") is None: raise ValueError("Identity/body mismatch: "+title)
        target=refs/filename
        if target.exists() and hashlib.sha256(target.read_bytes()).digest()!=hashlib.sha256(body).digest(): raise ValueError("Existing file differs; not overwritten")
        target.write_bytes(body)
        row.update(status=status,final_url=final,title=title,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),full_text=True)
    except Exception as exc: row["error"]=str(exc)
    acquired.append(row)
    print(json.dumps(row,ensure_ascii=False))
(out/"acquisition.json").write_text(json.dumps(acquired,ensure_ascii=False,indent=2),encoding="utf-8")
