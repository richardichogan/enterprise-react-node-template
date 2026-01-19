# Project Setup Model - Refined Architecture
**Date**: January 16, 2026  
**Status**: Design Document (Ready for Implementation)

---

## Overview

The project setup model establishes a **hierarchical, metadata-aware knowledge base** for RFI response generation. Documents are classified by role (constraints, exemplars, content sources) and indexed with metadata to enable intelligent retrieval and provenance tracking.

---

## 1. Document Classification Model

### 1.1 Primary Signposts (Constraints & Exemplars)
These documents define HOW the RFI content should be presented, not WHAT content to use.

| Category | Document Type | Role | Format | Metadata Tag | Priority |
|----------|--------------|------|--------|--------------|----------|
| **Structure Constraint** | Briefing Deck | Defines presentation structure, section ordering, slide count | PDF, PPTX | `briefing_deck` | HIGH |
| **Criteria Constraint** | Welcome Pack | Specifies evaluation framework, key messages, assessment dimensions | PDF, DOCX | `welcome_pack` | HIGH |
| **Style Exemplar** | Last Year's Submission | Shows expected depth, quality level, content patterns, visual style | PPTX, PDF | `exemplar_submission` | MEDIUM |

**Key Properties:**
- These are uploaded ONCE per project
- They inform structure and quality expectations
- They do NOT contain the actual claims/metrics being submitted
- Version control: must confirm date before generation starts

### 1.2 Fact Sources (Indexed, Prioritized, Content)
Documents containing actual claims, metrics, case studies, capabilities.

| Category | Document Type | Role | Format | Metadata Tag | Priority | Auto-Detect Pattern |
|----------|--------------|------|--------|--------------|----------|---------------------|
| **Primary Content** | RFI Response | The actual submission content; vendor answers to analyst questions | DOCX, PDF, TXT | `rfi_response` | **CRITICAL** | Contains "RFI", "Response", "Submission" in filename; or explicit selection |
| **Supporting Facts** | Fact Sources Folder | Metrics, case studies, whitepapers, technical specs, capability docs | Any | `fact_source` | HIGH | Upload folder; tagged on upload |

**Key Properties:**
- RFI Response is the SOURCE OF TRUTH for claims
- Fact sources provide supporting evidence/examples
- All are indexed in Azure AI Search
- Agents retrieve from these with metadata filters
- Must have **provenance tracking**: "this metric came from RFI response" vs "marketing deck"

### 1.3 Secondary Context (Manual + Optional Indexed)
Strategic guidance, focus areas, constraints on content generation.

| Category | Input Type | Role | Format | Metadata Tag | Auto-Index |
|----------|-----------|------|--------|--------------|-----------|
| **Strategic Context** | Text Box (Manual) | Key messages, positioning focus, tone, taboo topics | Structured text | `strategic_context` | No |
| **Additional Context Docs** | Optional Upload | Extra reference material | Any | `secondary_context` | Yes |

**Strategic Context Structure:**
```
KEY MESSAGES (3-5 core messages)
- Message 1: [Position/differentiator]
- Message 2: [Capability/proof point]
- Message 3: [Competitive angle]

POSITIONING FOCUS AREAS (What to emphasize)
- [ ] Scale and global presence
- [ ] Innovation and IP
- [ ] Customer success/transformation
- [ ] Partnerships and ecosystem
- [ ] Risk mitigation
- [Other custom focus area]

TONE & STYLE GUIDANCE
- Professional level: [Executive / Technical / Balanced]
- Formality: [Formal / Conversational / Data-driven]
- Risk tolerance: [Conservative / Balanced / Aggressive]

TABOO TOPICS (Avoid mentioning)
- Don't emphasize: [topic]
- Don't compare to: [competitor]
- Sensitive areas: [area]
```

---

## 2. Metadata Auto-Detection Logic

When a document is uploaded, the system auto-detects metadata based on filename patterns and content analysis.

### 2.1 Filename Pattern Matching (Primary)

```javascript
// Priority 1: Explicit filename patterns
const patterns = {
  'rfi_response': /^.*\b(RFI|rfi|response|submission).*\.(docx?|pdf|txt)$/i,
  'briefing_deck': /^.*\b(briefing|deck|agenda|structure).*\.(pptx?|pdf)$/i,
  'welcome_pack': /^.*\b(welcome|introduction|overview|guidelines).*\.(docx?|pdf)$/i,
  'exemplar_submission': /^.*\b(2024|2023|2022|previous|last|year|example|exemplar).*\.(pptx?|pdf)$/i,
  'fact_source': /^.*\b(case|study|whitepaper|capability|metric|data|datasheet).*\.(docx?|pdf|xlsx?)$/i,
};
```

### 2.2 Content Analysis (Secondary, if filename unclear)

If filename doesn't match patterns, analyze first 1000 chars:
- **RFI Response**: Contains "Question:", "Response:", "Answer:", section numbers
- **Briefing Deck**: Contains "Agenda", "Part One:", "Part Two:", slide markers
- **Welcome Pack**: Contains "Evaluation Criteria", "Key Metrics", "Assessment Framework"
- **Case Study**: Contains "Client:", "Challenge:", "Solution:", "Outcome:"

### 2.3 User Override (Tertiary, fallback)

If auto-detection uncertain, present **dropdown selector**:
```
Document type (auto-detected: rfi_response)
[ ] RFI Response (vendor answers)
[ ] Briefing Deck (presentation structure)
[ ] Welcome Pack (evaluation criteria)
[ ] Exemplar Submission (last year's submission)
[ ] Fact Source (case studies, metrics, whitepapers)
[ ] Secondary Context (reference material)
```

---

## 3. Azure Indexing & Metadata Storage

### 3.1 Indexed Metadata Schema

Each document chunk in Azure AI Search includes:

```json
{
  "chunk_id": "doc-001-chunk-01",
  "document_name": "IBM RFI Response 2026.docx",
  "document_type": "rfi_response",
  "document_priority": "CRITICAL",
  "source_category": "fact_sources",
  "upload_date": "2026-01-16",
  "version": "final",
  "is_primary_content": true,
  "content": "...",
  "embedding": [...],
  "metadata_tags": ["rfi_response", "fact_source", "primary_content"],
  "retrieval_weight": 1.5
}
```

### 3.2 Retrieval Strategy

When agents query Azure Search:

```javascript
// Example: dataExtractionAgent retrieving facts
searchDocuments(query, topK = 25, filters = {})
  
  // Apply filters by priority
  const filters = {
    prioritize: ["rfi_response", "fact_source"],    // Weight these higher
    optional: ["secondary_context", "exemplar"],     // Include but lower priority
    exclude: ["briefing_deck", "welcome_pack"]       // Use for structure only
  };
  
  // Results include provenance
  // "IBM deployed this in 50+ countries [From: rfi_response]"
  // "Their success story: [From: fact_source - case studies]"
```

---

## 4. Validation Checklist (Pre-Generation)

Before launching the agent pipeline, users must confirm:

```
PROJECT SETUP VALIDATION
═══════════════════════════════════════

PRIMARY SIGNPOSTS (Required)
☐ Briefing Deck uploaded (structure constraint)
  └─ Version date: _______________
  
☐ Welcome Pack uploaded (evaluation criteria)
  └─ Version date: _______________
  
☐ Last Year's Submission uploaded (optional but recommended)
  └─ Version date: _______________

FACT SOURCES (Required)
☐ RFI Response uploaded (primary content)
  └─ Version date: _______________
  └─ Status: [ ] Draft  [ ] Final
  
☐ Supporting documents uploaded (fact sources folder)
  └─ Document count: ___
  └─ Categories: [checklist of types]

STRATEGIC CONTEXT (Required)
☐ Strategic context completed
  └─ Key messages defined: [ ] Yes
  └─ Positioning focus areas selected: [ ] Yes
  └─ Tone guidance specified: [ ] Yes

METADATA & INDEXING (Automatic)
☐ All documents indexed in Azure
  └─ RFI Response: indexed as CRITICAL
  └─ Fact sources: indexed with metadata
  └─ Signposts: indexed for constraint retrieval

VERSION CONTROL
☐ All documents are current versions
  └─ RFI Response is FINAL (not draft)
  └─ Briefing deck matches current event
  └─ Welcome pack is current guidelines

───────────────────────────────────────
[ ] I CONFIRM all items above are complete
   
[ GENERATE BRIEFING DECK ] or [ BACK TO SETUP ]
```

---

## 5. Implementation Flow

### 5.1 Upload & Metadata Assignment

```
User uploads document
         ↓
System analyzes filename & content
         ↓
Auto-detect metadata (confidence: high/medium/low)
         ↓
IF high confidence: Accept auto-detection
IF medium/low: Present override dropdown
         ↓
Tag document with metadata_type
         ↓
Index in Azure AI Search with metadata schema
         ↓
Add to project inventory (visible in checklist)
```

### 5.2 Strategic Context Entry

```
User fills "Strategic Context" text box:
  - Key messages (free text)
  - Positioning focus areas (checkboxes)
  - Tone guidance (selection)
  - Taboo topics (free text)
         ↓
System stores as `strategic_context` document
         ↓
Index as metadata (not full-text searchable, reference only)
         ↓
Make available to agents as context injection
```

### 5.3 Pre-Generation Validation

```
User clicks "GENERATE BRIEFING DECK"
         ↓
System checks validation checklist
         ↓
IF all items checked: Proceed to generation
IF items missing: Show specific errors, prevent generation
         ↓
Launch agent pipeline (with metadata-aware retrieval)
```

---

## 6. Agent Integration: Using Metadata

### 6.1 Data Extraction Agent

```javascript
// Input includes metadata filters
const extractionInput = {
  searchResults: retrieveWithMetadata({
    required_types: ["rfi_response"],
    optional_types: ["fact_source"],
    exclude_types: ["briefing_deck", "welcome_pack"],
    min_priority: "HIGH"
  }),
  context: {
    sectionName: "Part One: Vision and Execution",
    // ... other context
  }
};

// Output includes provenance
const facts = {
  scale: [
    {
      metric: "consultants",
      value: 160000,
      source: "rfi_response",  // ← provenance tag
      source_document: "IBM RFI Response 2026.docx"
    }
  ]
};
```

### 6.2 Content Synthesis Agent

```javascript
// Uses strategic context as injection
const synthesisInput = {
  slidePlan: {...},
  facts: {...},
  referenceExamples: deck2024Examples,
  strategic_context: {
    key_messages: ["Message 1", "Message 2", ...],
    positioning_focus: ["scale", "innovation", "partnerships"],
    tone: "professional",
    constraints: ["avoid mentioning Y competitor"]
  },
  narrative: {...}
};

// Agent respects constraints in content generation
// "Emphasize: scale, innovation, partnerships"
// "Tone: professional"
// "Avoid: Y competitor"
```

### 6.3 Quality Validation Agent

```javascript
// Validation includes source checking
const validation = {
  slideTitle: "Global Scale and Presence",
  overallPass: false,
  issues: [
    "Metric '160K consultants' [From: rfi_response] ✓ Valid source",
    "Statement 'extensive global capabilities' [No source] ✗ Unverified",
    "Partnership claim [From: fact_source] ✓ Supported by case study"
  ],
  score: 72.9
};
```

---

## 7. Benefits of This Model

| Aspect | Benefit |
|--------|---------|
| **Clarity** | Documents have clear roles; no ambiguity about what's constraint vs content |
| **Provenance** | Every claim in output traces back to source document type |
| **Quality Control** | Validation can verify claims against RFI source (not marketing material) |
| **Flexibility** | Auto-detection + override allows both simplicity and control |
| **Scalability** | Metadata schema works whether project has 5 docs or 50 |
| **Explainability** | Agents can explain "I used this metric from RFI response" not "I guessed" |
| **Compliance** | Audit trail: which documents were used, versions, dates |

---

## 8. Next Steps (Implementation)

- [ ] Implement metadata auto-detection in upload handler
- [ ] Add metadata override dropdown for low-confidence detections
- [ ] Create validation checklist UI component
- [ ] Add strategic context text box with structured sections
- [ ] Update Azure indexing schema to include metadata
- [ ] Modify agent input interfaces to accept metadata filters
- [ ] Update data extraction agent to tag claims with provenance
- [ ] Add source citations to generated slides
- [ ] Test end-to-end with sample project

---

## Document Version History

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2026-01-16 | 1.0 | Draft | Initial design document |

