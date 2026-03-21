#!/usr/bin/env python3
import json, pathlib, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
def load_changed(path):
    lines = [line.strip() for line in pathlib.Path(path).read_text(encoding="utf-8").splitlines()]
    return [line for line in lines if line]
def main():
    if len(sys.argv) < 2:
        print("Usage: lucaid_plan.py changed_files.txt", file=sys.stderr)
        return 2
    changed = load_changed(sys.argv[1]); impacts = []; docs = set(["docs/governance/CHANGE_SAFETY_RULES.md"]); notes = []; matched = False
    for item in manifest.get("impact_map", []):
        local_hits = []
        for pattern in item.get("patterns", []):
            regex = re.compile(pattern)
            local_hits.extend([path for path in changed if regex.search(path)])
        if local_hits:
            matched = True
            impacts.append({"id": item["id"], "hits": sorted(set(local_hits)), "review_docs": item["review_docs"], "notes": item.get("notes", [])})
            docs.update(item["review_docs"])
            notes.extend(item.get("notes", []))
    result = {"matched": matched, "changed_files": changed, "docs_to_review": sorted(docs), "impact_areas": impacts, "notes": sorted(set(notes))}
    print(json.dumps(result, indent=2))
    return 0
if __name__ == "__main__":
    raise SystemExit(main())
