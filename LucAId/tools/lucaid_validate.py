#!/usr/bin/env python3
"""
LucAId validator — v3.6
Layers:
  1. Control-plane integrity
  2. Schema enforcement
  3. Document registry
  4. Dependency resolution
  5. Source-of-truth integrity
  6. Metadata parity
  7. Enum conformance
  8. Cross-doc validation

New in v3.6:
  - Fix templates loaded from manifest.json → fix_templates (deterministic per rule_id)
  - priority_score per finding: severity × context_weight × blocking_weight
  - Results sorted by priority_score descending
"""
import json, pathlib, re, sys

ROOT          = pathlib.Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "manifest.json"
SCHEMA_PATH   = ROOT / "schema.json"
VERSION       = (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else None

SEVERITY_ORDER = {"INFO": 0, "WARNING": 1, "ERROR": 2, "BLOCKER": 3}

# Priority scoring weights
SEVERITY_WEIGHT    = {"INFO": 1, "WARNING": 2, "ERROR": 8, "BLOCKER": 20}
VERIFIED_CTX_BONUS = 3   # finding in a verified_context file
CI_BLOCKING_BONUS  = 5   # severity ERROR or BLOCKER blocks CI

def load_json(p):  return json.loads(p.read_text(encoding="utf-8"))
def exists(s):     return (ROOT / s).exists()
def read_md(s):    return (ROOT / s).read_text(encoding="utf-8")

def emit(results, severity, rule_id, message, files=None, fix=None):
    results.append({
        "severity":      severity,
        "rule_id":       rule_id,
        "message":       message,
        "files":         files or [],
        "suggested_fix": fix or "",
        "priority_score": 0   # filled in post-processing
    })

def score_results(results, manifest):
    """Compute priority_score for each finding and sort descending."""
    vc_set = set(manifest.get("verified_context", []))
    for r in results:
        sev   = r["severity"]
        base  = SEVERITY_WEIGHT.get(sev, 1)
        ctx   = VERIFIED_CTX_BONUS if any(f in vc_set for f in r.get("files", [])) else 0
        block = CI_BLOCKING_BONUS  if sev in ("ERROR", "BLOCKER") else 0
        r["priority_score"] = base + ctx + block
    results.sort(key=lambda x: x["priority_score"], reverse=True)

def resolve_fix(rule_id, fallback, fix_templates):
    """Return deterministic fix from manifest template, falling back to inline text."""
    return fix_templates.get(rule_id) or fallback or ""

# ---------------------------------------------------------------------------
# Layer 1
# ---------------------------------------------------------------------------
def check_control_plane(results, fix_templates):
    ok = True
    if not MANIFEST_PATH.exists():
        emit(results,"BLOCKER","manifest_exists","manifest.json is missing.",
             ["manifest.json"], resolve_fix("manifest_exists","",fix_templates)); ok=False
    if not SCHEMA_PATH.exists():
        emit(results,"BLOCKER","schema_exists","schema.json is missing.",
             ["schema.json"], resolve_fix("schema_exists","",fix_templates)); ok=False
    if not (ROOT/"VERSION").exists():
        emit(results,"BLOCKER","version_exists","VERSION file is missing.",
             ["VERSION"], resolve_fix("version_exists","",fix_templates)); ok=False
    return ok

# ---------------------------------------------------------------------------
# Layer 2
# ---------------------------------------------------------------------------
def check_schema_enforcement(results, manifest, fix_templates):
    try:
        import jsonschema
    except ImportError:
        emit(results,"WARNING","jsonschema_unavailable",
             "jsonschema not installed — schema validation skipped.",
             ["schema.json"], resolve_fix("jsonschema_unavailable","",fix_templates)); return
    schema = load_json(SCHEMA_PATH)
    try:
        jsonschema.validate(instance=manifest, schema=schema)
    except jsonschema.ValidationError as exc:
        path_str = " > ".join(str(p) for p in exc.absolute_path)
        emit(results,"ERROR","schema_validation_failed",
             f"manifest.json fails schema validation: {exc.message}",
             ["manifest.json","schema.json"],
             resolve_fix("schema_validation_failed", f"Fix at: {path_str}", fix_templates))
    except jsonschema.SchemaError as exc:
        emit(results,"ERROR","schema_invalid",f"schema.json is invalid: {exc.message}",
             ["schema.json"], resolve_fix("schema_invalid","",fix_templates))

# ---------------------------------------------------------------------------
# Layer 3
# ---------------------------------------------------------------------------
def check_document_registry(results, manifest, fix_templates):
    ids, path_to_doc = set(), {}
    doc_status_values = manifest.get("conventions",{}).get("doc_status",[])
    for doc in manifest.get("documents",[]):
        doc_id, path = doc.get("id"), doc.get("path")
        if not doc_id or not re.match(r"^[a-z0-9-]+$", doc_id):
            emit(results,"ERROR","document_id_format",f"Invalid document id: {doc_id!r}",
                 [path or "manifest.json"],
                 resolve_fix("document_id_format","",fix_templates))
        elif doc_id in ids:
            emit(results,"ERROR","unique_document_ids",f"Duplicate document id: {doc_id}",
                 [path or "manifest.json"],
                 resolve_fix("unique_document_ids","",fix_templates))
        else:
            ids.add(doc_id)
        if not path:
            emit(results,"ERROR","document_path_missing",
                 f"Document entry missing path (id: {doc_id})",["manifest.json"],
                 resolve_fix("document_path_missing","",fix_templates)); continue
        path_to_doc[path] = doc
        if not exists(path):
            emit(results,"ERROR","every_document_exists",
                 f"Registered document missing on disk: {path}",
                 [path,"manifest.json"],
                 resolve_fix("every_document_exists","",fix_templates))
        if doc.get("status") not in doc_status_values:
            emit(results,"ERROR","document_status_enum",
                 f"Invalid status {doc.get('status')!r} for {path}. Allowed: {doc_status_values}",
                 [path,"manifest.json"],
                 resolve_fix("document_status_enum","",fix_templates))
    for vc in manifest.get("verified_context",[]):
        if vc not in path_to_doc:
            emit(results,"ERROR","verified_context_registry",
                 f"verified_context path not in documents[]: {vc}",
                 [vc,"manifest.json"],
                 resolve_fix("verified_context_registry","",fix_templates))
        if not exists(vc):
            emit(results,"ERROR","verified_context_paths_exist",
                 f"verified_context path missing on disk: {vc}",[vc],
                 resolve_fix("verified_context_paths_exist","",fix_templates))
    return path_to_doc

# ---------------------------------------------------------------------------
# Layer 4
# ---------------------------------------------------------------------------
def check_dependencies(results, manifest, path_to_doc, fix_templates):
    valid = set(path_to_doc)|{"manifest.json","schema.json","VERSION","CHANGELOG.md"}
    for doc in manifest.get("documents",[]):
        path = doc.get("path","manifest.json")
        for dep in doc.get("depends_on",[]):
            if dep not in valid:
                emit(results,"ERROR","dependencies_resolve",
                     f"{path} depends_on unknown: {dep}",
                     [path,"manifest.json"],
                     resolve_fix("dependencies_resolve","",fix_templates))
    for item in manifest.get("impact_map",[]):
        for dp in item.get("review_docs",[]):
            if dp not in valid:
                emit(results,"ERROR","impact_map_docs_exist",
                     f"impact_map[{item['id']}] references unknown doc: {dp}",
                     ["manifest.json"],
                     resolve_fix("impact_map_docs_exist","",fix_templates))
        for pat in item.get("patterns",[]):
            try: re.compile(pat)
            except re.error as exc:
                emit(results,"ERROR","impact_map_patterns_compile",
                     f"impact_map[{item['id']}] invalid regex {pat!r}: {exc}",
                     ["manifest.json"],
                     resolve_fix("impact_map_patterns_compile","",fix_templates))

# ---------------------------------------------------------------------------
# Layer 5
# ---------------------------------------------------------------------------
def check_source_of_truth(results, manifest, fix_templates):
    seen = {}
    for doc in manifest.get("documents",[]):
        if doc.get("source_of_truth"):
            role, path = doc.get("role"), doc.get("path")
            if role in seen:
                emit(results,"WARNING","source_of_truth_roles_unique",
                     f"Multiple source-of-truth docs share role '{role}': {seen[role]} and {path}",
                     [seen[role],path],
                     resolve_fix("source_of_truth_roles_unique","",fix_templates))
            else:
                seen[role] = path

# ---------------------------------------------------------------------------
# Layer 6
# ---------------------------------------------------------------------------
def check_metadata_parity(results, manifest, fix_templates):
    required = manifest.get("self_validation",{}).get("required_metadata_fields",[])
    labels   = [f"- {f}:" for f in required]
    vc_set   = set(manifest.get("verified_context",[]))
    for doc in manifest.get("documents",[]):
        path = doc.get("path","")
        if not path.endswith(".md") or path not in vc_set or not exists(path): continue
        text = read_md(path)
        if "## Metadata" not in text:
            emit(results,"WARNING","metadata_block",
                 f"Metadata block missing from {path}",[path],
                 resolve_fix("metadata_block","",fix_templates)); continue
        for lbl in labels:
            if lbl not in text:
                emit(results,"WARNING","metadata_field",
                     f"{path} missing metadata field '{lbl[2:-1]}'",[path],
                     resolve_fix("metadata_field","",fix_templates))
        m = re.search(r"- Package Version:\s*([0-9]+\.[0-9]+\.[0-9]+)", text)
        if m and m.group(1) != VERSION:
            emit(results,"ERROR","metadata_version_consistency",
                 f"{path} has Package Version {m.group(1)} but VERSION is {VERSION}",
                 [path,"VERSION"],
                 resolve_fix("metadata_version_consistency","",fix_templates))

# ---------------------------------------------------------------------------
# Layer 7
# ---------------------------------------------------------------------------
def check_enum_conformance(results, manifest, fix_templates):
    conv = manifest.get("conventions",{})
    sev  = set(conv.get("severity",[]))
    esc  = set(conv.get("escalation_levels",[]))
    risks_path = "docs/governance/KNOWN_RISKS.md"
    if exists(risks_path) and sev:
        found = set(re.findall(
            r"\|\s*(Critical|High|Medium|Low|Observation)\s*\|", read_md(risks_path)))
        bad = found - sev
        if bad:
            emit(results,"WARNING","enum_severity_conformance",
                 f"KNOWN_RISKS.md severity values not in manifest conventions: {sorted(bad)}",
                 [risks_path,"manifest.json"],
                 resolve_fix("enum_severity_conformance","",fix_templates))
    safety_path = "docs/governance/CHANGE_SAFETY_RULES.md"
    if exists(safety_path) and esc:
        found = set(re.findall(r"\b(SAFE|REVIEW|CRITICAL|BLOCKED)\b", read_md(safety_path)))
        bad = found - esc
        if bad:
            emit(results,"WARNING","enum_escalation_conformance",
                 f"CHANGE_SAFETY_RULES.md escalation values not in manifest conventions: {sorted(bad)}",
                 [safety_path,"manifest.json"],
                 resolve_fix("enum_escalation_conformance","",fix_templates))

# ---------------------------------------------------------------------------
# Layer 8
# ---------------------------------------------------------------------------
NOISE_TERMS = {
    "order_id","user_id","null","true","false","created_at","updated_at",
    "is_active","sort_order","source_id","source_url","board_id","card_id",
    "column_id","folder_id","file_id","group_id","module_id","message_id",
    "password_id","entity_id","entity_type","grantee_id","grantee_type",
}

def check_cross_doc(results, manifest, fix_templates):
    wf_path = "docs/core/WORKFLOW_MAPS.md"
    gl_path = "docs/reference/CODEBASE_GLOSSARY.md"
    if exists(wf_path) and exists(gl_path):
        wf_terms = {t for t in re.findall(r"`([a-z_][a-z0-9_]{2,})`", read_md(wf_path))
                    if "_" in t and len(t) > 4}
        gl_terms = set(re.findall(r"`([a-z_][a-z0-9_]{2,})`", read_md(gl_path)))
        missing  = wf_terms - gl_terms - NOISE_TERMS
        if missing:
            sample = sorted(missing)[:10]
            emit(results,"WARNING","crossdoc_glossary_coverage",
                 f"WORKFLOW_MAPS.md references {len(missing)} identifier(s) absent from "
                 f"CODEBASE_GLOSSARY.md: {sample}"
                 + (" (first 10)" if len(missing)>10 else ""),
                 [wf_path,gl_path],
                 resolve_fix("crossdoc_glossary_coverage","",fix_templates))
    risks_path = "docs/governance/KNOWN_RISKS.md"
    if exists(risks_path):
        registered = set(re.findall(r"\b(R(?:ISK)?-[0-9]+)\b", read_md(risks_path)))
        if registered:
            for vc in manifest.get("verified_context",[]):
                if vc == risks_path or not exists(vc): continue
                dangling = set(re.findall(r"\b(R(?:ISK)?-[0-9]+)\b", read_md(vc))) - registered
                if dangling:
                    emit(results,"WARNING","crossdoc_risk_ids",
                         f"{vc} references unregistered risk ID(s): {sorted(dangling)}",
                         [vc,risks_path],
                         resolve_fix("crossdoc_risk_ids","",fix_templates))
    domain_path = "docs/core/DOMAIN_RULES.md"
    if exists(domain_path):
        domain_text  = read_md(domain_path)
        sections     = set(re.findall(r"^#{1,3}\s+(?:§\d+\s+)?(.+)$", domain_text, re.MULTILINE))
        domain_lower = {s.lower().strip() for s in sections}
        unmatched = [item["id"] for item in manifest.get("impact_map",[])
                     if not any(any(kw in sec for kw in item["id"].replace("_"," ").split())
                                for sec in domain_lower)]
        if unmatched:
            emit(results,"INFO","crossdoc_impact_domain_coverage",
                 f"impact_map area(s) with no obvious DOMAIN_RULES.md section match: {unmatched}",
                 ["manifest.json",domain_path],
                 resolve_fix("crossdoc_impact_domain_coverage","",fix_templates))

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    results      = []
    fix_templates = {}

    if not check_control_plane(results, fix_templates):
        print(json.dumps({"ok":False,"results":results},indent=2)); return 2

    manifest      = load_json(MANIFEST_PATH)
    fix_templates = manifest.get("fix_templates", {})
    pkg           = manifest.get("package",{})

    if pkg.get("version") != VERSION:
        emit(results,"ERROR","version_consistency",
             f"VERSION ({VERSION}) != manifest version ({pkg.get('version')}).",
             ["VERSION","manifest.json"],
             resolve_fix("version_consistency","",fix_templates))

    check_schema_enforcement(results, manifest, fix_templates)
    path_to_doc = check_document_registry(results, manifest, fix_templates)
    check_dependencies(results, manifest, path_to_doc, fix_templates)
    check_source_of_truth(results, manifest, fix_templates)
    check_metadata_parity(results, manifest, fix_templates)
    check_enum_conformance(results, manifest, fix_templates)
    check_cross_doc(results, manifest, fix_templates)

    score_results(results, manifest)

    worst = max((SEVERITY_ORDER[r["severity"]] for r in results), default=0)
    output = {
        "ok":                    worst < SEVERITY_ORDER["ERROR"],
        "package_version":       VERSION,
        "registered_docs":       len(manifest.get("documents",[])),
        "verified_context_docs": len(manifest.get("verified_context",[])),
        "validation_layers":     8,
        "findings":              len(results),
        "results":               results,
    }
    print(json.dumps(output, indent=2))
    return 1 if worst >= SEVERITY_ORDER["ERROR"] else 0

if __name__ == "__main__":
    raise SystemExit(main())
