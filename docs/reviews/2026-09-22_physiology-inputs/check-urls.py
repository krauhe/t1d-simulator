"""Read-only local HTTP identity checks; print structured results for this audit."""
import concurrent.futures
import json
import re
import urllib.request
from html import unescape

SOURCES = [
    ("Bell2015", "https://pubmed.ncbi.nlm.nih.gov/25998293/", "Impact of fat, protein"),
    ("Cartee2015", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4816200/", "Mechanisms for greater insulin"),
    ("Haahr2014", "https://pubmed.ncbi.nlm.nih.gov/25179915/", "degludec"),
    ("Heinemann2002", "https://pubmed.ncbi.nlm.nih.gov/12450450/", "Variability of insulin"),
    ("Gradel2018", "https://pubmed.ncbi.nlm.nih.gov/30116732/", "Factors Affecting the Absorption"),
    ("Horowitz1993", "https://pubmed.ncbi.nlm.nih.gov/8405758/", "Relationship between oral glucose"),
    ("Jenkins1981", "https://pubmed.ncbi.nlm.nih.gov/6259925/", "Glycemic index of foods"),
    ("Marathe2013", "https://pubmed.ncbi.nlm.nih.gov/23613599/", "Relationships between gastric emptying"),
    ("McClure2023", "https://pubmed.ncbi.nlm.nih.gov/36549943/", "Blood Glucose Response"),
    ("Mikines1988", "https://pubmed.ncbi.nlm.nih.gov/3126668/", "Effect of physical exercise"),
    ("Paterson2016", "https://pubmed.ncbi.nlm.nih.gov/26499756/", "Influence of dietary protein"),
    ("Sylow2017", "https://pubmed.ncbi.nlm.nih.gov/27739515/", "Exercise-stimulated glucose uptake"),
    ("Wursch1997", "https://pubmed.ncbi.nlm.nih.gov/9353622/", "viscous soluble fiber"),
    ("Yardley2013", "https://pubmed.ncbi.nlm.nih.gov/23172972/", "Resistance versus aerobic"),
    ("Smart2013", "https://pubmed.ncbi.nlm.nih.gov/24170749/", "Both dietary protein and fat"),
    ("Famulla2016", "https://pubmed.ncbi.nlm.nih.gov/27411698/", "Insulin Injection Into Lipohypertrophic"),
    ("Dao2025", "https://pubmed.ncbi.nlm.nih.gov/39951019/", "Glycemic Impact of Protein"),
    ("Bell2015_fulltext_attempt", "https://doi.org/10.2337/dc15-0100", "Impact of Fat, Protein"),
    ("Famulla2016_fulltext_attempt", "https://doi.org/10.2337/dc16-0610", "Insulin Injection Into Lipohypertrophic"),
    ("Dao2025_fulltext_attempt", "https://doi.org/10.2337/dci24-0096", "Glycemic Impact of Protein"),
    ("Mikines1988_fulltext_attempt", "https://doi.org/10.1152/ajpendo.1988.254.3.E248", "Effect of physical exercise"),
]
SOURCES += [
    (key + "_EuropePMC", f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:{url.rstrip('/').split('/')[-1]}%20AND%20SRC:MED&format=json&resultType=core", identity)
    for key, url, identity in SOURCES if "pubmed.ncbi.nlm.nih.gov/" in url
]
SOURCES += [
    ("Smart2013_PMC", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3836096/", "Both Dietary Protein and Fat"),
    ("Marathe2013_PMC", "https://pmc.ncbi.nlm.nih.gov/articles/PMC3631884/", "Relationships Between Gastric Emptying"),
    ("Paterson2016_PMC", "https://pmc.ncbi.nlm.nih.gov/articles/PMC5064639/", "Influence of dietary protein"),
]


def check(source):
    key, url, identity = source
    result = {"source": key, "requested_url": url, "expected_identity": identity}
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 scientific-source-audit"})
        with urllib.request.urlopen(request, timeout=20) as response:
            content = response.read(5_000_000).decode("utf-8", errors="replace")
            result.update(status=response.status, final_url=response.url, bytes_read=len(content))
        title = re.search(r"<title[^>]*>(.*?)</title>", content, re.I | re.S)
        result["title"] = unescape(re.sub(r"<[^>]+>", " ", title.group(1))).strip() if title else None
        clean = unescape(re.sub(r"<[^>]+>", " ", content))
        clean = " ".join(clean.split())
        at = clean.lower().find(identity.lower())
        result["identity_term_found"] = at >= 0
        result["identity_context"] = clean[max(0, at - 70):at + 380] if at >= 0 else clean[:250]
        result["full_text_acquired"] = False
        if "format=json" in url:
            record = json.loads(content).get("resultList", {}).get("result", [{}])[0]
            result["record"] = {field: record.get(field) for field in ("id", "pmcid", "doi", "title", "authorString", "isOpenAccess", "fullTextUrlList", "abstractText", "pubTypeList")}
    except Exception as error:
        result.update(status=getattr(error, "code", None), error=str(error), full_text_acquired=False)
    return result


with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    print(json.dumps({"checked_on": "2026-09-22", "method": "Local Windows Python urllib GET with redirects; response title and identity context", "results": list(pool.map(check, SOURCES))}, ensure_ascii=False, indent=2))
