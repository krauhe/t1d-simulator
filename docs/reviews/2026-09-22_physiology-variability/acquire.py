"""Retrieve authorised public full texts and log local access separately from appraisal."""
from pathlib import Path
from urllib.request import Request, urlopen
import json, hashlib, io, re
import xml.etree.ElementTree as ET
from pypdf import PdfReader
ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
REF = ROOT / "docs/references"
SOURCES = [
("verhulst2022","https://discovery.dundee.ac.uk/ws/files/77405021/Verhulst2022_Article_GlycaemicThresholdsForCounterr.pdf","Verhulst_2022_RW_GlycaemicThresholds.pdf","Glycaemic"),
("phelan2022","https://www.ispad.org/static/6551d05a-156c-4772-a32a6d663fcfc2d4/2022CGCh13PediatricDiabetes-2.pdf","Phelan_2022_RW_SickDayManagement.pdf","Phelan"),
("glaser2022","https://www.ispad.org/static/6dd62eae-c8cb-4b4a-84e1efc768505746/Ch11PediatricDiabetes.pdf","Glaser_2022_RW_DKA_ISPAD.pdf","Glaser"),
("umpierrez2024","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11272983/fullTextXML","Umpierrez_2024_RW_HyperglycemicCrises.xml","Hyperglycemic Crises"),
("gonzalez2025","https://d-nb.info/1373067012/34","GonzalezVidal_2025_PostHypoglycemicNocturnalHyperglycemia.pdf","Post-hypoglycemic"),
("basu2015","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4495531/fullTextXML","Basu_2015_InterstitialGlucoseLag.xml","Time Lag"),
("saad2012","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3478548/fullTextXML","Saad_2012_DiurnalInsulinSecretionAction.xml","Diurnal"),
("beck2019","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6868469/fullTextXML","Beck_2019_TIR_HbA1c.xml","Relationships"),
("donga2010","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2890361/fullTextXML",None,"Donga"),
("gamarra2023","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9962060/fullTextXML",None,"Gamarra"),
("battelino2019","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6973648/fullTextXML",None,"Battelino"),
("steiner2015","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4693236/fullTextXML",None,"Steiner"),
("mcCrimmon2010","https://doi.org/10.2337/db09-0942",None,"Hypoglycemia"),
("siler1998","https://doi.org/10.1152/ajpendo.1998.275.5.E897",None,"Siler"),
("basu2015_pdf","https://journals.sagepub.com/doi/pdf/10.1177/1932296814554797","Basu_2015_InterstitialGlucoseLag.pdf","Time Lag"),
("umpierrez2024_alt","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC11343900/fullTextXML","Umpierrez_2024_RW_HyperglycemicCrises.xml","Hyperglycaemic crises"),
("beck2019_pdf","https://journals.sagepub.com/doi/pdf/10.1177/1932296818822496","Beck_2019_TIR_HbA1c.pdf","Relationships"),
("mcCrimmon2010_correct","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC3279554/fullTextXML",None,"McCrimmon"),
("beck2019_correct","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6610606/fullTextXML","Beck_2019_TIR_Hyperglycemia_HbA1c.xml","Relationships"),
("fisher2014","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4065190/fullTextXML","Fisher_2014_RW_DepressionDistress.xml","confusing tale"),
("gradel2018","https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6079517/fullTextXML",None,"Factors Affecting"),
("beck2019_html","https://pmc.ncbi.nlm.nih.gov/articles/PMC6610606/","Beck_2019_TIR_Hyperglycemia_HbA1c.html","Relationships"),
("fisher2014_html","https://pmc.ncbi.nlm.nih.gov/articles/PMC4065190/","Fisher_2014_RW_DepressionDistress.html","confusing tale"),
("basu2015_html","https://pmc.ncbi.nlm.nih.gov/articles/PMC4495531/","Basu_2015_InterstitialGlucoseLag.html","Time Lag")
]
results=json.loads((OUT/"acquisition.json").read_text(encoding="utf-8")) if (OUT/"acquisition.json").exists() else []
done={r["id"] for r in results}
for sid,url,name,identity in SOURCES:
 if sid in done: continue
 r={"id":sid,"date":"2026-09-22","requested_url":url}
 try:
  with urlopen(Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=22) as response:
   data=response.read(); r.update(status=response.status,final_url=response.geturl(),bytes=len(data),content_type=response.headers.get("Content-Type"),sha256=hashlib.sha256(data).hexdigest())
  if data.startswith(b"%PDF"):
   doc=PdfReader(io.BytesIO(data)); body="\n".join(p.extract_text() or "" for p in doc.pages); r["pages"]=len(doc.pages); form="pdf"
  elif b"<article" in data[:2000]:
   doc=ET.fromstring(data); body=" ".join(doc.itertext()); form="xml"
  else:
   body=re.sub("<[^>]+>"," ",data.decode("utf-8",errors="replace")); form="html"
  r.update(format=form,identity_candidate=identity.casefold() in body.casefold(),text_length=len(body),opening_excerpt=body[:850])
  if name and r["identity_candidate"] and len(body)>3000 and (form in ("pdf","xml") or (form=="html" and 'article' in data.decode('utf-8',errors='replace').lower() and 'references' in body.lower())):
   target=REF/name
   if target.exists():
    r["retained_status"]="existing_file_preserved"
   else:
    target.write_bytes(data); r["retained_status"]="acquired"
   r["local_file"]=str(target.relative_to(ROOT))
 except Exception as exc: r.update(error=str(exc),status=getattr(exc,"code",None))
 results.append(r)
 print(sid, r.get("status"),r.get("identity_candidate"),r.get("retained_status"),flush=True)
(OUT/"acquisition.json").write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
