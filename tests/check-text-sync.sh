#!/bin/bash
# =============================================================================
# CHECK-TEXT-SYNC.SH — Verificér at UI-oversættelser er synkroniserede.
#
# Tjekker to ting:
#   1. Hjælp-templates i index.html: engelsk primær → dansk følger (version-markører)
#   2. i18n-nøgler i js/i18n.js: da og en har samme antal nøgler
#
# Videnskabelige docs (BG-SCIENCE.md, MODEL-IMPLEMENTATION.md) er kun-engelsk
# og tjekkes ikke af dette script.
#
# Version-markører i index.html:
#   Engelsk (primær):  <!-- help-version-en: YYYY-MM-DD-vN -->
#   Dansk (oversat):   <!-- help-version-da: translated-from-en YYYY-MM-DD-vN -->
#
# Kør: bash tests/check-text-sync.sh
# Exit code: 0 = alt synkroniseret, 1 = noget ude af sync
# =============================================================================

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INDEX="$REPO_DIR/index.html"
I18N="$REPO_DIR/js/i18n.js"
EXIT_CODE=0

# Hjælpefunktion: udtræk værdi efter et keyword fra en streng
extract_after() {
    local keyword="$1"
    local line="$2"
    echo "$line" | sed -n "s/.*${keyword} *\([^ ]*\).*/\1/p" | sed 's/ *-->.*//'
}

# =============================================================================
# 1. HJÆLP-TEMPLATES — Engelsk primær → Dansk oversættelse
# =============================================================================
check_help_sync() {
    if [ ! -f "$INDEX" ]; then
        echo "  MANGLER: index.html ikke fundet"
        EXIT_CODE=1
        return
    fi

    # Engelsk version (primær): <!-- help-version-en: YYYY-MM-DD-vN -->
    local en_line=$(grep "help-version-en:" "$INDEX")
    local en_version=$(extract_after "help-version-en:" "$en_line")

    # Dansk version (oversat): <!-- help-version-da: translated-from-en YYYY-MM-DD-vN -->
    local da_line=$(grep "translated-from-en" "$INDEX")
    local da_version=$(extract_after "translated-from-en" "$da_line")

    if [ -z "$en_version" ]; then
        echo "  ADVARSEL: help-content-en har ingen help-version-en markør"
        EXIT_CODE=1
        return
    fi
    if [ -z "$da_version" ]; then
        echo "  ADVARSEL: help-content-da har ingen translated-from-en markør"
        EXIT_CODE=1
        return
    fi

    if [ "$en_version" = "$da_version" ]; then
        echo "  OK: help-content-da matcher help-content-en ($en_version)"
    else
        echo "  UDE AF SYNC: help-content-da ($da_version) != help-content-en ($en_version)"
        EXIT_CODE=1
    fi
}

# =============================================================================
# 2. I18N-NØGLER — da og en skal have samme antal
# =============================================================================
check_i18n_keys() {
    if [ ! -f "$I18N" ]; then
        echo "  MANGLER: js/i18n.js ikke fundet"
        EXIT_CODE=1
        return
    fi

    # Tæl nøgler med node (mere præcist end regex)
    # Node printer direkte OK/FAIL-besked for at undgå Windows line-ending problemer
    # Kører node fra repo-roden og bruger relativ sti for Windows-kompatibilitet
    # Find portable Node hvis den findes — ellers fald tilbage til global `node`.
    local NODE_BIN
    if [ -x "$REPO_DIR/tests/.bin/node.exe" ]; then
        NODE_BIN="$REPO_DIR/tests/.bin/node.exe"
    elif [ -x "$REPO_DIR/tests/.bin/node" ]; then
        NODE_BIN="$REPO_DIR/tests/.bin/node"
    else
        NODE_BIN="node"
    fi

    (cd "$REPO_DIR" && "$NODE_BIN" -e "
        const fs = require('fs');
        const src = fs.readFileSync('js/i18n.js', 'utf8');

        const daMatch = src.match(/da:\s*\{([\s\S]*?)\n    \},/);
        const enMatch = src.match(/en:\s*\{([\s\S]*?)\n    \}/);

        if (!daMatch || !enMatch) {
            process.stdout.write('  FEJL: Kunne ikke parse I18N-objekt\n');
            process.exit(1);
        }

        const countKeys = (s) => (s.match(/^\s+'[^']+'/gm) || []).length;
        const daKeys = countKeys(daMatch[1]);
        const enKeys = countKeys(enMatch[1]);

        if (daKeys === enKeys) {
            process.stdout.write('  OK: da (' + daKeys + ' nøgler) = en (' + enKeys + ' nøgler)\n');
        } else {
            process.stdout.write('  UDE AF SYNC: da (' + daKeys + ' nøgler) != en (' + enKeys + ' nøgler)\n');
            process.exit(1);
        }
    " 2>/dev/null)

    if [ $? -ne 0 ]; then
        EXIT_CODE=1
    fi
}

# =============================================================================
# KØR ALLE CHECKS
# =============================================================================
echo "=== Tekst-synkroniserings-check ==="
echo ""

echo "Hjælp-templates (engelsk primær → dansk oversættelse):"
check_help_sync

echo ""
echo "i18n-nøgler (da vs. en):"
check_i18n_keys

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "Alle oversættelser er synkroniserede."
else
    echo "ADVARSEL: Nogle oversættelser er ude af sync!"
fi

exit $EXIT_CODE
