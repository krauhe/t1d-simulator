// validate.js — geometrisk overlap-tjek for diagrammaker-output
//
// Tager en figure.svg, parser de strukturerede attributter renderer'en
// efterlader, og rapporterer:
//   - tekst der overlapper med kasser den ikke tilhører
//   - pile der gennemskærer kasser de ikke starter/slutter ved
//   - pile der krydser hinanden
//   - pil-labels der overlapper med kasser eller andre pil-labels
//
// Output: validation.json i samme mappe + exit-kode 0 (pass) / 1 (fail)
// + console-rapport.
//
// Brug: node tools/diagrammaker/validate.js docs/diagrams/<slug>/figure.svg

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================================
// SVG-parsing (let-vægts, ingen DOM)
// ============================================================================

// Parser <rect ... /> og udtrækker bbox. Vi bruger renderer'ens output-format
// hvor rect-attributterne er på én linje og altid har x/y/width/height.
function parseRects(svg) {
    const rects = [];
    // Match alle <rect ...> tags. Vi accepterer multi-linje for sikkerhed.
    const rectRe = /<rect\b([^>]*?)\/?>/g;
    let m;
    while ((m = rectRe.exec(svg)) !== null) {
        const attrs = m[1];
        const x = parseFloat((/\bx="([^"]+)"/.exec(attrs) || [])[1] || 0);
        const y = parseFloat((/\by="([^"]+)"/.exec(attrs) || [])[1] || 0);
        const w = parseFloat((/\bwidth="([^"]+)"/.exec(attrs) || [])[1] || 0);
        const h = parseFloat((/\bheight="([^"]+)"/.exec(attrs) || [])[1] || 0);
        rects.push({ x, y, w, h, raw: m[0] });
    }
    return rects;
}

// Parse <g class="node" data-node-id="X"> ... </g> blokke for at koble
// kasser til deres ID.
function parseNodes(svg) {
    const nodes = [];
    const nodeRe = /<g class="node" data-node-id="([^"]+)">[\s\S]*?<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/g;
    let m;
    while ((m = nodeRe.exec(svg)) !== null) {
        nodes.push({
            id: m[1],
            x: parseFloat(m[2]),
            y: parseFloat(m[3]),
            w: parseFloat(m[4]),
            h: parseFloat(m[5])
        });
    }
    return nodes;
}

// Parse alle text-elementer i node-grupper (tilhørende den node)
// + alle text-elementer i edge-label-grupper.
function parseTexts(svg) {
    const texts = [];
    // Tekst i noder
    const nodeBlocks = svg.match(/<g class="node"[\s\S]*?<\/g>/g) || [];
    for (const block of nodeBlocks) {
        const idM = /data-node-id="([^"]+)"/.exec(block);
        const ownerId = idM ? idM[1] : null;
        const txtRe = /<text\s+x="([^"]+)"\s+y="([^"]+)"\s+text-anchor="([^"]+)"\s+font-size="([^"]+)"[^>]*>([^<]*)<\/text>/g;
        let m;
        while ((m = txtRe.exec(block)) !== null) {
            const x = parseFloat(m[1]);
            const y = parseFloat(m[2]);
            const fs2 = parseFloat(m[4]);
            const content = m[5];
            // Estimér bbox fra tekst-længde (samme heuristik som renderer'en)
            const charW = fs2 * 0.55;
            const w = content.length * charW;
            const h = fs2 * 1.15;
            const bx = x - w / 2;        // text-anchor=middle
            const by = y - h * 0.85;
            texts.push({ owner: ownerId, kind: 'node-label', x: bx, y: by, w, h, content });
        }
    }
    // Tekst i edge-labels
    const edgeBlocks = svg.match(/<g class="edge-label"[\s\S]*?<\/g>/g) || [];
    for (const block of edgeBlocks) {
        const idM = /data-edge-id="([^"]+)"/.exec(block);
        const owner = idM ? idM[1] : null;
        const rectM = /<rect\s+x="([^"]+)"\s+y="([^"]+)"\s+width="([^"]+)"\s+height="([^"]+)"/.exec(block);
        if (rectM) {
            texts.push({
                owner,
                kind: 'edge-label',
                x: parseFloat(rectM[1]),
                y: parseFloat(rectM[2]),
                w: parseFloat(rectM[3]),
                h: parseFloat(rectM[4])
            });
        }
    }
    return texts;
}

// Parse alle path-elementer (edges) og deres data-from/data-to
function parsePaths(svg) {
    const paths = [];
    const pathRe = /<path\s+d="([^"]+)"[^>]*?data-edge-id="([^"]*)"\s+data-from="([^"]+)"\s+data-to="([^"]+)"/g;
    let m;
    while ((m = pathRe.exec(svg)) !== null) {
        paths.push({
            d: m[1],
            edgeId: m[2],
            from: m[3],
            to: m[4]
        });
    }
    return paths;
}

// ============================================================================
// SAMPLING — konvertér SVG path d="..." til en polyline af punkter
// ============================================================================

// Simple parser der støtter M, L, C (Catmull→Bezier konverteret af renderer'en)
function samplePath(d, samplesPerCurve = 24) {
    const points = [];
    const tokens = d.match(/[MLC][^MLC]*/g) || [];
    let cursor = { x: 0, y: 0 };
    for (const tok of tokens) {
        const cmd = tok[0];
        const nums = tok.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
        if (cmd === 'M') {
            cursor = { x: nums[0], y: nums[1] };
            points.push({ ...cursor });
        } else if (cmd === 'L') {
            cursor = { x: nums[0], y: nums[1] };
            points.push({ ...cursor });
        } else if (cmd === 'C') {
            const cp1 = { x: nums[0], y: nums[1] };
            const cp2 = { x: nums[2], y: nums[3] };
            const end = { x: nums[4], y: nums[5] };
            // Sample bezier
            for (let i = 1; i <= samplesPerCurve; i++) {
                const t = i / samplesPerCurve;
                const u = 1 - t;
                const x = u*u*u*cursor.x + 3*u*u*t*cp1.x + 3*u*t*t*cp2.x + t*t*t*end.x;
                const y = u*u*u*cursor.y + 3*u*u*t*cp1.y + 3*u*t*t*cp2.y + t*t*t*end.y;
                points.push({ x, y });
            }
            cursor = end;
        }
    }
    return points;
}

// ============================================================================
// GEOMETRI
// ============================================================================

// To rektangler overlapper hvis ikke det ene er helt til siden af det andet
function rectsOverlap(a, b, tol = 0) {
    return !(
        a.x + a.w <= b.x + tol ||
        b.x + b.w <= a.x + tol ||
        a.y + a.h <= b.y + tol ||
        b.y + b.h <= a.y + tol
    );
}

// Tjek om punkt er INDEN i rect (med margin)
function pointInRect(p, r, margin = 0) {
    return (
        p.x >= r.x - margin && p.x <= r.x + r.w + margin &&
        p.y >= r.y - margin && p.y <= r.y + r.h + margin
    );
}

// Segment-segment-skæring (returnerer true hvis de krydser inden for begge segmenters interior)
function segmentsCross(p1, p2, p3, p4) {
    function ccw(a, b, c) {
        return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
    }
    return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

// ============================================================================
// VALIDERING
// ============================================================================

function validate(svgPath) {
    const svg = fs.readFileSync(svgPath, 'utf8');
    const nodes = parseNodes(svg);
    const texts = parseTexts(svg);
    const paths = parsePaths(svg);

    const conflicts = [];

    // 1) Tekst-vs-kasse: tekst må kun overlappe med dens egen kasse (eller ingen kasse)
    for (const t of texts) {
        for (const n of nodes) {
            if (t.owner === n.id) continue;       // OK — egen kasse
            if (rectsOverlap(t, n, -1)) {
                conflicts.push({
                    type: 'text-overlaps-foreign-box',
                    text: t,
                    box: { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h },
                    severity: 'error'
                });
            }
        }
    }

    // 2) Pil-vs-fremmed-kasse: pilens samples må kun røre start/slut-kasse
    for (const p of paths) {
        const samples = samplePath(p.d);
        for (const n of nodes) {
            if (p.from === n.id || p.to === n.id) continue;       // OK — endepunkts-kasse
            const margin = -2;        // lille margin så pile der lige akkurat lander på kanten ikke flagges
            const hits = samples.filter(s => pointInRect(s, n, margin)).length;
            if (hits > 0) {
                conflicts.push({
                    type: 'arrow-crosses-foreign-box',
                    edge: { id: p.edgeId, from: p.from, to: p.to },
                    box: { id: n.id },
                    samplesInside: hits,
                    severity: 'error'
                });
            }
        }
    }

    // 3) Pil-pil-krydsninger: parvis test af alle path-segmenter
    for (let i = 0; i < paths.length; i++) {
        for (let j = i + 1; j < paths.length; j++) {
            const a = samplePath(paths[i].d, 12);
            const b = samplePath(paths[j].d, 12);
            // Hvis de deler kasse-endepunkt (fælles from eller to), accepterer vi krydsninger nær det fælles punkt
            const sharedEndpoint =
                paths[i].from === paths[j].from ||
                paths[i].from === paths[j].to ||
                paths[i].to   === paths[j].from ||
                paths[i].to   === paths[j].to;
            let crosses = 0;
            for (let s = 1; s < a.length; s++) {
                for (let t = 1; t < b.length; t++) {
                    if (segmentsCross(a[s-1], a[s], b[t-1], b[t])) crosses++;
                }
            }
            // Hvis de deler endepunkt accepteres op til ~4 "krydsninger" pga. sample-overlap nær fælles knude
            const tol = sharedEndpoint ? 4 : 0;
            if (crosses > tol) {
                conflicts.push({
                    type: 'arrow-crosses-arrow',
                    edges: [paths[i].edgeId, paths[j].edgeId],
                    crossings: crosses,
                    sharedEndpoint,
                    severity: 'warning'
                });
            }
        }
    }

    // 4) Edge-label-vs-kasse: pil-labels må ikke overlappe med kasser
    const edgeLabels = texts.filter(t => t.kind === 'edge-label');
    for (const lbl of edgeLabels) {
        for (const n of nodes) {
            if (rectsOverlap(lbl, n, -2)) {
                conflicts.push({
                    type: 'edge-label-overlaps-box',
                    label: lbl,
                    box: { id: n.id },
                    severity: 'warning'
                });
            }
        }
    }

    // 5) Edge-label-vs-edge-label: må ikke overlappe hinanden
    for (let i = 0; i < edgeLabels.length; i++) {
        for (let j = i + 1; j < edgeLabels.length; j++) {
            if (rectsOverlap(edgeLabels[i], edgeLabels[j], -1)) {
                conflicts.push({
                    type: 'edge-label-overlaps-edge-label',
                    labels: [edgeLabels[i].owner, edgeLabels[j].owner],
                    severity: 'warning'
                });
            }
        }
    }

    return {
        passed: conflicts.filter(c => c.severity === 'error').length === 0,
        nodeCount: nodes.length,
        edgeCount: paths.length,
        conflicts
    };
}

function main() {
    const svgPath = process.argv[2];
    if (!svgPath) {
        console.error('Brug: node validate.js <sti-til-figure.svg>');
        process.exit(1);
    }
    const abs = path.resolve(svgPath);
    const result = validate(abs);

    // Skriv rapport
    const outPath = path.join(path.dirname(abs), 'validation.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

    // Console-rapport
    console.log(`Diagram: ${abs}`);
    console.log(`Nodes:   ${result.nodeCount}`);
    console.log(`Edges:   ${result.edgeCount}`);
    console.log(`Status:  ${result.passed ? 'PASS' : 'FAIL'}`);
    if (result.conflicts.length > 0) {
        console.log(`Conflicts (${result.conflicts.length}):`);
        for (const c of result.conflicts) {
            console.log(`  [${c.severity}] ${c.type}: ${JSON.stringify(c).slice(0, 200)}`);
        }
    }
    process.exit(result.passed ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = { validate };
