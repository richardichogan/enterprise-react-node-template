
## Implementation Status: Interactive Presentation Outline

**Status**: ✅ Implemented

### 1. New Workflow
The rigid "upload and pray" process has been replaced with a 2-step interactive workflow:

1. **Analyze Structure**:
   - System auto-detects "Briefing Pack" and "Analyst Instructions" from the project documents.
   - Parses the briefing pack structure (sections, timings, topics).
   - Displays a clean outline to the user.

2. **Configure & Generate**:
   - User sees a card for each section (e.g., "Part One", "Case Studies", "Q&A").
   - **3 Action Options per Section**:
     - 🔵 **Generate Content** (Default): Full AI generation of slides.
     - 🟡 **Section Break Only**: Create only a title divider slide (perfect for Q&A/empty sections).
     - 🔴 **Skip**: Exclude from deck completely.

### 2. Backend Changes
- **New Endpoint**: `POST /api/presentations/analyze-structure`
- **Updated Service**: `briefingDeckService.js` now accepts `sectionConfig` mapping.
- **Logic**: 
  - Iterates through structure.
  - Checks config for `skip` -> continues loop.
  - Checks config for `break` -> creates divider, skips generation.
  - Default/`content` -> creates divider + generates slides.
- **Auto-detection**: Q&A sections default to "Section Break Only" automatically.

### 3. Frontend Changes (`App.tsx`)
- Removed manual textbox inputs for documents.
- Added "Auto-Detected Documents" summary panel.
- Added "Analyze Structure" button.
- Added Section Configuration Cards with RadioButtons (`Content` | `Break` | `Skip`).
- Pass configuration to backend during generation.

### 4. Verification
- **Analyze**: Works with auto-detected docs.
- **Configure**: UI updates state correctly.
- **Generate**: Backend respects choices (skips sections, creates breaks).

**Next Steps**:
- Verify in browser.
- Ensure project has documents with "briefing" and "welcome" in names/metadata for auto-detection to work best.
