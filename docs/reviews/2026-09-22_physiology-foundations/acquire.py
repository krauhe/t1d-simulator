"""Lawful source acquisition for the physiological-foundations revision.

The log records technical access only. Identity and claim support are appraised
separately in the review record. Existing reading copies are preserved.
"""
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError
from datetime import datetime, timezone
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[3]
SOURCES = [
    ("Basu 2015", "https://journals.sagepub.com/doi/pdf/10.1177/1932296814554797", "Basu_2015_PlasmaToInterstitialGlucoseLagT1D.pdf"),
    ("Basu 2015 repository", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC4495531/fullTextXML", "Basu_2015_PlasmaToInterstitialGlucoseLagT1D.xml"),
    ("Holman 2020", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC7462842/fullTextXML", "Holman_2020_RW_MammalianGlucoseTransporters.xml"),
    ("Basu 2015 PMC", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4495531/", "Basu_2015_PlasmaToInterstitialGlucoseLagT1D.html"),
    ("Basu 2015 abstract", "https://pubmed.ncbi.nlm.nih.gov/25305282/", "Basu_2015_PlasmaToInterstitialGlucoseLagT1D_abstract.html"),
    ("Holman 2020 landing", "https://pubmed.ncbi.nlm.nih.gov/32591905/", "Holman_2020_RW_MammalianGlucoseTransporters_abstract.html"),
    ("Asp 1996 PDF", "https://pmc.ncbi.nlm.nih.gov/articles/PMC1160686/pdf/jphysiol00398-0271.pdf", "Asp_1996_EccentricExerciseClampGLUT4.pdf"),
    ("Laborde 2021", "https://www.ebi.ac.uk/europepmc/webservices/rest/PMC8656666/fullTextXML", "Laborde_2021_SlowBreathingDoseResponse.xml"),
]
log_path = Path(__file__).parent / "acquisition.json"
records = json.loads(log_path.read_text(encoding="utf-8")) if log_path.exists() else []
for label, url, filename in SOURCES:
    if len(sys.argv) > 1 and label not in sys.argv[1:]:
        continue
    record = {"source": label, "requested_url": url, "attempt_date": datetime.now(timezone.utc).isoformat()}
    try:
        with urlopen(url, timeout=30) as response:
            data = response.read()
            record.update(status=response.status, final_url=response.url, bytes=len(data), content_type=response.headers.get("content-type"))
        valid = data.startswith(b"%PDF-") or (b"<article" in data[:3000] and b"<body>" in data)
        valid = valid or (b'abstract-content' in data and b'citation_title' in data) or (b'main-article-body' in data and b'citation_title' in data)
        record["candidate_retained"] = valid
        if valid:
            destination = ROOT / "docs" / "references" / filename
            if destination.exists() and destination.read_bytes() != data:
                destination = destination.with_name(destination.stem + "_20260922" + destination.suffix)
            destination.write_bytes(data)
            record.update(local_path=destination.relative_to(ROOT).as_posix(), sha256=hashlib.sha256(data).hexdigest(), identity="pending manual inspection")
    except (URLError, TimeoutError) as error:
        record.update(error=str(error), candidate_retained=False)
    records.append(record)
    print(json.dumps(record), flush=True)
log_path.write_text(json.dumps(records, indent=2) + "\n", encoding="utf-8")
