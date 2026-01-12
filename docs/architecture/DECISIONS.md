# Architecture Decisions & Resolutions

## Data Structure: Original Field Names vs Display Names

**Issue**: KQL query results use original field names (e.g., `Computer_s`, `TimeGenerated`) but UI shows user-friendly display names (e.g., `Computer`, `Time Generated`).

**Decision**:

- `data.headers` contains **ORIGINAL field names** from query results
- `data.columns` contains metadata (type, etc.)
- Display names are managed by `columnNameFormatter` utility
- All data processing (enrichment, correlation queries) must use `data.headers` NOT display names

**Files Affected**:

- `src/hooks/useResultsEnrichment.ts` - Uses original field names from headers
- `src/components/ResultsTable.tsx` - Line 398: `const columnName = data.headers[cellIndex]`
- `src/utils/columnNameFormatter.ts` - Manages display name mappings

**Resolution Pattern**:

```typescript
// ✅ CORRECT - Use headers for data processing
await enrichResults(data.rows, data.headers);

// ❌ WRONG - Don't use columns for field names
await enrichResults(data.rows, data.columns);
```

**Date Discovered**: 2025-11-05
**Last Violated**: 2025-11-05
**Times Violated**: 2+ times

---

## Enrichment Entity Detection

**Issue**: Must detect SPECIFIC values (e.g., "vmWINSVR01", "CVE-2017-0199") NOT generic values (e.g., "SecurityEvent", "Alert").

**Decision**:

- Detect actual asset names (computer names, usernames, devices)
- Extract CVE numbers with regex: `CVE-\d{4}-\d+`
- Extract EventIDs as numeric values: `\b(\d{4,5})\b`
- Extract file hashes (MD5/SHA1/SHA256): `[a-fA-F0-9]{32,64}`
- Extract IP addresses: `\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}`
- Skip generic table/category names, severity levels, statuses

**Skip Values**:

- Table names: securityevent, securityalert, signin, audit
- Generic: alert, event, activity, unknown, n/a, null
- Severities: low, medium, high, critical
- Statuses: success, failure, true, false

**Field Name Patterns** (Log Analytics uses suffixes):

- `_s` = string
- `_d` = decimal
- `_b` = boolean
- `_g` = GUID
- No suffix = dynamic

**Date Discovered**: 2025-11-05

---

## KQL Search Syntax

**Issue**: Using `where * contains` doesn't work reliably with Sentinel REST API.

**Decision**: Use `search` operator instead:

```kql
// ✅ CORRECT
SecurityEvent | where TimeGenerated > ago(1d) | search "vmWINSVR01" | count

// ❌ WRONG
SecurityEvent | where TimeGenerated > ago(1d) | where * contains "vmWINSVR01" | count
```

**Reasoning**: `search` operator is optimized for cross-column text search and works better with the API.

**Date Discovered**: 2025-11-05

---

## Time Filtering for Correlations

**Issue**: Correlation queries without time limits return too many results (15K+).

**Decision**: Use 1-day time window with `ago(1d)`:

```kql
SecurityEvent | where TimeGenerated > ago(1d) | search "value" | count
```

**Rationale**:

- 7 days returned 15K+ records
- 1 day provides recent, relevant correlations
- Could make configurable in future (1d/7d/30d)

**Date Discovered**: 2025-11-05

---

## Tooltip Z-Index Issues

**Issue**: Carbon Tooltip component couldn't escape table cell stacking context.

**Decision**: Use custom CSS tooltip with `position: fixed` and JavaScript positioning:

```css
.correlation-tooltip {
  position: fixed;
  z-index: 999999;
}
```

```javascript
onMouseEnter={(e) => {
  const tooltip = e.currentTarget.querySelector('.correlation-tooltip');
  const rect = e.currentTarget.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top - 8}px`;
  tooltip.style.transform = 'translate(-50%, -100%)';
}}
```

**Reasoning**: Native `title` attribute has delay, Carbon Tooltip has z-index issues, custom CSS with JS positioning is reliable.

**Date Discovered**: 2025-11-05

---

## Template for New Decisions

````markdown
## [Decision Title]

**Issue**: Brief description of the problem

**Decision**: What we decided to do

**Reasoning**: Why this approach

**Files Affected**:

- file1.ts - what changed
- file2.tsx - what changed

**Code Example**:

```typescript
// ✅ CORRECT
// example

// ❌ WRONG
// example
```
````

**Date Discovered**: YYYY-MM-DD
**Last Violated**: YYYY-MM-DD (if applicable)

```

```

## Environment Configuration: .env.local Override Gotcha

**Issue**: `.env.local` file (gitignored) takes precedence over `.env` (committed). Creating `.env.local` from `.env.example` breaks working features like Azure OpenAI.

**Decision**:
- `.env` is source of truth with working values
- `.env.local` is for developer-specific overrides ONLY
- If `.env.local` must exist, copy from `.env` NOT `.env.example`
- Better: Don't create `.env.local` unless actually needed

**Consequences When Violated**:
-  Azure OpenAI stops working (AI features show "Configure Azure OpenAI")
-  Authentication may fail (placeholder tenant/client IDs)
-  Backend API calls may fail (wrong URL)
-  Takes time to diagnose (environment files not first suspect)

**Date Discovered**: 2025-12-10
**Last Violated**: 2025-12-10 (AI features broken for ~1 hour)

---

## Blast Radius: Crown Jewels Classification  

**Issue**: SQL/database systems were classified as `sensitive-data` type, not `crown-jewel`. Azure VM naming with `vm` prefix prevented pattern matching.

**Decision**:
- SQL/database systems now classified as `crown-jewel` type (business value 10)
- Strip `vm` prefix before pattern matching: `vmSQL01`  `sql01`

**Date Discovered**: 2025-12-16
**Date Fixed**: 2025-12-16

---

## Tag-Based Asset Classification

**Issue**: Asset criticality was only determined by naming patterns. Users wanted to use Azure VM tags for classification.

**Decision**:
- `blastRadiusService.classifyAsset()` accepts optional `tags` parameter
- Tags checked BEFORE naming patterns (higher precedence)
- If no tags or no matching tags, fall through to naming patterns

**Date Discovered**: 2025-12-10
**Implemented**: 2025-12-10
**Status**: Code complete, needs testing with real tags

