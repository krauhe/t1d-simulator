#!/bin/bash
# =============================================================================
# CHECK-DOC-SYNC.SH — Verify that translations are in sync with their sources.
#
# Two sync directions:
#   1. Docs: English is primary → Danish follows
#      MODEL-IMPLEMENTATION.md (en) → MODEL-IMPLEMENTERING.da.md (da)
#      BG-SCIENCE.md (en)    → BG-VIDENSKAB.da.md (da)
#
#   2. Help templates: Danish is primary → English follows
#      help-content-da → help-content-en
#
# Version markers:
#   Docs (English):  <!-- doc-version: YYYY-MM-DD-vN -->
#   Docs (Danish):   <!-- translated-from: FILE doc-version: YYYY-MM-DD-vN -->
#   Help (Danish):   <!-- help-version-da: YYYY-MM-DD-vN -->
#   Help (English):  <!-- help-version-en: translated-from-da YYYY-MM-DD-vN -->
#
# Run: bash tests/check-doc-sync.sh
# Exit code: 0 = all in sync, 1 = one or more out of sync
# =============================================================================

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCS_DIR="$REPO_DIR/docs"
INDEX="$REPO_DIR/index.html"
EXIT_CODE=0

# Helper: extract a value after a keyword from a string
# Usage: extract_after "keyword" "line"
# Returns the next whitespace-delimited token after "keyword"
extract_after() {
    local keyword="$1"
    local line="$2"
    echo "$line" | sed -n "s/.*${keyword} *\([^ ]*\).*/\1/p" | sed 's/ *-->.*//'
}

# --- Check doc pairs (English primary → Danish translation) ---
check_doc_pair() {
    local en_file="$1"
    local da_file="$2"
    local en_name="$(basename "$en_file")"
    local da_name="$(basename "$da_file")"

    if [ ! -f "$en_file" ]; then
        echo "  MISSING: $en_name does not exist"
        EXIT_CODE=1
        return
    fi
    if [ ! -f "$da_file" ]; then
        echo "  MISSING: $da_name does not exist"
        EXIT_CODE=1
        return
    fi

    # Extract version from English file (first line)
    local en_first=$(head -1 "$en_file")
    local en_version=$(extract_after "doc-version:" "$en_first")

    # Extract translated-from version from Danish file (first line)
    local da_first=$(head -1 "$da_file")
    local da_version=$(extract_after "doc-version:" "$da_first")

    if [ -z "$en_version" ]; then
        echo "  WARNING: $en_name has no doc-version marker"
        EXIT_CODE=1
        return
    fi
    if [ -z "$da_version" ]; then
        echo "  WARNING: $da_name has no translated-from marker"
        EXIT_CODE=1
        return
    fi

    if [ "$en_version" = "$da_version" ]; then
        echo "  OK: $da_name matches $en_name ($en_version)"
    else
        echo "  OUT OF SYNC: $da_name ($da_version) != $en_name ($en_version)"
        EXIT_CODE=1
    fi
}

# --- Check help templates (Danish primary → English translation) ---
check_help_sync() {
    if [ ! -f "$INDEX" ]; then
        echo "  MISSING: index.html not found"
        EXIT_CODE=1
        return
    fi

    # Extract DA help version (line: <!-- help-version-da: YYYY-MM-DD-vN -->)
    local da_line=$(grep "help-version-da:" "$INDEX")
    local da_version=$(extract_after "help-version-da:" "$da_line")

    # Extract EN help translated-from version (line: <!-- help-version-en: translated-from-da YYYY-MM-DD-vN -->)
    local en_line=$(grep "translated-from-da" "$INDEX")
    local en_version=$(extract_after "translated-from-da" "$en_line")

    if [ -z "$da_version" ]; then
        echo "  WARNING: help-content-da has no help-version-da marker"
        EXIT_CODE=1
        return
    fi
    if [ -z "$en_version" ]; then
        echo "  WARNING: help-content-en has no translated-from-da marker"
        EXIT_CODE=1
        return
    fi

    if [ "$da_version" = "$en_version" ]; then
        echo "  OK: help-content-en matches help-content-da ($da_version)"
    else
        echo "  OUT OF SYNC: help-content-en ($en_version) != help-content-da ($da_version)"
        EXIT_CODE=1
    fi
}

echo "=== Documentation sync check ==="
echo ""
echo "Docs (English primary -> Danish translation):"
check_doc_pair "$DOCS_DIR/MODEL-IMPLEMENTATION.md" "$DOCS_DIR/MODEL-IMPLEMENTERING.da.md"
check_doc_pair "$DOCS_DIR/BG-SCIENCE.md" "$DOCS_DIR/BG-VIDENSKAB.da.md"

echo ""
echo "Help templates (Danish primary -> English translation):"
check_help_sync

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "All translations are in sync."
else
    echo "WARNING: Some translations are out of date!"
fi

exit $EXIT_CODE
