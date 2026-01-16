# Content Validation Guidelines

**Purpose**: Prevent AI hallucination in generated briefing decks  
**Last Updated**: January 14, 2026

---

## What is Hallucination?

**Definition**: AI-generated content that is plausible-sounding but not present in source documents.

**Examples**:
- ❌ Compliance rule: "Do not include confidential information" (not in briefing pack)
- ❌ Company name: "Acme Corp case study" (not in vendor response)
- ❌ Metric: "25% cost reduction" (no citation provided)
- ❌ Capability: "AI-powered fraud detection" (not mentioned in response)

---

## Red Flags: High-Risk Content

### 1. Generic Compliance Rules

**Warning Signs**:
- Sounds like generic best practice
- Could apply to any briefing
- Not specific to analyst firm or engagement

**Examples**:
- "Do not include confidential information"
- "Respect intellectual property"
- "Follow data privacy guidelines"
- "Obtain customer consent"

**Validation**: Search briefing pack for EXACT phrase. If not found → hallucination.

---

### 2. Unattributed Metrics

**Warning Signs**:
- Specific percentages or numbers
- No source citation
- Sounds impressive but vague

**Examples**:
- "50% faster implementation"
- "99.9% uptime"
- "200+ clients served"
- "$5M in cost savings"

**Validation**: Metrics MUST have evidence citations. If no citation → hallucination or missing evidence.

---

### 3. Company/Product Names

**Warning Signs**:
- Specific company names in case studies
- Product names not in source documents
- Technology brands mentioned

**Examples**:
- "IBM Watson deployment at Acme Corp"
- "Using TensorFlow for ML models"
- "Integrated with Salesforce CRM"

**Validation**: Search vendor response for exact company/product name. If not found → hallucination.

---

### 4. Technical Capabilities

**Warning Signs**:
- Specific technical features
- Buzzword-heavy descriptions
- Advanced capabilities claimed

**Examples**:
- "Real-time anomaly detection"
- "Blockchain-based supply chain"
- "Quantum encryption"
- "Self-healing infrastructure"

**Validation**: Search vendor response for capability description. If not found → hallucination.

---

## Validation Process

### Step 1: Identify Suspicious Content

Review generated output for red flags:
- [ ] Compliance flags
- [ ] Metrics without citations
- [ ] Company names
- [ ] Technical capabilities
- [ ] Specific dates/timelines

---

### Step 2: Source Document Search

For each suspicious item:

1. **Open source document** (briefing pack, vendor response, or instructions)
2. **Search for exact phrase** (Ctrl+F)
3. **Check surrounding context** (is meaning preserved?)
4. **Document result**:
   - ✅ Found: Mark as validated
   - ❌ Not found: Mark as hallucination
   - ⚠️ Similar but different: Investigate further

---

### Step 3: Root Cause Analysis

If hallucination found:

1. **Check AI prompt**: Is example too generic?
2. **Check token limits**: Is context being truncated?
3. **Check instructions**: Are we asking AI to infer?

Example:
```
❌ Bad: "complianceFlags": ["Constraint from briefing pack"]
✅ Good: "complianceFlags": []  // Only populate if explicitly stated
```

---

### Step 4: Fix and Re-test

1. **Update prompt** with anti-hallucination instructions
2. **Re-generate output**
3. **Re-validate** same content
4. **Document fix** in session notes

---

## Anti-Hallucination Prompt Patterns

### Pattern 1: Explicit Extraction Only

```
CRITICAL: ONLY include [field] if EXPLICITLY stated in documents.
Do NOT make up, infer, or assume [field] values.
If not found, return empty array [] or "TBD".
```

### Pattern 2: Citation Required

```
Every metric MUST have a citation showing where it came from.
Format: "value": "X", "source": "Vendor response section 2.3"
If no citation available, use "TBD - Awaiting evidence"
```

### Pattern 3: Conservative Default

```
When in doubt, default to placeholder:
- Compliance flags: [] (empty)
- Metrics: "TBD - Requires evidence"
- Evidence: "To be provided by vendor"
```

---

## Spot-Check Protocol

**Frequency**: Every generation, before claiming "it works"

**Sample Size**: 
- 3 random slide titles → verify in briefing pack
- 2 compliance flags → verify in briefing pack
- 1 Q&A answer → verify in vendor response
- All company names → verify in vendor response

**Time Required**: 2-3 minutes

**Pass Criteria**: 100% of spot-checks validated (zero hallucinations)

---

## Common Hallucination Sources

### Source 1: Generic Training Data

AI knows "common" compliance rules from training data:
- Privacy policies
- Confidentiality agreements  
- IP protection

**Mitigation**: Explicit "only from source docs" instruction

---

### Source 2: Overfitting Examples

Prompt examples become templates:
```
Bad Example: "complianceFlags": ["Do not use client logos"]
AI copies this for all outputs
```

**Mitigation**: Use neutral placeholder in examples

---

### Source 3: Gap Filling

AI tries to be helpful when content is missing:
- No compliance rules in doc → invents reasonable ones
- No metrics → makes up plausible percentages
- No company names → fabricates "Example Corp"

**Mitigation**: Explicit "TBD" instruction when content missing

---

## Validation Tools

### Manual Tools

1. **Document search** (Ctrl+F in PDF/Word)
2. **Text comparison** (diff source vs generated)
3. **Citation audit** (trace every claim to source)

### Future Automated Tools

1. **Exact phrase matcher**: Flag content not in source docs
2. **Citation validator**: Verify all citations exist
3. **Entity recognizer**: Flag unknown company/product names
4. **Metric detector**: Require citations for all numbers

---

## Incident Log

### January 14, 2026: Compliance Flag Hallucination

**Issue**: AI generated "Do not include confidential information" compliance flag

**Root Cause**: 
- Prompt example: `"complianceFlags": ["Constraint from briefing pack"]`
- AI interpreted this as "generate reasonable compliance rule"

**Fix**:
- Changed example to: `"complianceFlags": []`
- Added instruction: "ONLY include if EXPLICITLY stated in documents"

**Prevention**:
- Updated all prompt examples to use conservative defaults
- Added anti-hallucination instructions to system prompt
- Documented in content validation guidelines

---

## Checklist Summary

Before claiming content is valid:

- [ ] Spot-checked 3 slide titles against briefing pack
- [ ] Spot-checked 2 compliance flags against briefing pack
- [ ] Spot-checked 1 Q&A answer against vendor response
- [ ] All metrics have citations or marked "TBD"
- [ ] All company names verified in source documents
- [ ] No generic/plausible-sounding hallucinations
- [ ] Session notes updated with validation results
