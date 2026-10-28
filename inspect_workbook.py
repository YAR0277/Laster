from pathlib import Path
from odf.opendocument import load
from odf.table import Table, TableRow, TableCell
from odf import teletype

workbook = Path.home() / "Projects/Laster/supabase/docs/tables.ods"

if not workbook.exists():
    raise FileNotFoundError(f"Workbook not found: {workbook}")

doc = load(str(workbook))

print(f"Workbook: {workbook}")
print("=" * 70)

for sheet in doc.spreadsheet.getElementsByType(Table):
    print(f"\nWorksheet: {sheet.getAttribute('name')}")

    rows = sheet.getElementsByType(TableRow)

    if not rows:
        print("  (empty)")
        continue

    for row_num, row in enumerate(rows[:8], start=1):
        cells = row.getElementsByType(TableCell)
        values = []

        for cell in cells[:12]:
            value = teletype.extractText(cell).strip()
            values.append(value if value else "(empty)")

        if any(v != "(empty)" for v in values):
            print(f"  Row {row_num}: {' | '.join(values)}")

print("\nInspection complete. Workbook was not modified.")