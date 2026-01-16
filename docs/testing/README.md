# Testing Documentation

**Purpose**: Ensure code quality and prevent AI hallucination in generated content  
**Last Updated**: January 14, 2026

---

## Quick Start

### Before Committing Code

Run the pre-commit test suite:

```powershell
.\scripts\test-before-commit.ps1
```

This script will:
1. Check backend syntax
2. Run unit tests
3. Restart servers
4. Prompt for manual UI verification
5. Open E2E test checklist

**Pass Criteria**: All automated tests pass + E2E checklist complete + zero hallucinations found

---

## Documentation Files

### [TESTING-STRATEGY.md](./TESTING-STRATEGY.md)
**What**: Overall testing philosophy and approach  
**When to read**: Understanding the three-level testing model  
**Key sections**:
- Testing levels (backend, API, E2E)
- Pre-commit protocol
- Content validation guidelines
- Known testing gaps

### [E2E-TEST-CHECKLIST.md](./E2E-TEST-CHECKLIST.md)
**What**: Step-by-step manual UI verification checklist  
**When to use**: Before every commit affecting AI features  
**Duration**: 5-10 minutes  
**Key sections**:
- Document selection
- Deck generation
- Structure verification
- Content accuracy spot-checks

### [CONTENT-VALIDATION.md](./CONTENT-VALIDATION.md)
**What**: Guidelines for detecting AI hallucinations  
**When to use**: Validating any AI-generated content  
**Key sections**:
- Red flags (generic rules, unattributed metrics, company names)
- Validation process (4 steps)
- Anti-hallucination prompt patterns
- Spot-check protocol

---

## Test Scripts

### Backend Unit Tests
**Location**: `server/test-multipass-simple.js`  
**Run**: `node server/test-multipass-simple.js` (from server directory)  
**Purpose**: Verify backend functions work in isolation  
**Output**: JSON file with generated deck structure

### Pre-Commit Test Suite
**Location**: `scripts/test-before-commit.ps1`  
**Run**: `.\scripts\test-before-commit.ps1` (from project root)  
**Purpose**: Complete test automation with manual UI verification  
**Duration**: 5-10 minutes  
**Exit codes**: 0 = pass, 1 = fail

---

## Testing Levels Explained

### Level 1: Backend Unit Tests
**What it proves**: Functions execute without errors  
**What it doesn't prove**: UI works, content is accurate, user workflow succeeds  
**Pass criteria**: No errors, valid JSON, expected properties exist

### Level 2: API Integration Tests
**What it proves**: Endpoints respond correctly  
**What it doesn't prove**: Frontend renders correctly, content is accurate  
**Status**: Not yet implemented (manual testing via UI currently)

### Level 3: End-to-End UI Tests
**What it proves**: Complete user workflow works, content is accurate  
**What it doesn't prove**: Edge cases, performance under load  
**Pass criteria**: All checklist items + zero hallucinations

---

## When to Test What

### After Changing AI Prompts
- ✅ Run backend unit test
- ✅ Run E2E checklist
- ✅ **Validate content accuracy** (spot-check against source docs)
- ❌ Backend unit test alone is NOT sufficient

### After Changing Frontend UI
- ✅ Restart servers
- ✅ Run E2E checklist
- ✅ Verify all fields display
- ❌ Visual inspection alone is NOT sufficient (check console for errors)

### After Changing Backend Logic
- ✅ Run backend unit test
- ✅ Restart servers
- ✅ Run E2E checklist
- ❌ Backend unit test alone is NOT sufficient

### Before ANY Commit
- ✅ Run pre-commit test suite
- ✅ Complete E2E checklist
- ✅ Update session notes with results
- ❌ Do NOT commit on failed tests

---

## Common Testing Mistakes

### Mistake 1: "Backend test passed, it works!"
**Problem**: Backend unit tests don't verify UI integration or content accuracy  
**Fix**: Always run E2E checklist

### Mistake 2: "UI looks good, ship it!"
**Problem**: Visual inspection doesn't catch hallucinations or missing fields  
**Fix**: Complete full E2E checklist with spot-checks

### Mistake 3: "It worked before, small change won't break it"
**Problem**: Small changes can have cascading effects  
**Fix**: Run full test suite even for "small" changes

### Mistake 4: "I'll test it later"
**Problem**: Accumulating untested changes makes debugging harder  
**Fix**: Test immediately after making changes

### Mistake 5: "The AI is smart, it won't hallucinate"
**Problem**: AI systems hallucinate plausible-sounding content  
**Fix**: Always validate against source documents

---

## Incident History

### January 14, 2026: Compliance Flag Hallucination

**What happened**: Multi-pass implementation appeared to work (backend test passed, UI displayed slides), but AI was hallucinating compliance flags.

**Root cause**: Testing focused on structural correctness, not content accuracy.

**Detection**: Took 4 attempts to identify because validation was insufficient.

**Fix**: 
- Updated prompts with anti-hallucination instructions
- Created content validation guidelines
- Added spot-check requirements to E2E checklist
- Made E2E testing mandatory before commits

**Lesson**: Never trust AI output without validating against source documents.

---

## Future Improvements

### Planned Test Automation
- [ ] Automated E2E tests with Playwright
- [ ] Content validation regex patterns
- [ ] Document diff checker (source vs generated)
- [ ] Hallucination detection heuristics
- [ ] Performance benchmarks
- [ ] Cross-browser testing

### Planned Documentation
- [ ] API integration test guide
- [ ] Performance testing guide
- [ ] Load testing guide
- [ ] Security testing checklist

---

## Questions?

**Where do I start?**  
Read TESTING-STRATEGY.md to understand the overall approach.

**What's the minimum I need to do before committing?**  
Run `.\scripts\test-before-commit.ps1` and complete the E2E checklist.

**How do I know if AI is hallucinating?**  
Read CONTENT-VALIDATION.md for red flags and validation process.

**Can I skip manual testing?**  
No. Until we have automated E2E tests, manual UI verification is mandatory.

**Why do we need three levels of testing?**  
Backend tests prove functions work, API tests prove endpoints work, E2E tests prove the user experience works. All three are needed.
