# Dynamic Evaluation Criteria - Quick Reference

## Overview

The RFI-Helper system supports **multiple analyst frameworks** with dynamic evaluation criteria:
- **Gartner Magic Quadrant** (10 dimensions)
- **Forrester Wave** (10 dimensions)  
- **IDC MarketScape** (10 dimensions)

Evaluation criteria are **NOT hardcoded** - they load dynamically based on the analyst firm parameter.

---

## For Developers

### Using Evaluation Criteria in Code

```javascript
// 1. Import the helper function
import { getFrameworkCriteria } from './services/analystEvaluatorService.js';

// 2. Load criteria for your analyst firm
const criteria = getFrameworkCriteria('Gartner');  // or 'Forrester', 'IDC'

// 3. Access framework details
console.log(criteria.framework);  
// → "Gartner Magic Quadrant for Cloud ERP Services"

console.log(criteria.dimensions.length);  
// → 10

// 4. Build dimension list for prompts
const criteriaList = criteria.dimensions
  .map((d, idx) => `${idx + 1}. ${d.name} - ${d.description}`)
  .join('\n');

// 5. Use in AI prompts
const systemPrompt = `You are evaluating for ${criteria.framework}.
Evaluation Dimensions:
${criteriaList}`;
```

### Criteria Object Structure

```javascript
{
  framework: "Gartner Magic Quadrant for Cloud ERP Services",
  dimensions: [
    {
      name: "Direct Answer Check",
      description: "Does the response explicitly and completely answer the analyst question?",
      evaluationFocus: "Completeness, clarity, relevance"
    },
    {
      name: "Ability to Execute - Products/Services",
      description: "Clear articulation of Cloud ERP services delivery",
      evaluationFocus: "Service scope, delivery methodology, technical scope"
    },
    // ... 8 more dimensions
  ]
}
```

### Adding a New Analyst Framework

1. **Edit** `server/services/analystEvaluatorService.js`
2. **Find** the `getFrameworkCriteria()` function (around line 173)
3. **Add** your new framework to the `criteria` object:

```javascript
'NewAnalyst': {
  framework: 'NewAnalyst Evaluation Framework',
  dimensions: [
    {
      name: 'Dimension 1',
      description: 'What this dimension evaluates',
      evaluationFocus: 'Key focus areas'
    },
    // ... more dimensions
  ]
}
```

4. **Test** with `node server/test-evaluation-criteria.js`

---

## For Users

### Selecting Analyst Framework

**Briefing Deck Generator**:
- The analyst firm is selected when generating a briefing deck
- System automatically loads the correct evaluation criteria
- Content is optimized for that analyst's scoring dimensions

**Answer Analyzer**:
- Choose Gartner, Forrester, or IDC when analyzing responses
- Each framework has different scoring dimensions
- Results show how well your answer addresses each dimension

### Understanding Evaluation Dimensions

**Gartner Magic Quadrant** focuses on:
- **Ability to Execute** (Products, Operations, Sales)
- **Completeness of Vision** (Market, Strategy, Innovation)
- **Evidence Quality** (Metrics, references, case studies)
- **Risk & Governance**
- **Differentiation & Credibility**

**Forrester Wave** focuses on:
- **Current Offering** (What you deliver today)
- **Strategy** (Market positioning, customer focus)
- **Market Presence** (Growth, customer base)
- **Business Outcomes** (ROI, TCO, value delivered)
- **Customer Experience & Support**

**IDC MarketScape** focuses on:
- **Market Presence** (Revenue, customers, geographic reach)
- **Product Capabilities** (Features, maturity, integration)
- **Viability** (Financial strength, sustainability)
- **Vertical/Geographic Coverage**
- **Innovation & Roadmap**

### Why This Matters

Different analysts score responses differently:
- **Gartner** emphasizes execution capability + vision balance
- **Forrester** emphasizes customer outcomes + business value
- **IDC** emphasizes market presence + vertical expertise

Your content should be optimized for the specific analyst evaluating you.

---

## API Examples

### Briefing Deck Generation

```javascript
POST /api/presentations/generate-briefing-deck
Content-Type: application/json

{
  "briefingPack": "...",
  "briefingInstructions": "...",
  "vendorResponse": "...",
  "model": "global/gpt-4o"
}

// The system determines analyst firm from briefing instructions
// Automatically loads correct evaluation criteria
// Generates content optimized for that framework
```

### Response Evaluation

```javascript
POST /api/rfi/analyze-score
Content-Type: application/json

{
  "analystQuestion": "Describe your Cloud ERP delivery methodology",
  "vendorResponse": "IBM uses a phased approach...",
  "analyst": "Gartner",  // ← Determines which criteria to use
  "aiModel": "global/gpt-4o"
}

// Returns scores across Gartner's 10 dimensions
```

---

## Testing

### Test All Frameworks

```bash
node server/test-evaluation-criteria.js
```

**Expected Output**:
```
📊 Gartner Evaluation Framework - 10 dimensions ✅
📊 Forrester Evaluation Framework - 10 dimensions ✅
📊 IDC Evaluation Framework - 10 dimensions ✅
```

### Test Briefing Generation

```bash
node server/test-multipass-simple.js
```

**Check for**:
- `mqDimensions` field in slide objects
- `evaluationDimension` field in Q&A items
- Criteria-specific terminology in narratives

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  analystEvaluatorService.js                     │
│  ┌───────────────────────────────────────────┐  │
│  │ getFrameworkCriteria(analystFirm)         │  │
│  │                                            │  │
│  │ Returns:                                   │  │
│  │  {                                         │  │
│  │    framework: "Gartner MQ",               │  │
│  │    dimensions: [                          │  │
│  │      { name, description, focus }         │  │
│  │    ]                                       │  │
│  │  }                                         │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  SINGLE SOURCE OF TRUTH                         │
└───────────────┬────────────────────────────────┘
                │
        ┌───────┴────────┬──────────────┐
        │                │              │
        ▼                ▼              ▼
┌───────────────┐ ┌──────────────┐ ┌─────────────┐
│ briefingDeck  │ │ scoreAnalyzer│ │ answerGen   │
│ Service       │ │ Service      │ │ Service     │
│               │ │              │ │ (future)    │
│ Uses criteria │ │ Uses criteria│ │ Uses hints  │
│ for content   │ │ for scoring  │ │ for writing │
└───────────────┘ └──────────────┘ └─────────────┘
```

---

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `server/services/analystEvaluatorService.js` | **SOURCE OF TRUTH** - Defines all analyst frameworks | 396 |
| `server/services/briefingDeckService.js` | Uses criteria for briefing generation | 917 |
| `server/test-evaluation-criteria.js` | Tests all frameworks load correctly | 43 |
| `docs/DYNAMIC-EVALUATION-CRITERIA.md` | This documentation | - |

---

## Common Issues

### "Cannot find module 'analystEvaluatorService'"

**Cause**: Import path incorrect or function not exported

**Fix**:
```javascript
// Correct import
import { getFrameworkCriteria } from './analystEvaluatorService.js';

// Correct export (in analystEvaluatorService.js)
export { getFrameworkCriteria };
```

### "criteria is undefined"

**Cause**: Invalid analyst firm name or typo

**Fix**:
```javascript
// Valid names
'Gartner', 'Forrester', 'IDC'

// Returns default criteria if name not found
const criteria = getFrameworkCriteria('UnknownAnalyst');
// → Returns 'default' criteria with generic dimensions
```

### "dimensions is not iterable"

**Cause**: Criteria object structure incorrect

**Fix**: Always check structure matches expected format:
```javascript
const criteria = getFrameworkCriteria(analyst);
console.log(criteria.framework);  // Should be a string
console.log(Array.isArray(criteria.dimensions));  // Should be true
```

---

## Version History

- **2026-01-14**: Initial implementation - dynamic criteria for Gartner/Forrester/IDC
- **Future**: Project-level analyst firm selection

---

**Last Updated**: January 14, 2026  
**Maintainer**: GitHub Copilot / Richard Hogan
