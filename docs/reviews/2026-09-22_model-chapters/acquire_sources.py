"""Hent åbne modelartikler og log teknisk adgang; faglig kontrol sker separat.

Scriptet gemmer kun downloads i den ignorerede fysiologisamling. Det omgår
ikke adgangskontrol, og en HTTP-succes er ikke i sig selv fuldtekstverifikation.
"""
import concurrent.futures
import hashlib
import json
import sys
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / 'docs' / 'references'
RECORD = Path(__file__).with_name('acquisition.json')
SOURCES = [
    ('Kovatchev_2009_InSilicoPreclinicalTrials', 'PMC2681269'),
    ('Wilinska_2010_ClosedLoopSimulation', 'PMC2825634'),
    ('DallaMan_2014_UVAPadovaNewFeatures', 'PMC4454102'),
    ('Cobelli_2009_RW_ModelsSignalsControl', 'PMC2951686'),
    ('Pompa_2021_ThreeMaximalModels', 'PMC8476045'),
    ('Kovatchev_2023_RW_UVAPadovaDevelopment', 'PMC10658679'),
]


def fetch(item):
    name, pmcid = item
    attempts = []
    # Repository HTML er fallback, hvis den tilbudte PDF er utilgængelig.
    urls = [
        (f'https://europepmc.org/articles/{pmcid}?pdf=render', '.pdf'),
        (f'https://pmc.ncbi.nlm.nih.gov/articles/{pmcid}/', '.html'),
        (f'https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML', '.xml'),
    ] if pmcid.startswith('PMC') else [(pmcid, '.pdf' if ('.pdf' in pmcid or '/pdf/' in pmcid) else '.html')]
    for url, suffix in urls:
        attempt = {'requested_url': url, 'date': '2026-09-22'}
        try:
            with urllib.request.urlopen(url, timeout=30) as response:
                body = response.read()
                attempt.update(status=response.status, final_url=response.url, bytes=len(body))
            valid = ((suffix == '.pdf' and body.startswith(b'%PDF-'))
                     or (suffix == '.html' and b'Introduction' in body and len(body) > 30000)
                     or (suffix == '.xml' and b'<body>' in body))
            attempt['candidate_full_text'] = valid
            if valid:
                target = DEST / (name + suffix)
                target.write_bytes(body)
                attempt.update(path=str(target.relative_to(ROOT)), sha256=hashlib.sha256(body).hexdigest())
                attempts.append(attempt)
                break
        except Exception as exc:
            attempt['error'] = str(exc)
        attempts.append(attempt)
    return {'source': name, 'repository_id_or_url': pmcid, 'attempts': attempts,
            'semantic_identity_and_reading': 'Requires separate editorial verification'}


if __name__ == '__main__':
    SOURCES += [
        ('Raue_2009_IdentifiabilityProfileLikelihood', 'https://opus.bibliothek.uni-augsburg.de/opus4/files/113236/113236.pdf'),
        ('Bergman_1979_QuantitativeInsulinSensitivity', 'https://www.researchgate.net/profile/Yz-Ider/publication/22699697_Quantitative_Estimation_of_Insulin_Sensitivity/links/02e7e5376085032c14000000/Quantitative-Estimation-of-Insulin-Sensitivity.pdf'),
    ]
    if '--alternatives' in sys.argv:
        SOURCES = [
            ('Wilinska_2010_ClosedLoopSimulation', 'https://journals.sagepub.com/doi/pdf/10.1177/193229681000400117'),
            ('DallaMan_2014_UVAPadovaNewFeatures', 'https://journals.sagepub.com/doi/pdf/10.1177/1932296813514502'),
            ('Kovatchev_2009_InSilicoPreclinicalTrials', 'https://journals.sagepub.com/doi/pdf/10.1177/193229680900300106'),
            ('DallaMan_2007_MealSimulation', 'https://isbgroup.eu/files/Dalla%20Man%202007.pdf'),
            ('Sorensen_1985_GlucoseMetabolismThesis', 'https://www.cs.cmu.edu/~./dmilam/files/sorensen_thesis.pdf'),
            ('Raue_2009_IdentifiabilityProfileLikelihood', 'https://academic.oup.com/bioinformatics/article/25/15/1923/213246'),
        ]
        RECORD = RECORD.with_name('acquisition-alternatives.json')
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        results = list(pool.map(fetch, SOURCES))
    RECORD.write_text(json.dumps(results, indent=2), encoding='utf-8')
    for result in results:
        last = result['attempts'][-1]
        print(result['source'], last.get('path', last.get('error', 'no full-text candidate')))
