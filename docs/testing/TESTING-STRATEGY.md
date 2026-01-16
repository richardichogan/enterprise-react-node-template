# Testing Strategy for RFI-Helper

**Last Updated**: January 14, 2026

---

## Testing Philosophy

**CRITICAL**: AI-generated content must be validated for accuracy, not just structural correctness.

### Core Principles

1. **Never Trust AI Output Without Verification**
   - AI systems hallucinate plausible-sounding content
   - Structural correctness ≠ Content accuracy
   - Always spot-check against source documents

2. **Test End-to-End, Not Just Components**
   - Backend unit tests prove functions work
   - UI integration tests prove the user experience works
   - Both are required

3. **Document What Was NOT Tested**
   - Be honest about testing gaps
   - Known risks should be explicit
   - "Works" means "tested and verified", not "didn't crash"

---

## Test Levels

### Level 1: Backend Unit Tests

**Purpose**: Verify service functions work in isolation

**Location**: `server/test-*.js`

**Run**: `node server/test-multipass-simple.js`

**What It Tests**:
- ✅ Functions execute without errors
- ✅ JSON structure is valid
- ✅ Expected properties exist

**What It DOESN'T Test**:
- ❌ UI integration
- ❌ Content accuracy (hallucinations)
- ❌ Real document handling
- ❌ User workflows

**Pass Criteria**:
- No errors thrown
- Valid JSON output
- Expected property counts match

---

### Level 2: API Integration Tests

**Purpose**: Verify backend API endpoints work

**Location**: `server/test-api-integration.js`

**What It Tests**:
- ✅ API endpoints respond
- ✅ Request/response contracts
- ✅ Error handling
- ✅ Document upload/download

**What It DOESN'T Test**:
- ❌ Frontend UI
- ❌ Content accuracy
- ❌ User experience

**Pass Criteria**:
- 200 OK responses
- Valid response schemas
- Proper error codes

---

### Level 3: End-to-End UI Tests

**Purpose**: Verify the complete user workflow

**Location**: `docs/testing/E2E-TEST-CHECKLIST.md`

**What It Tests**:
- ✅ Full user workflow in browser
- ✅ All UI fields display correctly
- ✅ Real documents are processed
- ✅ Content accuracy spot-checks

**What It DOESN'T Test**:
- ❌ Edge cases (covered by unit tests)
- ❌ Performance under load

**Pass Criteria**:
- ALL checklist items verified
- No hallucinations found in spot-checks
- User can complete workflow successfully

---

## Pre-Commit Testing Protocol

**MANDATORY before any commit that changes backend logic or AI prompts**

### Quick Check (< 2 minutes)

```powershell
# 1. Backend syntax check
cd server
node --check index.js
node --check services/briefingDeckService.js

# 2. Unit test
node test-multipass-simple.js

# 3. Restart servers
cd ..
.\scripts\server-manager.ps1 restart
```

### Full Verification (5-10 minutes)

```powershell
# Run quick check first, then:
.\scripts\test-before-commit.ps1
```

This script will:
1. Run backend unit tests
2. Restart servers
3. Prompt for manual UI verification
4. Run hallucination spot-checks

---

## Content Validation Guidelines

### Hallucination Detection

**Red Flags**:
- Compliance rules that sound generic ("Do not include confidential information")
- Specific metrics without source citations
- Company names not in source documents
- Technical capabilities not mentioned in vendor response
- Dates/timelines without evidence

**Validation Process**:
1. Identify suspicious content
2. Search source documents for exact phrase
3. If not found, flag as hallucination
4. Update prompts to prevent recurrence

### Spot-Check Protocol

For any AI-generated deck, manually verify:
- [ ] 3 random slide titles exist in briefing pack
- [ ] 2 compliance flags exist in source docs
- [ ] 1 Q&A answer quotes from vendor response
- [ ] No generic/made-up company names
- [ ] No invented metrics or capabilities

---

## Test Automation Opportunities

**Future Improvements**:
1. Automated E2E tests with Playwright/Cypress
2. Content validation regex patterns
3. Document diff checker (source vs generated)
4. Hallucination detection heuristics
5. Performance benchmarks

---

## Known Testing Gaps

**Current Limitations** (as of January 14, 2026):
- ❌ No automated E2E tests
- ❌ No performance testing
- ❌ No load testing
- ❌ No automated hallucination detection
- ❌ No cross-browser testing
- ❌ Manual UI verification required

**Mitigation**:
- Mandatory manual E2E checklist before commits
- Documented spot-check process
- Session notes track discovered issues

---

## Lesson Learned: January 14, 2026

**Incident**: Multi-pass implementation appeared to work but:
- Backend unit test passed ✅
- UI displayed slides ✅
- BUT: AI was hallucinating compliance flags ❌
- Took 4 attempts to identify the problem

**Root Cause**: Tested structural correctness, not content accuracy

**Fix**: 
- Updated prompts to prevent hallucination
- Added content validation to test checklist
- Documented this testing gap

**Prevention**:
- Always spot-check AI output against source
- Never trust "it works" without verifying content
- Test end-to-end, not just components
