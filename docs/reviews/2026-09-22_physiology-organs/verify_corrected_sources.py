"""Identify corrected citations and verify their concrete local-PC destinations."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
from html import unescape
import json, re, sys
sys.stdout.reconfigure(encoding="utf-8")
out=Path(__file__).resolve().parent
queries=[
 'TITLE:"Sugar for the brain" AND AUTH_FIRST:Mergenthaler',
 'TITLE:"Steady-state brain glucose transport kinetics"',
 'TITLE:"GLUT-1 glucose transporters in the blood-brain barrier"',
 'TITLE:"Hypoglycemia in type 1 diabetes" AND AUTH_FIRST:McCrimmon',
 'TITLE:"Philip E. Cryer" AND AUTH_FIRST:Dagogo-Jack',
 'TITLE:"Cognitive Performance Declines" AND AUTH_FIRST:Jacobson',
 'TITLE:"Clinical Trial of Fluid Infusion Rates"',
 'TITLE:"Neuronal damage and cognitive impairment associated with hypoglycemia"',
 'TITLE:"Sudden death in type 1 diabetes" AND AUTH_FIRST:Tu',
 'TITLE:"Confirmation of hypoglycemia" AND AUTH_FIRST:Tanenberg',
 'EXT_ID:32946821 AND SRC:MED', 'EXT_ID:7491135 AND SRC:MED',
 'EXT_ID:6714538 AND SRC:MED', 'EXT_ID:28028821 AND SRC:MED',
 'EXT_ID:22783644 AND SRC:MED', 'EXT_ID:33197066 AND SRC:MED',
 'EXT_ID:23961473 AND SRC:MED', 'EXT_ID:27042263 AND SRC:MED',
 'EXT_ID:19502412 AND SRC:MED', 'EXT_ID:30132032 AND SRC:MED',
 'EXT_ID:17579656 AND SRC:MED', 'EXT_ID:22027938 AND SRC:MED',
]
def get(url):
    with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0 scholarly-review"}),timeout=30) as r: return r.status,r.url,r.read()
def run(query):
    url="https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="+quote(query)+"&format=json&resultType=core"
    row=dict(query=query,checked_at=datetime.now(timezone.utc).isoformat(),metadata_url=url)
    try:
        status,final,body=get(url)
        records=json.loads(body)["resultList"]["result"]
        row.update(metadata_status=status,records=records)
        if records:
            record=records[0]
            destination="https://pubmed.ncbi.nlm.nih.gov/"+record["id"]+"/"
            row["destination"]=destination
            try:
                s,f,b=get(destination)
                html=b.decode("utf-8",errors="replace")
                title=re.search(r"<title[^>]*>(.*?)</title>",html,re.S|re.I)
                row.update(destination_status=s,destination_final=f,destination_title=unescape(title[1].strip()) if title else "MISSING")
            except Exception as exc: row["destination_error"]=str(exc)
    except Exception as exc: row["error"]=str(exc)
    return row
with ThreadPoolExecutor(max_workers=5) as pool: rows=list(pool.map(run,queries))
(out/"corrected-source-verification.json").write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding="utf-8")
for row in rows:
    print(row["query"])
    for r in row.get("records",[])[:2]: print(r.get("id"),r.get("title"),r.get("authorString"),r.get("pubYear"),r.get("pmcid"),r.get("doi"))
    print(row.get("destination_status"),row.get("destination_title"),row.get("destination_error",row.get("error","")))
