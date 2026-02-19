# Document Retrieval Strategy for Briefing Deck Generation

## Document Type Roles

This document defines how each document type should be used during briefing deck generation.

### RFI Response (PRIMARY SOURCE)
- **Role**: Primary source of content for all sections
- **Priority**: CRITICAL (always used first)
- **Usage**: Main response content, compliance criteria, differentiation stories
- **All Sections**: 1, 2, 3, 4

### Fact Source (SECONDARY FACT SOURCE)
- **Role**: Avoid duplication or add extra data
- **Priority**: HIGH
- **Usage**: Section 1 ONLY (Part One: Vision and Execution)
- **Why Section 1**: To support leadership positioning, add market context, provide supporting data
- **Restriction**: Should NOT be used for other sections to avoid diluting RFI response content

### Welcome Pack (EVALUATION CRITERIA REFERENCE)
- **Role**: Contains evaluation criteria context
- **Priority**: HIGH
- **Usage**: Metadata reference only during parsing (for understanding MQ criteria structure)
- **Impact on Content**: Influences which topics are extracted from RFI response
- **Used For**: Context about what Gartner is evaluating, not source content

### Briefing Deck (RESPONSE STRUCTURE)
- **Role**: Defines response structure, section timings, slide constraints
- **Priority**: HIGH
- **Usage**: Structural guidance only (parsed at start)
- **Used For**: Section names, timing information, slide limits

### Secondary Context (EVALUATION/REFERENCE)
- **Role**: Additional information for evaluation purposes
- **Priority**: LOW
- **Usage**: IBM planning decks, additional analyst content, reference material
- **Usage Pattern**: Referenced when RFI response lacks specific detail
- **Fallback**: Used only if primary sources don't provide required content

### Exemplar Submission (PREVIOUS EXAMPLES)
- **Role**: Previous submission or alternate analyst submission examples
- **Priority**: MEDIUM
- **Usage**: Generic IBM content or similar answer patterns
- **Conditions**:
  - "About IBM" type content where unique differentiation isn't needed
  - Answer patterns from previous successful submissions
  - Structure/style reference (few-shot learning)
- **Restriction**: Should NOT override RFI response differentiation content

## Retrieval Weight Mapping

| Document Type | Retrieval Weight | Purpose |
|---|---|---|
| rfi_response | 1.5 | Highest priority, primary content source |
| fact_source | 1.2 | High priority, section 1 supplemental |
| briefing_deck | 1.0 | Structural reference |
| welcome_pack | 1.0 | Evaluation criteria context |
| exemplar_submission | 1.0 | Style/pattern reference |
| secondary_context | 0.8 | Fallback additional information |
| unknown | 0.5 | Lowest priority |

## Implementation in Azure Search Filters

When retrieving content for each section:

1. **Always include**: `rfi_response` (weight: 1.5)
2. **Section 1 only**: `fact_source` (weight: 1.2)
3. **If RFI insufficient**: Add `exemplar_submission` (weight: 1.0)
4. **If still insufficient**: Add `secondary_context` (weight: 0.8)

## Search Filter Examples

### Section 1: Vision and Execution
```
documentType eq 'rfi_response' OR (documentType eq 'fact_source')
```

### Sections 2, 3, 4
```
documentType eq 'rfi_response'
```

### Fallback (if no results)
```
documentType eq 'rfi_response' OR documentType eq 'exemplar_submission'
```

## Content Generation Hierarchy

1. **Parse Structure** from Briefing Deck (timings, constraints)
2. **Extract Criteria Context** from Welcome Pack (MQ/CC evaluation dimensions)
3. **Generate Section Content** using this priority:
   - Primary: RFI Response (all sections)
   - Supplement (Section 1): Fact Source
   - Reference (if needed): Exemplar Submission, Secondary Context
   
## Never Do

- ❌ Use Fact Source for sections 2, 3, 4
- ❌ Override RFI response differentiation with exemplar content
- ❌ Weight secondary context equal to primary sources
- ❌ Mix document types equally without priority weighting

---

**Last Updated**: January 22, 2026
**Status**: Defining strategy for implementation
