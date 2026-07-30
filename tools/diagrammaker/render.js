// render.js — diagrammaker renderer
//
// Tager en spec.json fil og producerer figure.svg i samme mappe.
// Brug: node tools/diagrammaker/render.js docs/diagrams/<slug>/spec.json
//
// Layout sker via vendored dagre (tools/diagrammaker/vendor/dagre.min.js).
// Renderer'en holder al layout og styling i denne fil for at gøre det nemt
// at tune visuelle detaljer uden at skulle pille i dagre.

'use strict';

const fs = require('fs');
const path = require('path');
const dagre = require('./vendor/dagre.min.js');

// ============================================================================
// FARVEKORT — logiske entitets-navne mapper til hex-farver fra simulatoren.
// ============================================================================
// Disse navne bruges i spec.json's "color" felt. Når en compartment har
// color: "insulin-fast" får den samme blå som hurtig insulin i sim-grafen.
// Nye entiteter (lever, muskel, hjerne) har ingen sim-pendant og får
// dedikerede farver der ikke kolliderer med makro-/insulin-paletten.
const COLORS = {
    // Insulin (fra sim's CSS + graf)
    'insulin':       '#7dd3fc',  // sim's --blue (default insulin)
    'insulin-fast':  '#7dd3fc',  // hurtig insulin
    'insulin-basal': '#5eeadc',  // basal insulin (teal fra grafen)

    // Makronæringsstoffer (fra sim's --macro-* CSS-vars)
    'carb':          '#4ade80',  // --macro-carb (kulhydrat / glukose)
    'glucose':       '#4ade80',  // alias — glukose er kulhydratens endpoint
    'protein':       '#60a5fa',  // --macro-protein
    'fat':           '#f59e0b',  // --macro-fat (FFA / fedt-substrat)
    'adipose':       '#f59e0b',  // alias — fedtvæv

    // Stof-grupper med sim-farve
    'ketone':        '#c4b5fd',  // sim's --purple
    'stress':        '#f472b6',  // sim's stress-pink (graf rgba 244,114,182)
    'plasma':        '#ef4444',  // sim's --red (generisk blod-compartment)

    // Organer uden sim-farve (nye, valgt så de ikke kolliderer)
    'liver':         '#b45309',  // amber-brun
    'muscle':        '#84cc16',  // lime — distinkt fra carb-grøn og insulin-teal
    'kidney':        '#9ca3af',  // neutral gråblå (clearance-organ)
    'brain':         '#8b5cf6',  // mættet violet (distinkt fra keton-lavender)
    'gut':           '#a3a3a3',  // grå — mad i transit

    // Special — eksterne kilder/dræn
    'external':      '#6b7280',  // mørk grå — uden for systemet
    'neutral':       '#9ca3af'   // catch-all hvis ingen color angivet
};

// ============================================================================
// STYLING-KONSTANTER — alt visuelt der ikke kommer fra spec.json bor her.
// ============================================================================
const STYLE = {
    // Lærred
    bg: 'transparent',                    // baggrund (transparent → MD-tema bestemmer)
    padding: 12,                          // ydre margin omkring hele diagrammet
    fontFamily: "Inter, 'Segoe UI', system-ui, sans-serif",

    // Compartments (kasser)
    nodeMinWidth: 90,
    nodeMinHeight: 48,
    nodePadX: 8,                          // vandret indre padding i kasse
    nodePadY: 6,                          // lodret indre padding
    nodeRadius: 10,                       // matcher sim's --radius-md
    nodeBorderWidth: 2,
    nodeFillAlpha: 0.20,                  // matcher sim's --xxx-dim mønster

    // Tekst i kasse
    labelFontSize: 14,
    labelFontWeight: 600,
    labelColor: '#0d1526',                // mørk tekst på lyse fyld (sim's --bg-primary)
    varFontSize: 17,
    varFontWeight: 700,
    varColor: '#0d1526',
    unitFontSize: 12,
    unitColor: '#475569',                 // dæmpet til enhed/volumen

    // Pile (edges)
    edgeStrokeWidth: 2,
    edgeColor: '#475569',                 // default pil-farve (override pr. flow.color)
    arrowHeadSize: 8,

    // Pil-labels
    edgeLabelFontSize: 14,
    edgeLabelFontWeight: 500,
    edgeLabelColor: '#1e293b',
    edgeLabelBgPadX: 5,
    edgeLabelBgPadY: 2,
    edgeLabelBgFill: '#ffffff',
    edgeLabelBgOpacity: 0.92,
    edgeLabelBgRadius: 4,

    // Layout-spacing (overgives til dagre)
    rankSep: 45,                          // afstand mellem lag (vinkelret på flow)
    nodeSep: 24,                          // afstand mellem søsken-noder i samme lag
    edgeSep: 10,                          // afstand mellem parallelle edges

    // Karakterbredde-heuristik (Inter ved labelFontSize)
    charWidth: 7.2,
    varCharWidth: 9.5
};

// ============================================================================
// HJÆLPEFUNKTIONER
// ============================================================================

// Konvertér hex til rgba med given alpha — bruges til fill-farve på kasser
function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Slå farve op via logisk navn. Falder tilbage til 'neutral' hvis ukendt.
function resolveColor(name) {
    if (!name) return COLORS.neutral;
    return COLORS[name] || COLORS.neutral;
}

// Estimér tekst-bredde i pixel ved given font-size og evt. char-width
function estimateTextWidth(text, fontSize = STYLE.labelFontSize, cw = STYLE.charWidth) {
    if (!text) return 0;
    // skaler char-width proportionalt med font-størrelse
    const scaledCw = cw * (fontSize / STYLE.labelFontSize);
    return text.length * scaledCw;
}

// Estimér compartment-størrelse fra dens label/var/unit
function measureNode(comp) {
    const labelW = estimateTextWidth(comp.label || '', STYLE.labelFontSize);
    const varW   = estimateTextWidth(comp.var   || '', STYLE.varFontSize, STYLE.varCharWidth);
    const unitW  = estimateTextWidth(comp.unit  || '', STYLE.unitFontSize);
    const innerW = Math.max(labelW, varW, unitW);
    const w = Math.max(STYLE.nodeMinWidth, innerW + STYLE.nodePadX * 2);

    // Beregn højde ud fra hvilke linjer der er
    let lines = 0;
    if (comp.label) lines += 1;
    if (comp.var)   lines += 1;
    if (comp.unit)  lines += 1;
    const lineHeight = 20;
    const innerH = Math.max(lines * lineHeight, lineHeight);
    const h = Math.max(STYLE.nodeMinHeight, innerH + STYLE.nodePadY * 2);

    return { width: w, height: h };
}

// Escape XML-specialtegn i label-strenge
function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================================
// RENDERING — bygger SVG fra layout-resultat
// ============================================================================

// Lav en SVG path fra dagre's edge-points.
//
// Standard er LIGE linjer (polyline med L-segmenter) — det matcher reglen i
// SKILL.md om at pile skal være lige med få knæk. Hvis spec har
// `straightLines: false`, bruges Catmull-Rom-til-Bezier-smoothing i stedet
// (gamle adfærd, kun til specifikke æstetiske formål).
function pointsToPath(points, straightLines) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) {
        return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }
    // Lige linjer (default): bare L-segmenter mellem alle dagre-punkter
    if (straightLines !== false) {
        let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)}`;
        }
        return d;
    }
    // Catmull-Rom approksimation (kun hvis straightLines: false eksplicit)
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
}

// Beregn midt-punkt på en polyline (til pil-labels)
function midPointOfPath(points) {
    if (!points || points.length < 2) return points[0] || { x: 0, y: 0 };
    return pointAlongPath(points, totalPathLength(points) / 2);
}

// Total længde af en polyline
function totalPathLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += Math.hypot(
            points[i].x - points[i - 1].x,
            points[i].y - points[i - 1].y
        );
    }
    return total;
}

// Find punktet `distance` pixels langs en polyline fra start (points[0])
function pointAlongPath(points, distance) {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        const segLen = Math.hypot(dx, dy);
        if (walked + segLen >= distance) {
            const t = (distance - walked) / segLen;
            return {
                x: points[i - 1].x + dx * t,
                y: points[i - 1].y + dy * t
            };
        }
        walked += segLen;
    }
    return points[points.length - 1];
}

// Spejlvend en polyline (så start og slut byttes)
function reversePath(points) {
    return [...points].reverse();
}

// Bestem dasharray for en flow-kind
function dashArrayForKind(kind) {
    switch (kind) {
        case 'signal':      return '5,4';
        case 'equilibrium': return '';
        case 'elimination': return '';
        case 'input':       return '';
        case 'mass':        return '';
        default:            return '';
    }
}

// Generér SVG-streng fra spec
function renderSpec(spec) {
    const direction = (spec.direction || 'left-to-right').toLowerCase();
    const rankdir = (direction === 'top-to-bottom' || direction === 'tb') ? 'TB' : 'LR';

    // 1) Byg dagre-graf
    //
    // Hvis spec'en har eksterne flows, allokerer vi ekstra margin på den
    // relevante kant af figuren, så `externalLabel`-tekst kan placeres
    // UDEN FOR pilens bane (før input-pilens start, efter output-pilens
    // slut), ikke inde på selve pilen. Højden af én label-rect = font + padding.
    const externalLabelHeight = STYLE.edgeLabelFontSize + STYLE.edgeLabelBgPadY * 2 + 6;
    const specHasExternal = (spec.flows || []).some(f => f.from === 'external' || f.to === 'external');
    const marginAlongFlow = specHasExternal
        ? STYLE.padding + externalLabelHeight
        : STYLE.padding;

    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({
        rankdir,
        ranksep: STYLE.rankSep,
        nodesep: STYLE.nodeSep,
        edgesep: STYLE.edgeSep,
        marginx: rankdir === 'TB' ? STYLE.padding : marginAlongFlow,
        marginy: rankdir === 'TB' ? marginAlongFlow : STYLE.padding
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Faktiske compartments
    //
    // Hver compartment må valgfrit angive `rank: "min" | "max"` i sin spec.
    // Det betyder noden skal placeres ved hhv. figurens indgangs-kant (top
    // i TB, venstre i LR) eller udgangs-kant (bund/højre).
    //
    // BEMÆRK: Vendored dagre understøtter IKKE rank-attributten direkte på
    // noder. Vi håndhæver det i stedet med standard-teknikken: en skjult
    // virtuel sink/kilde-node hvor alle "max"/"min"-noder forbindes igennem.
    // Dagre's longest-path-ranking tvinger så alle de noder på samme
    // (max-1 / min+1) rang. Det implementeres længere nede.
    const compById = {};
    const maxRankComps = [];
    const minRankComps = [];
    for (const comp of spec.compartments || []) {
        compById[comp.id] = comp;
        const dims = measureNode(comp);
        g.setNode(comp.id, { width: dims.width, height: dims.height, label: comp.id });
        if (comp.rank === 'max' || comp.rank === 'sink')   maxRankComps.push(comp.id);
        if (comp.rank === 'min' || comp.rank === 'source') minRankComps.push(comp.id);
    }

    // External-kilder/dræn: opret en lille usynlig "anker"-node pr. external endepunkt.
    // Vi bruger sammensatte ID'er så hver eksterne pil får sin egen anker.
    //
    // Eksterne inputs (`from: external`) skal komme fra figurens indgangs-
    // kant — vi tilføjer dem til `minRankComps`-listen. Eksterne outputs
    // (`to: external`) skal ende ved udgangs-kanten — føjes til `maxRankComps`.
    // Den fælles sink/kilde-mekanisme længere nede tvinger dem på rette rang.
    const externalAnchors = [];
    const extOutputAnchors = [];
    const extInputAnchors  = [];
    let extCounter = 0;
    const flows = (spec.flows || []).map(f => {
        const fl = { ...f };
        if (fl.from === 'external') {
            const anchorId = `__ext_in_${extCounter++}`;
            g.setNode(anchorId, { width: 8, height: 8, isExternal: true });
            externalAnchors.push(anchorId);
            extInputAnchors.push(anchorId);
            fl.from = anchorId;
            fl._isInput = true;
        }
        if (fl.to === 'external') {
            const anchorId = `__ext_out_${extCounter++}`;
            g.setNode(anchorId, { width: 8, height: 8, isExternal: true });
            externalAnchors.push(anchorId);
            extOutputAnchors.push(anchorId);
            fl.to = anchorId;
            fl._isOutput = true;
        }
        return fl;
    });

    // Saml alle "max"/"min"-noder (compartments + eksterne ankre) til
    // samme rang via skjulte virtuelle sink/kilde-noder.
    const allMaxRankNodes = [...maxRankComps, ...extOutputAnchors];
    const allMinRankNodes = [...minRankComps, ...extInputAnchors];

    let rankConstraintCounter = 0;
    if (allMaxRankNodes.length >= 1) {
        const sinkId = '__rank_max_sink';
        g.setNode(sinkId, { width: 0.001, height: 0.001, isExternal: true });
        externalAnchors.push(sinkId);
        for (const nodeId of allMaxRankNodes) {
            const eName = `__rcmax_${rankConstraintCounter++}`;
            g.setEdge(nodeId, sinkId, {
                label: '',
                spec: { _isHidden: true, kind: 'mass' },
                width: 0, height: 0, labelpos: 'c', minlen: 1
            }, eName);
        }
    }
    if (allMinRankNodes.length >= 1) {
        const srcId = '__rank_min_src';
        g.setNode(srcId, { width: 0.001, height: 0.001, isExternal: true });
        externalAnchors.push(srcId);
        for (const nodeId of allMinRankNodes) {
            const eName = `__rcmin_${rankConstraintCounter++}`;
            g.setEdge(srcId, nodeId, {
                label: '',
                spec: { _isHidden: true, kind: 'mass' },
                width: 0, height: 0, labelpos: 'c', minlen: 1
            }, eName);
        }
    }

    // Tilføj edges (dagre er multigraph så samme par kan have flere flows)
    flows.forEach((fl, idx) => {
        const edgeName = `e${idx}`;
        const edgeData = {
            label: fl.label || '',
            kind: fl.kind || 'mass',
            spec: fl,
            // labelpos centreret langs edge'n
            labelpos: 'c',
            // estimér label-bbox så dagre afsætter plads
            width: estimateTextWidth(fl.label || '', STYLE.edgeLabelFontSize) + STYLE.edgeLabelBgPadX * 2,
            height: STYLE.edgeLabelFontSize + STYLE.edgeLabelBgPadY * 2 + 2,
            minlen: 1
        };
        g.setEdge(fl.from, fl.to, edgeData, edgeName);
    });

    // 2) Kør layout
    dagre.layout(g);

    // Edge-stil: lige linjer som standard. Spec kan opt'e ud med
    // `straightLines: false` for gamle Bezier-smoothing-adfærd.
    const useStraightLines = spec.straightLines !== false;

    // 2.4) Pin eksterne anker-noder så pile og labels placeres optimalt.
    //
    // INPUTS: anker pinnes TÆT på target-boksen — kort pil (~18 px) der
    // visuelt forbinder source-label med target uden lang strækning.
    //
    // OUTPUTS: anker pinnes TÆT på source-boksen (kort pil ud) ELLER ved
    // figurens udgangs-kant (lang pil ned/ud). Vi vælger udgangs-kanten
    // for outputs i TB-layout fordi source ofte er højt oppe i figuren og
    // pilen så naturligt får god strækning til at "forlade" systemet.
    //
    // Labels placeres umiddelbart FØR pilens start (input) eller EFTER
    // pilens slut (output) — adjacent to the arrow tip.
    const totalW0 = g.graph().width;
    const totalH0 = g.graph().height;
    const SHORT_EXT_ARROW = 18; // visuel pil-længde for korte eksterne forbindelser
    g.nodes().forEach(nodeId => {
        const node = g.node(nodeId);
        if (!node || !node.isExternal) return;
        if (nodeId.startsWith('__ext_out_')) {
            // Output anker pinnes til figurens udgangs-kant
            if (rankdir === 'TB') {
                node.y = totalH0 - externalLabelHeight - SHORT_EXT_ARROW / 2;
            } else {
                node.x = totalW0 - externalLabelHeight - SHORT_EXT_ARROW / 2;
            }
        } else if (nodeId.startsWith('__ext_in_')) {
            // Input anker pinnes lige over target-boksen for kort pil
            // Find target via edges der har dette anker som from
            let target = null;
            g.edges().forEach(e => {
                if (e.v === nodeId) {
                    target = g.node(e.w);
                }
            });
            if (target) {
                if (rankdir === 'TB') {
                    const targetTop = target.y - target.height / 2;
                    node.y = targetTop - SHORT_EXT_ARROW - 4; // 4 = half-anchor
                } else {
                    const targetLeft = target.x - target.width / 2;
                    node.x = targetLeft - SHORT_EXT_ARROW - 4;
                }
            }
        }
    });
    // Opdatér eksterne edge-pointer så de matcher de flyttede ankre.
    g.edges().forEach(e => {
        const edgeData = g.edge(e);
        const fl = edgeData.spec;
        if (!fl || !edgeData.points || edgeData.points.length === 0) return;
        if (fl._isInput) {
            const anchor = g.node(e.v);
            edgeData.points[0] = { x: anchor.x, y: anchor.y };
        } else if (fl._isOutput) {
            const anchor = g.node(e.w);
            const last = edgeData.points.length - 1;
            edgeData.points[last] = { x: anchor.x, y: anchor.y };
        }
    });

    // 2.5) Snap-til-vinkelret-regel:
    //
    // Dagre forbinder edges fra box-center til box-center, hvilket giver
    // diagonale pile selv når source og target overlapper i den retning der
    // er på tværs af flow-aksen. Eksempel: i TB-layout er to smalle SC-
    // depoter placeret over en bredere Plasma-insulin-boks. Pilene burde gå
    // lodret ned, men dagre tegner dem som diagonaler mod target-center.
    //
    // Reglen:
    //   - I TB-layout: hvis source.x og target.x overlapper horisontalt,
    //     erstat edge-pointene med en lodret linje gennem overlap-midten.
    //   - I LR-layout: spejlvend (horisontalt overlap → vandret linje).
    //
    // Dette giver "rene" lige pile når geometrien tillader det, og bevarer
    // dagre's diagonale routing når boksene IKKE overlapper. Skjulte
    // rank-constraint edges springes over (de tegnes alligevel ikke).
    g.edges().forEach(e => {
        const edgeData = g.edge(e);
        const fl = edgeData.spec;
        if (fl && fl._isHidden) return;

        const sNode = g.node(e.v);
        const tNode = g.node(e.w);
        if (!sNode || !tNode) return;

        const sLeft = sNode.x - sNode.width / 2;
        const sRight = sNode.x + sNode.width / 2;
        const sTop = sNode.y - sNode.height / 2;
        const sBottom = sNode.y + sNode.height / 2;
        const tLeft = tNode.x - tNode.width / 2;
        const tRight = tNode.x + tNode.width / 2;
        const tTop = tNode.y - tNode.height / 2;
        const tBottom = tNode.y + tNode.height / 2;

        if (rankdir === 'TB') {
            // Tjek horisontalt overlap → snap til lodret linje
            const overlapL = Math.max(sLeft, tLeft);
            const overlapR = Math.min(sRight, tRight);
            if (overlapR >= overlapL) {
                const x = (overlapL + overlapR) / 2;
                if (sBottom < tTop) {
                    edgeData.points = [{ x, y: sBottom }, { x, y: tTop }];
                } else if (sTop > tBottom) {
                    edgeData.points = [{ x, y: sTop }, { x, y: tBottom }];
                }
            }
        } else {
            // LR-layout: tjek vertikalt overlap → snap til vandret linje
            const overlapT = Math.max(sTop, tTop);
            const overlapB = Math.min(sBottom, tBottom);
            if (overlapB >= overlapT) {
                const y = (overlapT + overlapB) / 2;
                if (sRight < tLeft) {
                    edgeData.points = [{ x: sRight, y }, { x: tLeft, y }];
                } else if (sLeft > tRight) {
                    edgeData.points = [{ x: sLeft, y }, { x: tRight, y }];
                }
            }
        }
    });

    // Find graf-bounds
    const graphInfo = g.graph();
    const totalW = graphInfo.width;
    const totalH = graphInfo.height;

    // 3) Generér SVG
    const svgParts = [];
    svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" font-family="${STYLE.fontFamily}">`);
    svgParts.push(`  <title>${esc(spec.title || 'Diagram')}</title>`);

    // <defs> med arrow-markers — én pr. unik farve så pile matcher deres farve
    const usedArrowColors = new Set();
    flows.forEach(fl => {
        const color = resolveColor(fl.color || (compById[fl.from] && compById[fl.from].color) || (compById[fl.to] && compById[fl.to].color));
        usedArrowColors.add(color);
    });
    svgParts.push('  <defs>');
    for (const color of usedArrowColors) {
        const id = `arrow-${color.replace('#', '')}`;
        svgParts.push(
            `    <marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${STYLE.arrowHeadSize}" markerHeight="${STYLE.arrowHeadSize}" orient="auto-start-reverse">` +
            `<path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`
        );
    }
    svgParts.push('  </defs>');

    // Baggrund (kun hvis ikke transparent)
    if (STYLE.bg !== 'transparent') {
        svgParts.push(`  <rect width="100%" height="100%" fill="${STYLE.bg}"/>`);
    }

    // Edges først (under noder)
    svgParts.push('  <g class="edges">');
    g.edges().forEach(e => {
        const edgeData = g.edge(e);
        const fl = edgeData.spec;
        if (fl && fl._isHidden) return; // skjulte rank-constraint-edges tegnes ikke
        const color = resolveColor(
            fl.color ||
            (compById[fl.from === undefined ? e.v : fl.from] && compById[fl.from === undefined ? e.v : fl.from].color) ||
            (compById[fl.to === undefined ? e.w : fl.to] && compById[fl.to === undefined ? e.w : fl.to].color)
        );
        const kind = fl.kind || 'mass';
        const dash = dashArrayForKind(kind);
        const markerEnd = `url(#arrow-${color.replace('#', '')})`;
        const d = pointsToPath(edgeData.points, useStraightLines);
        const strokeAttr = dash ? ` stroke-dasharray="${dash}"` : '';
        svgParts.push(`    <path d="${d}" fill="none" stroke="${color}" stroke-width="${STYLE.edgeStrokeWidth}"${strokeAttr} marker-end="${markerEnd}" data-edge-id="${esc(e.name || '')}" data-from="${esc(e.v)}" data-to="${esc(e.w)}"/>`);
    });
    svgParts.push('  </g>');

    // Noder
    svgParts.push('  <g class="nodes">');
    g.nodes().forEach(nodeId => {
        const n = g.node(nodeId);
        if (n.isExternal) return; // skip eksterne ankre
        const comp = compById[nodeId];
        if (!comp) return;
        const color = resolveColor(comp.color);
        const fill = hexToRgba(color, STYLE.nodeFillAlpha);
        const x = n.x - n.width / 2;
        const y = n.y - n.height / 2;

        // Stil-variation pr. compartment-type
        let extraAttrs = '';
        if (comp.type === 'effect') {
            extraAttrs = ` stroke-dasharray="6,4"`;  // effect = signal-drevet, stiplet kant
        } else if (comp.type === 'external') {
            extraAttrs = ` stroke-dasharray="3,3"`;
        }

        svgParts.push(`    <g class="node" data-node-id="${esc(nodeId)}">`);
        svgParts.push(`      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${n.width}" height="${n.height}" rx="${STYLE.nodeRadius}" ry="${STYLE.nodeRadius}" fill="${fill}" stroke="${color}" stroke-width="${STYLE.nodeBorderWidth}"${extraAttrs}/>`);

        // Tekst-linjer centreret lodret
        const lines = [];
        if (comp.label) lines.push({ text: comp.label, size: STYLE.labelFontSize, weight: STYLE.labelFontWeight, color: STYLE.labelColor });
        if (comp.var)   lines.push({ text: comp.var,   size: STYLE.varFontSize,   weight: STYLE.varFontWeight,   color: STYLE.varColor });
        if (comp.unit)  lines.push({ text: comp.unit,  size: STYLE.unitFontSize,  weight: 400,                   color: STYLE.unitColor });
        const totalTextH = lines.reduce((sum, l) => sum + l.size + 4, 0) - 4;
        let ty = n.y - totalTextH / 2 + lines[0].size * 0.85;
        for (const line of lines) {
            svgParts.push(`      <text x="${n.x.toFixed(2)}" y="${ty.toFixed(2)}" text-anchor="middle" font-size="${line.size}" font-weight="${line.weight}" fill="${line.color}">${esc(line.text)}</text>`);
            ty += line.size + 4;
        }
        svgParts.push('    </g>');
    });
    svgParts.push('  </g>');

    // Edge-labels (sidst, så de ligger over alt andet)
    //
    // Hver flow kan have TO labels med forskellig betydning og placering:
    //
    // 1. `label` (flow-rate): selve transport-udtrykket, fx "k_e · I",
    //    "U_I = S2/τ_I·pulse". Placeres altid på pilens midtpunkt.
    //
    // 2. `externalLabel` (source/destination): navnet på den eksterne kilde
    //    eller dræn, fx "injection (rapid bolus)", "urine / clearance".
    //    Placeres UDEN FOR pilens bane:
    //      - INPUT (`from: external`): FØR pilens start — i den ekstra margin
    //        ved figurens indgangs-kant. Pilen "udspringer" fra labelet.
    //      - OUTPUT (`to: external`): EFTER pilens slut — i den ekstra margin
    //        ved figurens udgangs-kant. Pilen "peger på" labelet.
    //    Konventionen følger almindelig flow-chart-syntax: oprindelse FØR
    //    pilen, destination EFTER pilen (= dér hvor pilen peger hen).
    //
    // Internt-til-internt flow: kun `label` brugt, midtpunkt-placering.
    //
    // Offset-størrelse: labelets halve højde + 2 px luft, så label-rect
    // præcis ender hvor pilen starter (eller starter hvor pilen ender).
    const EXTERNAL_LABEL_OFFSET = STYLE.edgeLabelFontSize / 2 + STYLE.edgeLabelBgPadY + 4;
    svgParts.push('  <g class="edge-labels">');

    // Hjælpefunktion: tegn én label med baggrunds-rect
    function drawEdgeLabel(text, lx, ly, edgeName) {
        const labelW = estimateTextWidth(text, STYLE.edgeLabelFontSize);
        const bgW = labelW + STYLE.edgeLabelBgPadX * 2;
        const bgH = STYLE.edgeLabelFontSize + STYLE.edgeLabelBgPadY * 2;
        svgParts.push(`    <g class="edge-label" data-edge-id="${esc(edgeName || '')}">`);
        svgParts.push(`      <rect x="${(lx - bgW / 2).toFixed(2)}" y="${(ly - bgH / 2).toFixed(2)}" width="${bgW.toFixed(2)}" height="${bgH.toFixed(2)}" rx="${STYLE.edgeLabelBgRadius}" ry="${STYLE.edgeLabelBgRadius}" fill="${STYLE.edgeLabelBgFill}" fill-opacity="${STYLE.edgeLabelBgOpacity}"/>`);
        svgParts.push(`      <text x="${lx.toFixed(2)}" y="${(ly + STYLE.edgeLabelFontSize * 0.35).toFixed(2)}" text-anchor="middle" font-size="${STYLE.edgeLabelFontSize}" font-weight="${STYLE.edgeLabelFontWeight}" fill="${STYLE.edgeLabelColor}">${esc(text)}</text>`);
        svgParts.push('    </g>');
    }

    g.edges().forEach(e => {
        const edgeData = g.edge(e);
        const fl = edgeData.spec;
        if (fl && fl._isHidden) return; // skjulte rank-constraint-edges har ingen labels
        if (!fl) return;

        // 1. Flow-rate label (mid-arrow) — kun hvis label-feltet er sat
        // Vi bruger midpoint af de FAKTISKE edge-points (ikke dagre's
        // edge.x/y), fordi snap-til-vinkelret og pin-til-kant kan have
        // ændret pointene efter dagre's beregning.
        if (fl.label) {
            const mid = midPointOfPath(edgeData.points);
            drawEdgeLabel(fl.label, mid.x, mid.y, e.name);
        }

        // 2. Source/destination label — placeret UMIDDELBART før/efter pilen.
        //
        // For input: label sidder lige FØR pilens start (over for TB,
        // venstre for LR) — pilen "udspringer fra" labelet.
        // For output: label sidder lige EFTER pilens slut (under for TB,
        // højre for LR) — pilen "peger på" labelet.
        //
        // Adjacent placement giver tæt visuel kobling mellem oprindelse/
        // destination og selve transport-pilen.
        // externalLabel er kun meningsfuldt for flows der starter eller slutter
        // ved "external" — dvs. flows hvor fl._isInput eller fl._isOutput er sat.
        // Hvis externalLabel sættes på et inter-compartment flow (ingen _isInput /
        // _isOutput), ville den falde tilbage til pilens midtpunkt og ligge direkte
        // oven på det primære `label` (to hvide bokse oven i hinanden). Det er
        // altid en spec-fejl — skip det og tegn ingenting.
        if (fl.externalLabel && (fl._isInput || fl._isOutput)) {
            let lx, ly;
            const pts = edgeData.points;
            const startPt = pts[0];
            const endPt = pts[pts.length - 1];
            const labelHalfH = (STYLE.edgeLabelFontSize + STYLE.edgeLabelBgPadY * 2) / 2;
            const adjacentGap = 4;

            if (fl._isInput) {
                if (rankdir === 'TB') {
                    lx = startPt.x;
                    ly = startPt.y - labelHalfH - adjacentGap; // umiddelbart over pilens start
                } else {
                    const labelHalfW = (estimateTextWidth(fl.externalLabel, STYLE.edgeLabelFontSize)
                                        + STYLE.edgeLabelBgPadX * 2) / 2;
                    lx = startPt.x - labelHalfW - adjacentGap;
                    ly = startPt.y;
                }
            } else {
                // _isOutput
                if (rankdir === 'TB') {
                    lx = endPt.x;
                    ly = endPt.y + labelHalfH + adjacentGap; // umiddelbart under pilens slut
                } else {
                    const labelHalfW = (estimateTextWidth(fl.externalLabel, STYLE.edgeLabelFontSize)
                                        + STYLE.edgeLabelBgPadX * 2) / 2;
                    lx = endPt.x + labelHalfW + adjacentGap;
                    ly = endPt.y;
                }
            }
            drawEdgeLabel(fl.externalLabel, lx, ly, (e.name || '') + '-ext');
        }
    });
    svgParts.push('  </g>');

    svgParts.push('</svg>');
    return svgParts.join('\n');
}

// ============================================================================
// CLI
// ============================================================================

function main() {
    const specPath = process.argv[2];
    if (!specPath) {
        console.error('Brug: node render.js <sti-til-spec.json>');
        process.exit(1);
    }
    const absSpec = path.resolve(specPath);
    const spec = JSON.parse(fs.readFileSync(absSpec, 'utf8'));
    const svg = renderSpec(spec);
    const outPath = path.join(path.dirname(absSpec), 'figure.svg');
    fs.writeFileSync(outPath, svg, 'utf8');
    console.log(`Wrote ${outPath}`);
    console.log(`  Compartments: ${(spec.compartments || []).length}`);
    console.log(`  Flows:        ${(spec.flows || []).length}`);
}

if (require.main === module) {
    main();
}

module.exports = { renderSpec, COLORS, STYLE };
