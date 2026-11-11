
import sys
import re
import zxingcpp
from PIL import Image

# AAMVA field identifiers and descriptions.
# Extend this dictionary as needed.
FIELD_NAMES = {
    "DAQ": "License number",
    "DCS": "Last name",
    "DAC": "First name",
    "DAD": "Middle name",
    "DBB": "Date of birth",
    "DBA": "Expiration date",
    "DBD": "Issue date",
    "DBC": "Sex",
    "DAY": "Eye color",
    "DAU": "Height",
    "DAG": "Street address",
    "DAI": "City",
    "DAJ": "State",
    "DAK": "Postal code",
    "DCF": "Document discriminator",
    "DCG": "Country",
    "DCA": "Vehicle class",
    "DCB": "Restrictions",
    "DCD": "Endorsements",
    "DDA": "Compliance type",
    "DDB": "Card revision date",
    "DDC": "Hazmat endorsement expiration",
    "DDD": "Limited duration indicator",
}

# Fields currently selected for Laster.
SELECTED_FIELDS = ["DAQ", "DCS", "DAC", "DBB", "DBA", "DAJ"]

def inspect_aamva_header(data):
    """Inspect the AAMVA header and subfile directory."""

    print("\nAAMVA header inspection:")

    if not data.startswith("@"):
        print("Unexpected header: missing @")
        return

    # Display only the header prefix, not license data.
    print("Header prefix:", repr(data[:20]))

    ansi_match = re.search(r"ANSI\s+(\d{6,})", data)

    if ansi_match:
        print("ANSI version:", ansi_match.group(1))
    else:
        print("ANSI version: not identified")

    # Locate the subfile directory.
    # AAMVA subfile designators are two-character identifiers,
    # followed by a four-digit offset and four-digit length.
    directory_pattern = re.compile(
        r"([A-Z]{2})(\d{4})(\d{4})"
    )

    for match in directory_pattern.finditer(data[:100]):
        print(
            f"Subfile: {match.group(1)}, "
            f"offset: {match.group(2)}, "
            f"length: {match.group(3)}"
        )

def parse_aamva(data):
    """Parse AAMVA element identifiers and their values."""

    # Normalize record separators.
    data = (
        data.replace("\r", "\n")
            .replace("\x1e", "\n")
            .replace("\x1d", "\n")
    )

    parsed = {}

    # Find all known three-character field identifiers.
    codes = sorted(FIELD_NAMES, key=len, reverse=True)
    pattern = r"(?<![A-Z])(" + "|".join(codes) + r")"

    matches = list(re.finditer(pattern, data))

    for i, match in enumerate(matches):
        code = match.group(1)
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(data)

        value = data[start:end].strip(" \t\n\r\x1e\x1d")
        value = value.removesuffix("<LF>").strip()
        parsed[code] = value

    return parsed


def main():
    if len(sys.argv) != 2:
        print("Usage: python decode_license.py <image-file>")
        sys.exit(1)

    image = Image.open(sys.argv[1])
    results = zxingcpp.read_barcodes(image)

    if not results:
        print("No barcode detected.")
        sys.exit(1)

    for result in results:
        print(f"Format: {result.format}")
        print(f"Payload length: {len(result.text)}")

        if str(result.format) != "PDF417":
            print("Not a PDF417 barcode.")
            continue

        parsed = parse_aamva(result.text)

        inspect_aamva_header(result.text)

        print("\nSelected AAMVA fields:")
        for code in SELECTED_FIELDS:
            description = FIELD_NAMES[code]
            value = parsed.get(code, "")
            print(f"{description:18} ({code}): {value or 'NOT FOUND'}")

        print(f"\nFields parsed: {len(parsed)}")
        print(f"Known field identifiers: {len(FIELD_NAMES)}")


if __name__ == "__main__":
    main()
