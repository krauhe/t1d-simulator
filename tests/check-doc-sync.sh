#!/bin/bash
# =============================================================================
# CHECK-DOC-SYNC.SH — Verify that scientific docs have valid doc-version markers.
#
# Scientific documentation (MODEL-IMPLEMENTATION.md, BG-SCIENCE.md) is maintained
# in English only — there are no Danish translations to keep in sync. This
# script's job is therefore to make sure every English-only doc carries a valid
# `<!-- doc-version: YYYY-MM-DD-vN -->` marker on its first line, so contributors
# remember to bump it when the content changes.
#
# UI text synchronization (help-popup DA<->EN and i18n DA<->EN) is checked by
# check-text-sync.sh — this script does not duplicate that work.
#
# Run: bash tests/check-doc-sync.sh
# Exit code: 0 = all docs have valid markers, 1 = one or more missing/malformed
# =============================================================================

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOCS_DIR="$REPO_DIR/docs"
EXIT_CODE=0

# English-only scientific docs that must carry a doc-version marker.
ENGLISH_DOCS=(
    "MODEL-IMPLEMENTATION.md"
    "BG-SCIENCE.md"
)

# A valid marker looks like: <!-- doc-version: 2026-06-01-v1 -->
# We accept the date as YYYY-MM-DD and the version as v<digits>.
VERSION_REGEX='<!-- doc-version: [0-9]{4}-[0-9]{2}-[0-9]{2}-v[0-9]+ -->'

check_doc_marker() {
    local doc_name="$1"
    local doc_path="$DOCS_DIR/$doc_name"

    if [ ! -f "$doc_path" ]; then
        echo "  MISSING: $doc_name does not exist"
        EXIT_CODE=1
        return
    fi

    local first_line
    first_line=$(head -1 "$doc_path")

    if echo "$first_line" | grep -qE "$VERSION_REGEX"; then
        local version
        version=$(echo "$first_line" | sed -E 's/.*doc-version: ([0-9]{4}-[0-9]{2}-[0-9]{2}-v[0-9]+).*/\1/')
        echo "  OK: $doc_name carries doc-version marker ($version)"
    else
        echo "  WARNING: $doc_name has no valid <!-- doc-version: YYYY-MM-DD-vN --> marker on line 1"
        EXIT_CODE=1
    fi
}

echo "=== Documentation marker check ==="
echo ""
echo "English-only scientific docs (must have doc-version marker on line 1):"
for doc in "${ENGLISH_DOCS[@]}"; do
    check_doc_marker "$doc"
done

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "All scientific docs carry valid doc-version markers."
else
    echo "WARNING: One or more scientific docs are missing a valid doc-version marker."
    echo "Add or fix the marker on line 1: <!-- doc-version: YYYY-MM-DD-vN -->"
fi

exit $EXIT_CODE
