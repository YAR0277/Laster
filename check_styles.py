
#!/usr/bin/env python3

from pathlib import Path
import re
from collections import defaultdict


ROOT = Path(__file__).resolve().parent
AREAS = ("Common", "Customer", "Driver")

# Files that import styles, excluding generated and dependency directories.
SOURCE_FILES = [
    path
    for area in AREAS
    for path in (ROOT / area).rglob("*.tsx")
]


def find_style_definitions(style_file):
    text = style_file.read_text()

    # Matches top-level StyleSheet entries, e.g.:
    #   container: {
    #   buttonText: {
    pattern = r"^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{"

    return set(re.findall(pattern, text, re.MULTILINE))


def find_style_imports(source_file):
    text = source_file.read_text()
    imports = {}

    # Match imports such as:
    # import { styles as commonStyles } from '../../Common/src/components/common';
    pattern = (
        r"import\s*\{\s*styles\s+as\s+(\w+)\s*\}"
        r"\s*from\s*['\"]([^'\"]+)['\"]"
    )

    for alias, import_path in re.findall(pattern, text):
        resolved = (source_file.parent / import_path).resolve()

        # Also support imports that omit the .ts extension.
        if not resolved.suffix:
            resolved = resolved.with_suffix(".ts")

        imports[alias] = resolved

    return imports


def find_style_references(source_file, aliases):
    text = source_file.read_text()
    references = defaultdict(set)

    for alias in aliases:
        pattern = rf"\b{re.escape(alias)}\.([A-Za-z_][A-Za-z0-9_]*)"

        references[alias].update(re.findall(pattern, text))

    return references


def analyze():
    definitions = {}
    usage = defaultdict(set)
    missing = []

    # Discover all stylesheets.
    style_files = [
        path
        for area in AREAS
        for path in (ROOT / area).rglob("*.ts")
        if path.name not in ("index.ts",)
    ]

    for style_file in style_files:
        styles = find_style_definitions(style_file)
        if styles:
            definitions[style_file.resolve()] = styles

    # Match each imported stylesheet to references in its importing file.
    for source_file in SOURCE_FILES:
        imports = find_style_imports(source_file)
        references = find_style_references(source_file, imports)

        for alias, style_file in imports.items():
            if style_file not in definitions:
                continue

            defined = definitions[style_file]
            used = references[alias]

            for style in used:
                if style not in defined:
                    missing.append((source_file, alias, style))
                else:
                    usage[(style_file, style)].add(source_file)

    # Report each stylesheet.
    for style_file, styles in sorted(definitions.items()):
        print()
        print("=" * 65)
        print(style_file.relative_to(ROOT))
        print("=" * 65)

        unused = sorted(
            style for style in styles
            if (style_file, style) not in usage
        )

        used = sorted(
            style for style in styles
            if (style_file, style) in usage
        )

        print(f"Defined : {len(styles)}")
        print(f"Used    : {len(used)}")
        print(f"Unused  : {len(unused)}")

        if unused:
            print("\nUNUSED:")
            for style in unused:
                print(f"  {style}")

    # Report missing style definitions.
    print()
    print("=" * 65)
    print("REFERENCED BUT NOT DEFINED")
    print("=" * 65)

    if not missing:
        print("None")
    else:
        for source_file, alias, style in missing:
            print(
                f"{source_file.relative_to(ROOT)}: "
                f"{alias}.{style}"
            )

    # Report styles used by multiple source files.
    print()
    print("=" * 65)
    print("STYLES USED BY MULTIPLE FILES")
    print("=" * 65)

    candidates = [
        (style_file, style, files)
        for (style_file, style), files in usage.items()
        if len(files) >= 2
    ]

    if not candidates:
        print("None")
    else:
        for style_file, style, files in sorted(candidates):
            print(f"\n{style_file.relative_to(ROOT)}: {style}")
            for source_file in sorted(files):
                print(f"  {source_file.relative_to(ROOT)}")


if __name__ == "__main__":
    analyze()
