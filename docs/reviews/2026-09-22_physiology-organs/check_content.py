"""Read-only checks for the owned chapter, replacement blocks and audit prose."""
from pathlib import Path
import json, re
out=Path(__file__).resolve().parent
kb=Path("C:/Dropbox/Kristian/Diabetes/t1d-serious-games-knowledge-base/knowledge/physiology/glucose-insulin-system.qmd")
files=[kb,out/"section-3-replacement.md",out/"section-4-replacement.md",out/"audit.md",out/"verification.md"]
for file in files:
    body=file.read_text(encoding="utf-8")
    urls=set(re.findall(r"\]\((https?://[^)]+)\)",body))
    print(json.dumps(dict(file=str(file),words=len(body.split()),external_urls=len(urls),replacement_characters=body.count("\ufffd"),non_ascii_cjk=len(re.findall(r"[\u4e00-\u9fff]",body)),long_alphabetic_tokens=sorted(set(re.findall(r"\b[A-Za-z]{28,}\b",body))))))
    assert "\ufffd" not in body
    assert not re.search(r"[\u4e00-\u9fff]",body)
    assert not re.search(r"Organfluxesandmeasurements|Notafullvalidation|principalsource|notestablished|withoutfixed|primaryappraisal|clinicalnumbers",body)
body=kb.read_text(encoding="utf-8")
assert body.startswith("---\n") and body.count("\n---\n")==1
for target in re.findall(r"\]\(([^)#]+\.qmd)(?:#[^)]+)?\)",body):
    assert (kb.parent/target).exists(),target
calculations={
 "filtered_glucose_g_per_day_at_180L_and_5_5mmol":180*5.5*180.16/1000,
 "brain_g_per_day_from_5_6mg_and_1_4kg":5.6*14*1440/1000,
 "brain_umol_per_100g_min_from_5_6mg":5.6/180.16*1000,
 "brain_g_per_day_from_25_to_30umol":[v*14*1440*180.16/1e6 for v in (25,30)],
 "GFR_reduction_percent_149_to_129":(149-129)/149*100,
 "glycogen_g_per_kg_from_3_5umol_glucosyl_per_g":3.5*162.14/1000,
 "glycogen_g_in_assumed_1_4kg_brain":3.5*162.14/1000*1.4,
 "Owen_ketone_oxygen_equivalent_fraction":(1.53+.24)/2.96,
}
print(json.dumps(calculations,indent=2))
print("PASS: owned-content structure, internal file links, encoding and targeted prose checks")
