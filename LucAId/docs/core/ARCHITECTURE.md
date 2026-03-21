## Metadata
- Repository: {{REPOSITORY}}
- System: {{SYSTEM_NAME}}
- Package Version: {{VERSION}}
- Last Reviewed: {{DATE}}
- Status: Draft
- Source of Truth: Yes — for system layers, data flows, trust boundaries, and enforcement ownership
- Depends On: `docs/SYSTEM_OVERVIEW.md`
- Used By: `docs/core/AI_ANALYSIS.md`, `docs/governance/KNOWN_RISKS.md`
- Owner: {{OWNER}}
- Update Triggers: layer changes, trust boundary changes, new backend service, new integration

---

## Purpose

This file describes the system's architecture from the perspective of correctness and security analysis. It defines trust boundaries, enforcement ownership, and blast radius — not deployment topology.

**See also:**
- `docs/SYSTEM_OVERVIEW.md` — module inventory and integration points
- `docs/core/PERMISSION_MODEL.md` — permission enforcement within the architecture
- `docs/reference/DATA_MODEL.md` — data layer detail

---

## System layers

*Describe the layers of the system and what each is responsible for.*

*Example structure:*

| Layer | Technology | Responsibility | Trust level |
|-------|-----------|----------------|-------------|
| Client | | UI, routing, local state | Untrusted |
| API / Functions | | Business logic, auth checks | Trusted |
| Database | | Data persistence, RLS | Trusted |

---

## Trust boundaries

*Where does trust shift in this system? What is enforced at each boundary?*

- **Client → API:** *describe what is and is not enforced*
- **API → Database:** *describe RLS, policies, and server-side validation*

---

## Enforcement ownership

*For each critical concern, who owns enforcement?*

| Concern | Enforced by | Location |
|---------|-------------|----------|
| Authentication | | |
| Authorization | | |
| Data validation | | |
| Rate limiting | | |

---

## Data flows

*Describe key data flows, especially for sensitive operations.*

---

## Blast radius map

*Which components, if compromised or incorrectly changed, affect the most of the system?*

| Component | Blast radius | Reason |
|-----------|-------------|--------|
| | | |

---

## Known architectural risks

*High-level architectural weaknesses. Full entries in `governance/KNOWN_RISKS.md`.*
