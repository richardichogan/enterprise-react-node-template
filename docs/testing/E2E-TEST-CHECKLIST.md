# End-to-End Test Checklist: Briefing Deck Generator

**Test Type**: Manual UI Verification  
**Duration**: ~5 minutes  
**Run Before**: Any commit affecting briefing deck generation

---

## Prerequisites

- [ ] Backend servers running (`.\scripts\server-manager.ps1 status`)
- [ ] Frontend accessible at http://localhost:3000
- [ ] At least 2 test documents uploaded (Briefing Pack + Instructions)

---

## Test Steps

### 1. Document Selection

- [ ] Open http://localhost:3000 in browser
- [ ] Navigate to "Briefing Deck Generator" tab
- [ ] Select **Briefing Structure Document** from dropdown
- [ ] Select **Supporting Analyst Information** from dropdown
- [ ] Leave **IBM RFI Response** empty (strawman mode)
- [ ] Leave **IBM Supporting Materials** empty

**Expected**: All dropdowns populate with uploaded documents

---

### 2. Deck Generation

- [ ] Click "Generate Briefing Deck" button
- [ ] Wait for generation progress (console logs in DevTools)
- [ ] Verify "Generation complete" message appears

**Expected**: 
- Loading indicator shows during generation
- Success message appears
- Slide count displayed (e.g., "Slides (21)")

---

### 3. Structure Verification

- [ ] Verify **Extracted Structure** section displays
- [ ] Check that sections match briefing pack (Part One, Part Two, etc.)
- [ ] Verify timings show (e.g., "15 minutes", "45 minutes")
- [ ] Verify slide count per section displayed

**Expected**:
- All sections from briefing pack appear
- Timings and slide limits match source document

---

### 4. Slide Content Verification

For **first 3 slides**, verify each has:

#### Slide Header
- [ ] Slide number (e.g., "Slide 1")
- [ ] Slide title (e.g., "Executive Summary")
- [ ] Compliance badge if applicable (orange "⚠️ N compliance flags")

#### Slide Body
- [ ] Purpose text in italics
- [ ] Content bullets (starting with "TBD:" for strawman mode)
- [ ] Evidence citations (what evidence is required)

#### Slide Footer
- [ ] Compliance Issues section (if flags > 0)
- [ ] Speaker Notes dropdown (collapsible)

**Expected**:
- All fields populated
- No empty sections
- TBD placeholders for strawman mode

---

### 5. Content Accuracy Spot-Check

**CRITICAL: Validate against source documents**

#### Spot-Check #1: Slide Titles
- [ ] Pick 3 random slides
- [ ] Open briefing pack document
- [ ] Search for exact slide title
- [ ] Verify title exists in source

**Expected**: All slide titles found in briefing pack

#### Spot-Check #2: Compliance Flags
- [ ] Find any slide with compliance warning badge
- [ ] Read the compliance flag text
- [ ] Search briefing pack for that exact constraint
- [ ] Verify it's not hallucinated

**Expected**: 
- Compliance flags quote actual briefing pack constraints
- No generic made-up rules (e.g., "Do not include confidential information")

#### Spot-Check #3: Section Structure
- [ ] Count sections in output
- [ ] Count sections in briefing pack
- [ ] Verify they match

**Expected**: Section count and names match source document

---

### 6. Q&A Bank Verification

- [ ] Scroll to Q&A Bank section
- [ ] Verify questions are relevant to briefing topic
- [ ] Verify answers show "TBD - Awaiting vendor response" (strawman mode)

**Expected**:
- Multiple Q&A items (5-10)
- Questions relate to briefing evaluation criteria
- Answers marked as TBD

---

### 7. Gap Analysis Verification

- [ ] Locate Gap Analysis section
- [ ] Verify it shows total requirements count
- [ ] Verify gaps listed (strawman mode: all content is gap)

**Expected**:
- Total requirements = slide count
- Gap status: "All content requirements pending vendor response"

---

### 8. Traceability Matrix Verification

- [ ] Locate Traceability Matrix table
- [ ] Verify each slide row has:
  - Slide number
  - Slide title
  - Briefing pack requirement
  - Mapping status: "Awaiting vendor response"

**Expected**:
- One row per slide
- All columns populated
- Status shows "Awaiting vendor response"

---

## Pass Criteria

✅ **PASS** if:
- All checkboxes completed
- No hallucinations found in spot-checks
- All slide fields display correctly
- Structure matches source documents

❌ **FAIL** if:
- Any content is hallucinated
- Missing fields in UI
- Structure doesn't match briefing pack
- Errors during generation

---

## Failure Actions

If test fails:

1. **Document the failure** in session notes
2. **Identify root cause**:
   - Backend prompt issue?
   - Frontend rendering issue?
   - Data transformation issue?
3. **Fix and re-test** complete checklist
4. **Do NOT commit** until passing

---

## Test Evidence

**Checklist Completed By**: _____________  
**Date**: _____________  
**Test Result**: ☐ PASS  ☐ FAIL  
**Issues Found**: _____________________________________________  
**Session Notes Updated**: ☐ Yes  ☐ No

---

## Maintenance

Update this checklist when:
- New fields added to slide structure
- New sections added to output
- UI layout changes
- Validation requirements change
