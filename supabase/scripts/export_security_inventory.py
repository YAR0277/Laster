#!/usr/bin/env python3
"""Export a read-only PostgreSQL security inventory to tables.ods."""

from datetime import datetime
from getpass import getpass
from pathlib import Path
import sys

import psycopg
from odf.opendocument import load
from odf.table import Table, TableRow, TableCell
from odf.text import P


ROOT = Path.home() / "Projects/Laster"
WORKBOOK = ROOT / "supabase/docs/tables.ods"

HOST = "db.hgmohmaxuwvexqbnblnc.supabase.co"
DATABASE = "postgres"
USER = "laster_audit"
PORT = 5432

TABLES = [
    "trips", "customers", "drivers", "driver_earnings",
    "driver_payouts", "payout_periods", "payment_settings",
]

QUERIES = {
    "tables": """
        SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner),
               c.relrowsecurity, c.relforcerowsecurity,
               obj_description(c.oid, 'pg_class')
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r','p','v','m')
        ORDER BY c.relname
    """,
    "columns": """
        SELECT table_name, ordinal_position, column_name, data_type,
               is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """,
    "policies": """
        SELECT schemaname, tablename, policyname, permissive,
               roles::text, cmd, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    """,
    "constraints": """
        SELECT n.nspname, c.relname, con.conname, con.contype,
               pg_get_constraintdef(con.oid)
        FROM pg_constraint con
        JOIN pg_class c ON c.oid = con.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        ORDER BY c.relname, con.conname
    """,
    "indexes": """
        SELECT schemaname, tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    """,
    "table_grants": """
        SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner),
               CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
                    ELSE pg_get_userbyid(acl.grantee) END AS grantee,
               acl.privilege_type, acl.is_grantable
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN LATERAL aclexplode(
            COALESCE(c.relacl, acldefault('r', c.relowner))
        ) AS acl
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r','p','v','m','S')
        ORDER BY c.relname, grantee, acl.privilege_type
    """,
    "column_grants": """
        SELECT table_name, column_name, grantee, privilege_type,
               is_grantable
        FROM information_schema.column_privileges
        WHERE table_schema = 'public'
        ORDER BY table_name, column_name, grantee, privilege_type
    """,
    "functions": """
        SELECT n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid),
               pg_get_userbyid(p.proowner),
               p.prosecdef,
               COALESCE(array_to_string(p.proconfig, ', '), ''),
               pg_get_function_result(p.oid),
               pg_get_functiondef(p.oid)
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        ORDER BY p.proname
    """,
    "default_privileges": """
        SELECT pg_get_userbyid(d.defaclrole) AS owner_role,
               n.nspname AS schema_name,
               d.defaclobjtype,
               CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                    ELSE pg_get_userbyid(a.grantee) END AS grantee,
               a.privilege_type, a.is_grantable
        FROM pg_default_acl d
        LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
        CROSS JOIN LATERAL aclexplode(d.defaclacl) a
        ORDER BY owner_role, schema_name, d.defaclobjtype, grantee
    """,
    "roles": """
        SELECT rolname, rolsuper, rolcreaterole, rolcreatedb,
               rolcanlogin, rolreplication, rolbypassrls
        FROM pg_roles
        ORDER BY rolname
    """,
}


def value_text(value):
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(map(str, value))
    return str(value)


def replace_sheet(sheet, rows):
    """Replace a sheet's contents while retaining its sheet object."""
    for child in list(sheet.childNodes):
        sheet.removeChild(child)

    for values in rows:
        row = TableRow()
        for value in values:
            cell = TableCell(valuetype="string")
            paragraph = P()
            paragraph.addText(value_text(value))
            cell.addElement(paragraph)
            row.addElement(cell)
        sheet.addElement(row)


def main():
    if not WORKBOOK.exists():
        sys.exit(f"Workbook not found: {WORKBOOK}")

    password = getpass(f"Password for PostgreSQL user {USER}: ")

    try:
        with psycopg.connect(
            host=HOST,
            port=PORT,
            dbname=DATABASE,
            user=USER,
            password=password,
            sslmode="require",
            connect_timeout=15,
            options="-c default_transaction_read_only=on",
        ) as conn:
            with conn.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY")
                audit_time = datetime.now().astimezone().isoformat(
                    timespec="seconds"
                )

                results = {}
                errors = {}

                for name, sql in QUERIES.items():
                    try:
                        cur.execute(sql)
                        headers = [desc.name for desc in cur.description]
                        results[name] = [headers] + list(cur.fetchall())
                    except Exception as exc:
                        conn.rollback()
                        with conn.cursor() as retry:
                            retry.execute("SET TRANSACTION READ ONLY")
                        errors[name] = str(exc)
                        results[name] = [["Query"], [f"ERROR: {exc}"]]

                doc = load(str(WORKBOOK))
                sheets = {
                    sheet.getAttribute("name"): sheet
                    for sheet in doc.spreadsheet.getElementsByType(Table)
                }

                # Overview sheet
                overview = [
                    ["Laster database security inventory"],
                    ["Audit timestamp", audit_time],
                    ["Database host", HOST],
                    ["Database", DATABASE],
                    ["Audit role", USER],
                    ["Connection", "Successful"],
                    ["Workbook", str(WORKBOOK)],
                    [],
                    ["Inventory section", "Rows collected"],
                ]
                for name, rows in results.items():
                    overview.append([name, max(0, len(rows) - 1)])
                overview += [
                    [],
                    ["Query errors", len(errors)],
                ]
                for name, message in errors.items():
                    overview.append([name, message])

                if "overview" in sheets:
                    replace_sheet(sheets["overview"], overview)

                # One sheet per application table: table details and policies.
                for table in TABLES:
                    rows = [
                        ["Laster table inventory", table],
                        ["Audit timestamp", audit_time],
                        [],
                        ["TABLE METADATA"],
                        results["tables"][0],
                    ]
                    rows += [
                        r for r in results["tables"][1:]
                        if len(r) > 1 and r[1] == table
                    ]
                    rows += [
                        [],
                        ["COLUMNS"],
                        results["columns"][0],
                    ]
                    rows += [
                        r for r in results["columns"][1:]
                        if r[0] == table
                    ]
                    for section, key, match_col in [
                        ("TABLE GRANTS", "table_grants", 1),
                        ("COLUMN GRANTS", "column_grants", 0),
                        ("RLS POLICIES", "policies", 1),
                        ("CONSTRAINTS", "constraints", 1),
                        ("INDEXES", "indexes", 1),
                    ]:
                        rows += [[], [section], results[key][0]]
                        rows += [
                            r for r in results[key][1:]
                            if len(r) > match_col and r[match_col] == table
                        ]

                    if table in sheets:
                        replace_sheet(sheets[table], rows)

                # Full security inventory across public schema.
                security_rows = [
                    ["Laster database security inventory"],
                    ["Audit timestamp", audit_time],
                ]
                for section, key in [
                    ("TABLE METADATA", "tables"),
                    ("TABLE GRANTS", "table_grants"),
                    ("COLUMN GRANTS", "column_grants"),
                    ("RLS POLICIES", "policies"),
                    ("DEFAULT PRIVILEGES", "default_privileges"),
                    ("DATABASE ROLES", "roles"),
                ]:
                    security_rows += [[], [section]]
                    security_rows += results[key]

                if "database_security" in sheets:
                    replace_sheet(sheets["database_security"], security_rows)

                function_rows = [
                    ["Public database functions"],
                    ["Audit timestamp", audit_time],
                    [],
                ] + results["functions"]

                if "functions" in sheets:
                    replace_sheet(sheets["functions"], function_rows)

                doc.save(str(WORKBOOK))

                print(f"\nWorkbook updated: {WORKBOOK}")
                print(f"Audit timestamp: {audit_time}")
                for name, rows in results.items():
                    print(f"  {name}: {max(0, len(rows) - 1)} rows")
                if errors:
                    print("\nSome catalog queries failed:")
                    for name, message in errors.items():
                        print(f"  {name}: {message}")
                    print("Review these errors; missing data is not proof of safety.")

    except psycopg.Error as exc:
        sys.exit(f"Database connection/query failed: {exc}")


if __name__ == "__main__":
    main()