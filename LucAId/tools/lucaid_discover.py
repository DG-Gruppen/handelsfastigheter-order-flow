#!/usr/bin/env python3
"""
LucAId discover — v3.6

Auto-discovers routes, DB tables, and backend functions from the repository
and suggests impact_map patterns for manifest.json.

Usage:
    python tools/lucaid_discover.py [--root <repo_root>] [--output <file>]

Output: JSON with suggested impact_map entries based on actual repo structure.
"""
import json, pathlib, re, sys, argparse

# ---------------------------------------------------------------------------
# Discovery strategies
# ---------------------------------------------------------------------------

def discover_pages(repo_root):
    """Find page/route files and group them into logical areas."""
    areas = {}
    for pattern in ["src/pages/**/*.tsx", "src/pages/**/*.ts",
                    "pages/**/*.tsx", "app/**/*.tsx", "app/**/*.ts"]:
        for f in repo_root.glob(pattern):
            rel = str(f.relative_to(repo_root))
            # Group by first path segment after pages/app
            parts = rel.replace("\\", "/").split("/")
            idx   = next((i for i,p in enumerate(parts) if p in ("pages","app")), None)
            if idx is not None and idx + 1 < len(parts):
                area = parts[idx + 1].lower().replace(".tsx","").replace(".ts","")
                areas.setdefault(area, []).append(rel)
    return areas

def discover_tables(repo_root):
    """Find table names from migration files or schema files."""
    tables = set()
    migration_patterns = [
        "supabase/migrations/**/*.sql",
        "migrations/**/*.sql",
        "db/migrations/**/*.sql",
        "prisma/migrations/**/*.sql",
    ]
    for pattern in migration_patterns:
        for f in repo_root.glob(pattern):
            text = f.read_text(encoding="utf-8", errors="ignore")
            found = re.findall(r"CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(?:public\.)?[\"']?(\w+)[\"']?", text, re.IGNORECASE)
            tables.update(found)

    # Also check prisma schema
    prisma_schema = repo_root / "prisma" / "schema.prisma"
    if prisma_schema.exists():
        text = prisma_schema.read_text(encoding="utf-8", errors="ignore")
        found = re.findall(r"^model\s+(\w+)\s*\{", text, re.MULTILINE)
        tables.update(found)

    return sorted(tables)

def discover_backend_functions(repo_root):
    """Find backend functions/edge functions."""
    functions = []
    for pattern in [
        "supabase/functions/*/index.ts",
        "api/**/*.ts", "api/**/*.js",
        "functions/**/*.ts", "functions/**/*.js",
        "netlify/functions/**/*.ts",
        "src/api/**/*.ts",
    ]:
        for f in repo_root.glob(pattern):
            rel = str(f.relative_to(repo_root))
            functions.append(rel)
    return sorted(functions)

def discover_auth_files(repo_root):
    """Find auth-related files."""
    patterns = ["useAuth", "useSession", "auth", "middleware", "ProtectedRoute",
                "withAuth", "requireAuth", "session", "jwt", "token"]
    found = []
    for f in repo_root.rglob("*.ts"):
        name = f.stem.lower()
        if any(p.lower() in name for p in patterns):
            found.append(str(f.relative_to(repo_root)))
    for f in repo_root.rglob("*.tsx"):
        name = f.stem.lower()
        if any(p.lower() in name for p in patterns):
            found.append(str(f.relative_to(repo_root)))
    return sorted(set(found))[:20]  # cap at 20

def discover_migration_files(repo_root):
    """Find migration directories."""
    dirs = set()
    for pattern in ["supabase/migrations", "migrations", "db/migrations", "prisma/migrations"]:
        p = repo_root / pattern
        if p.exists():
            dirs.add(pattern)
    return sorted(dirs)

# ---------------------------------------------------------------------------
# Impact map suggestion builder
# ---------------------------------------------------------------------------

def build_impact_map(repo_root):
    pages      = discover_pages(repo_root)
    tables     = discover_tables(repo_root)
    functions  = discover_backend_functions(repo_root)
    auth_files = discover_auth_files(repo_root)
    mig_dirs   = discover_migration_files(repo_root)

    suggestions = []

    # Auth / permissions area
    if auth_files:
        auth_patterns = list(set(
            "^" + re.escape("/".join(f.replace("\\","/").split("/")[:2])) + "/"
            for f in auth_files[:5]
        ))
        suggestions.append({
            "id": "auth_permissions",
            "patterns": auth_patterns,
            "review_docs": [
                "docs/core/PERMISSION_MODEL.md",
                "docs/core/ARCHITECTURE.md",
                "docs/governance/KNOWN_RISKS.md",
                "docs/governance/CHANGE_SAFETY_RULES.md"
            ],
            "notes": ["Verify server-side role enforcement and access assumptions."],
            "_discovered_files": auth_files[:10]
        })

    # Page areas
    standard_review = [
        "docs/core/DOMAIN_RULES.md",
        "docs/core/WORKFLOW_MAPS.md",
        "docs/governance/KNOWN_RISKS.md",
        "docs/governance/CHANGE_SAFETY_RULES.md"
    ]
    for area, files in sorted(pages.items()):
        if area in ("index", "404", "_app", "layout"): continue
        # Find common prefix
        prefix = files[0].replace("\\","/").rsplit("/",1)[0]
        suggestions.append({
            "id": area,
            "patterns": [f"^{re.escape(prefix)}/"],
            "review_docs": standard_review,
            "notes": [f"Review {area} module domain rules and workflows."],
            "_discovered_files": files[:5]
        })

    # Backend / migrations area
    mig_patterns = [f"^{re.escape(d)}/" for d in mig_dirs]
    fn_patterns  = list(set(
        "^" + re.escape("/".join(f.replace("\\","/").split("/")[:2])) + "/"
        for f in functions[:5]
    ))
    if mig_patterns or fn_patterns:
        suggestions.append({
            "id": "backend",
            "patterns": list(set(mig_patterns + fn_patterns)),
            "review_docs": [
                "docs/core/ARCHITECTURE.md",
                "docs/core/DOMAIN_RULES.md",
                "docs/reference/DATA_MODEL.md",
                "docs/governance/KNOWN_RISKS.md",
                "docs/governance/CHANGE_SAFETY_RULES.md"
            ],
            "notes": ["State whether change closes, widens, or is unrelated to any open risk."],
            "_discovered_tables": tables[:20],
            "_discovered_functions": functions[:10]
        })

    # System docs area (always include)
    suggestions.append({
        "id": "system_docs",
        "patterns": [
            "^docs/SYSTEM_OVERVIEW\\.md",
            "^manifest\\.json",
            "^schema\\.json"
        ],
        "review_docs": [
            "docs/core/AI_ANALYSIS.md",
            "docs/core/ARCHITECTURE.md",
            "docs/core/DOMAIN_RULES.md",
            "docs/core/PERMISSION_MODEL.md",
            "docs/core/WORKFLOW_MAPS.md",
            "docs/governance/DOC_OWNERSHIP_RULES.md",
            "docs/governance/SELF_VALIDATION_RULES.md",
            "docs/reference/DATA_MODEL.md",
            "docs/governance/CHANGE_SAFETY_RULES.md"
        ],
        "notes": ["Review package-wide consistency and control-plane drift."]
    })

    return suggestions, tables, functions

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="LucAId impact_map discovery")
    parser.add_argument("--root",   default=".", help="Repository root (default: current dir)")
    parser.add_argument("--output", default=None, help="Write output to file instead of stdout")
    args = parser.parse_args()

    repo_root = pathlib.Path(args.root).resolve()
    if not repo_root.exists():
        print(f"Error: repo root '{repo_root}' does not exist.", file=sys.stderr)
        return 2

    suggestions, tables, functions = build_impact_map(repo_root)

    output = {
        "instructions": (
            "Review the suggested impact_map entries below. "
            "Copy the entries (without _discovered_* keys) into manifest.json → impact_map. "
            "Adjust patterns as needed for your project structure. "
            "Patterns are anchored regex — test with: python3 -c \"import re; re.match('<pattern>', '<path>')\""
        ),
        "repo_root": str(repo_root),
        "discovered": {
            "db_tables":          tables,
            "backend_functions":  functions,
            "page_areas":         list(set(s["id"] for s in suggestions if s["id"] not in ("backend","system_docs","auth_permissions")))
        },
        "suggested_impact_map": suggestions
    }

    result = json.dumps(output, indent=2, ensure_ascii=False)

    if args.output:
        pathlib.Path(args.output).write_text(result, encoding="utf-8")
        print(f"Discovery output written to {args.output}")
    else:
        print(result)

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
