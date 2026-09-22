"""Lav en reproducerbar kildeinventarliste og lokal linkkontrol for revisionen.

Registreringen adskiller hentede dokumenter, manuelt læste afsnit og teknisk
URL-adgang. Ingen automatisk tekstmatch påstår at validere faglige konklusioner.
"""
import concurrent.futures
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SOURCES = [
    ('Bergman1979', None, 'Original abstract; seven models and conscious-dog protocols. Later equations checked in Cobelli 2009.'),
    ('Sorensen1985', 'Sorensen_1985_GlucoseMetabolismThesis.pdf', 'Scanned title and abstract, PDF pages 1-2; organ structure and control purpose. Detailed comparison uses Pompa 2021, not a full thesis audit.'),
    ('Hovorka2004', 'Hovorka_2004_NonlinearMPC.pdf', 'Model equations, Tables 1-2, sections 2-5, clinical experiments and prediction results; 15 experiments/10 people and post-meal restriction.'),
    ('DallaMan2007', 'DallaMan_2007_MealSimulation.pdf', 'PDF pages 1-8: population, subsystem identification, utilization relation and limitations.'),
    ('Cobelli2009', 'Cobelli_2009_RW_ModelsSignalsControl.html', 'Minimal-model, identification, glucose-flux, sensor and controller sections. Not every clinical reference was independently appraised.'),
    ('Wilinska2010', None, 'PMC full-text sections on variability, population, protocol, Table 3 and discussion read via web tool; local retention failed.'),
    ('DallaMan2014', None, 'PMC full-text sections on S2008/S2013, cohort generation, hypoglycaemia and glucagon data read via web tool; local retention failed.'),
    ('Pompa2021', 'Pompa_2021_ThreeMaximalModels.xml', 'Methods, experimental setups, selected equations, results/discussion/conclusion; reconstructed models and single nondiabetic OGTT limitation.'),
    ('AlAhdab2021', 'AlAhdab_2021_GlucoseInsulinMedicationsLifestyleT2D.pdf', 'Final published article: model figure and sections 2-4, selected appendix equations; glucose-only meals, >120 parameters, numerical cohorts and explicit patient-validation gap.'),
    ('Wanika2024', 'Wanika_2024_RW_IdentifiabilityGuide.xml', 'Definitions, practical-identifiability methodology and discussion; adjacent methods evidence, not a T1D outcome study.'),
]


def check_url(url):
    result = {'requested_url': url, 'checked': '2026-09-22'}
    try:
        with urllib.request.urlopen(url, timeout=20) as response:
            body = response.read()
            result.update(status=response.status, final_url=response.url, bytes=len(body))
        if body.startswith(b'%PDF-'):
            result['response_kind'] = 'PDF; identity checked in retained document'
        else:
            text = body.decode('utf-8', errors='replace')
            title = re.search(r'<title[^>]*>([\s\S]*?)</title>', text, re.I)
            result['title'] = unescape(title.group(1)).strip() if title else None
            result['response_kind'] = ('interstitial_or_challenge' if
                re.search(r'checking your browser|recaptcha|human verification', result['title'] or '', re.I)
                or response.status == 203 else 'HTML; inspect title for identity')
    except Exception as error:
        result['access_error'] = str(error)
    return result


if __name__ == '__main__':
    source_records = []
    for identifier, filename, reading in SOURCES:
        record = {'id': identifier, 'reading': reading, 'used_in': 'BG-SCIENCE sections 28-29',
                  'reading_date': '2026-09-22', 'retained_full_text': filename is not None}
        if filename:
            local = ROOT / 'docs/references' / filename
            data = local.read_bytes()
            record.update(local_path=local.relative_to(ROOT).as_posix(), bytes=len(data),
                          sha256=hashlib.sha256(data).hexdigest())
        else:
            record['wishlist'] = 'docs/references/_paywalled-wishlist.txt; 2026-09-22 entries'
        source_records.append(record)
    text = (ROOT / 'docs/BG-SCIENCE.md').read_text(encoding='utf-8').split('<a name="mathematical-models"></a>')[1]
    urls = sorted(set(re.findall(r'\]\((https?://[^\s)]+)\)', text)))
    with concurrent.futures.ThreadPoolExecutor(8) as executor:
        checks = list(executor.map(check_url, urls))
    result = {'date': '2026-09-22', 'sources': source_records, 'local_url_checks': checks}
    (HERE / 'source-register.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'sources':len(source_records), 'retained':sum(x['retained_full_text'] for x in source_records),
                      'unique_urls_checked':len(checks), 'chapter_words':len(text.split())}))
