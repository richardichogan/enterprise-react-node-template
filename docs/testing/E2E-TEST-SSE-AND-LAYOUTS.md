# E2E Testing Guide: SSE Progress + Slide Layouts

## Quick Test Workflow

### Prerequisites
- ✅ Frontend running on http://localhost:3000
- ✅ Backend running on http://localhost:3001
- ✅ IBM template exists at server/templates/ibm-template.potx

---

## Test 1: Verify SSE Stream is Working

### Steps
1. Open browser DevTools (F12)
2. Go to Console tab
3. Navigate to http://localhost:3000/dashboard
4. Open the Briefing Deck Generator section
5. Upload a test briefing pack (or create minimal test file)
6. Watch the console as generation starts

### Expected Output
```
[Step 1/4] Parsing briefing pack structure...
[Step 1/4] ✅ Extracted 4 sections with 45 slides
[Step 2/4] Generating slides for each section...
[Step 2/4] Generated 6 slides for "Part One" (1/4)
[Step 2/4] Generated 5 slides for "Part Two" (2/4)
[Step 2/4] Generated 4 slides for "Part Three" (3/4)
[Step 2/4] Generated 3 slides for "Part Four" (4/4)
[Step 3/4] ✅ Generated 10 Q&A items
[Step 4/4] ✅ Multi-pass generation complete (18 slides, 10 Q&A items)
Generation complete! Deck ready for PowerPoint creation.
```

### Pass Criteria
- ✅ All 4 progress steps appear in console
- ✅ No errors in console
- ✅ Status bar updates in real-time (blue → green)
- ✅ Generation completes successfully

---

## Test 2: Verify Layout Detection is Working

### Steps
1. After generation completes, download the PowerPoint file
2. Open it in PowerPoint or LibreOffice Impress
3. Inspect slides for layout variety

### Expected Slide Layouts

**Slide 1 (Title Layout)**
- Font size: 44pt
- Text: CENTERED
- Example: "Briefing Deck Title"
- Visual: Large, full-slide impact

**Slides with "Summary" in Title (Emphasis Layout)**
- Font size: 36pt
- Bold text
- Example: "Executive Summary"
- Visual: Strong emphasis on key points

**Slides with 4+ Bullets (Multiline Layout)**
- Title: 28pt
- Content: 12pt (small)
- Spacing: Tight (tighter than standard)
- Example: Slides with 5+ bullet points

**Standard Content Slides (Content Layout)**
- Title: 32pt
- Content: 14pt
- Spacing: Normal
- Example: Slides with 1-3 bullet points

### Pass Criteria
- ✅ First slide is noticeably larger (44pt title)
- ✅ Summary slides use emphasis layout (36pt)
- ✅ Dense slides (5+ bullets) use smaller font
- ✅ All slides have IBM blue accent bar at top
- ✅ All slides have slide numbers in footer
- ✅ Evidence citations are green boxes
- ✅ Compliance flags are orange boxes

---

## Test 3: Verify IBM Branding is Applied

### Steps
1. Open generated PowerPoint
2. Check visual styling

### Expected Branding Elements
- ✅ Blue accent bar at top of each slide (#002D9C)
- ✅ Professional typography (dark text on light background)
- ✅ IBM color palette throughout
- ✅ Consistent spacing and margins
- ✅ Evidence citations: Green box with E8F5E9 background
- ✅ Compliance flags: Orange box with FFF3E0 background

### Pass Criteria
- ✅ All slides have consistent IBM branding
- ✅ No generic/default styling visible
- ✅ Professional appearance suitable for executive presentation

---

## If Tests Fail

### SSE Stream Not Appearing
**Problem**: Console shows no progress messages
**Solution**:
1. Check browser DevTools Network tab
2. Look for POST request to `/api/presentations/generate-briefing-deck-stream`
3. Verify response headers show `Content-Type: text/event-stream`
4. Check server console for errors

### PowerPoint Doesn't Show Layout Variety
**Problem**: All slides use same layout
**Solution**:
1. Check server console for layout detection logs
2. Verify deck structure includes varied content (some slides with many bullets)
3. Manually test layout detection with different slide titles

### IBM Branding Not Applied
**Problem**: Slides look generic
**Solution**:
1. Verify template file exists: `server/templates/ibm-template.potx`
2. Check server console: "✅ Loaded IBM template" message
3. If missing, template falls back to default (check console logs)

### Errors in Console
**Problem**: JavaScript errors visible
**Solution**:
1. Check server logs (terminal running backend)
2. Look for JSON parsing errors in SSE stream
3. Verify endpoint returns valid JSON events

---

## Test Data Creation

If you need a test briefing pack, you can create a minimal test file:

### Minimal Test Briefing Pack (text file)
```
BRIEFING PACK

EXECUTIVE SUMMARY
- Key point 1
- Key point 2
- Key point 3

SECTION 1: OVERVIEW
Paragraph explaining background...
- Requirement 1
- Requirement 2
- Requirement 3
- Requirement 4
- Requirement 5

SECTION 2: TECHNICAL DETAILS
More content...
- Detail 1
- Detail 2
- Detail 3

SECTION 3: COMPLIANCE
Compliance information...
- Compliance item 1
- Compliance item 2
- Compliance item 3
```

---

## Success Indicators

### For SSE Stream
- [ ] All 4 progress steps complete
- [ ] Status bar shows green "complete" state
- [ ] No errors in console or server logs
- [ ] Generation time reasonable (~2-30 seconds depending on AI calls)

### For Layouts
- [ ] First slide is noticeably large (title layout)
- [ ] Slide variety is visible (different font sizes)
- [ ] Dense slides show tighter spacing
- [ ] Professional appearance throughout

### For Branding
- [ ] Blue accents on all slides
- [ ] Consistent font and color scheme
- [ ] Professional suitability for executive use

---

## Next Actions

1. **✅ Run this test** to verify everything works
2. **📝 Document results** in session notes
3. **🔧 Adjust layouts** if needed based on results
4. **💾 Commit changes** once E2E testing passes
5. **📚 Update API documentation** with new SSE endpoint

---

## API Reference: New SSE Endpoint

### POST /api/presentations/generate-briefing-deck-stream

**Purpose**: Generate briefing deck with real-time progress updates

**Request**:
```json
{
  "briefingPack": "Text content of briefing document",
  "numberOfSlides": 15,
  "numberOfQA": 10
}
```

**Response**: Server-Sent Events stream
```
data: {"step": 1, "total": 4, "message": "Parsing briefing pack structure..."}
data: {"step": 1, "total": 4, "message": "✅ Extracted 4 sections with 45 slides"}
...
data: {"complete": true, "deck": {...}, "model": "gpt-4", "tokensUsed": 15000}
```

**Headers**:
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

**Notes**:
- Stream continues until generation completes
- Each progress event is valid JSON on a new line
- Final event includes complete deck structure
- No polling needed - browser handles streaming automatically

---

**Created**: January 9, 2026
**Status**: Ready for Testing
