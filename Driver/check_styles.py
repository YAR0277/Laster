#!/usr/bin/env python3

from pathlib import Path
import re


# ------------------------------------------------------------
# Project paths
# ------------------------------------------------------------

ROOT = Path(__file__).resolve().parent
APP_DIR = ROOT / "app" / "(tabs)"
COMPONENTS_DIR = ROOT / "components"


# Page -> stylesheet
PAGES = {
    "index": {
        "page": APP_DIR / "index.tsx",
        "style": COMPONENTS_DIR / "index.ts",
    },
    "customer": {
        "page": APP_DIR / "customer.tsx",
        "style": COMPONENTS_DIR / "customer.ts",
    },
    "driver": {
        "page": APP_DIR / "driver.tsx",
        "style": COMPONENTS_DIR / "driver.ts",
    },
}


# ------------------------------------------------------------
# Find styles defined in a StyleSheet
# ------------------------------------------------------------

def find_style_definitions(style_file):
    text = style_file.read_text()

    # Matches:
    #
    #   container: {
    #   quickCard: {
    #   button: {
    #
    pattern = r"^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{"

    return set(re.findall(pattern, text, re.MULTILINE))


# ------------------------------------------------------------
# Find styles referenced by a page
# ------------------------------------------------------------

def find_style_references(page_file):
    text = page_file.read_text()

    # Matches:
    #
    #   styles.container
    #   styles.quickCard
    #   styles.button
    #
    pattern = r"\b(?:styles|[A-Za-z_][A-Za-z0-9_]*Styles)\.([A-Za-z_][A-Za-z0-9_]*)"

    return set(re.findall(pattern, text))


# ------------------------------------------------------------
# Analyze each page
# ------------------------------------------------------------

def analyze_pages():
    results = {}

    for name, files in PAGES.items():

        page_file = files["page"]
        style_file = files["style"]

        if not page_file.exists():
            print(f"ERROR: Page not found: {page_file}")
            continue

        if not style_file.exists():
            print(f"ERROR: Stylesheet not found: {style_file}")
            continue

        definitions = find_style_definitions(style_file)
        references = find_style_references(page_file)

        used = definitions & references
        unused = definitions - references
        missing = references - definitions

        results[name] = {
            "definitions": definitions,
            "references": references,
            "used": used,
            "unused": unused,
            "missing": missing,
        }

    return results


# ------------------------------------------------------------
# Print page-by-page results
# ------------------------------------------------------------

def print_page_results(results):

    for name, data in results.items():

        print()
        print("=" * 60)
        print(f"{name.upper()} STYLES")
        print("=" * 60)

        print(f"\nDefined : {len(data['definitions'])}")
        print(f"Used    : {len(data['used'])}")
        print(f"Unused  : {len(data['unused'])}")

        if data["used"]:
            print("\nUSED:")
            for style in sorted(data["used"]):
                print(f"  {style}")

        if data["unused"]:
            print("\nUNUSED:")
            for style in sorted(data["unused"]):
                print(f"  {style}")

        if data["missing"]:
            print("\nREFERENCED BUT NOT DEFINED:")
            for style in sorted(data["missing"]):
                print(f"  {style}")


# ------------------------------------------------------------
# Find styles used by two or more pages
# ------------------------------------------------------------

def print_common_candidates(results):

    usage = {}

    for page, data in results.items():

        for style in data["used"]:

            if style not in usage:
                usage[style] = set()

            usage[style].add(page)

    candidates = {
        style: pages
        for style, pages in usage.items()
        if len(pages) >= 2
    }

    print()
    print("=" * 60)
    print("CANDIDATES FOR common.ts")
    print("=" * 60)

    if not candidates:
        print("\nNo styles are currently used by more than one page.")
        return

    print()

    for style in sorted(candidates):
        pages = ", ".join(sorted(candidates[style]))
        print(f"  {style:<25} {pages}")


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def main():

    results = analyze_pages()

    if not results:
        print("No pages were analyzed.")
        return

    print_page_results(results)

    print_common_candidates(results)

    print()


if __name__ == "__main__":
    main()