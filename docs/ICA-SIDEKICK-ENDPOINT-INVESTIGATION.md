# ICA Sidekick AI executePromptStream Endpoint Investigation

## Date: January 14, 2026

## Issue Reported
Colleague advised that we should **NOT** be using `/apis/v3/threads` to access document collections in ICA. Should use `/apis/v1/sidekick-ai/executePromptStream` instead.

## Changes Made

### 1. Updated `searchDocumentCollection()` function
**File**: `server/services/icaService.js` (lines ~35-85)

**Before** (using threads API):
```javascript
// Create thread → Add message → Create run → Wait → Get messages
const threadResponse = await fetch(`${API_BASE}/apis/v3/threads`, {...});
const messageResponse = await fetch(`${API_BASE}/apis/v3/threads/${threadId}/messages`, {...});
const runResponse = await fetch(`${API_BASE}/apis/v3/threads/${threadId}/runs`, {...});
```

**After** (using Sidekick AI):
```javascript
const response = await fetch(`${API_BASE}/apis/v1/sidekick-ai/executePromptStream`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_TOKEN}`,
    'Content-Type': 'application/json',
    'x-security-key': SERVICE_TOKEN
  },
  body: JSON.stringify({
    prompt: `Search the documents for information about: ${query}`,
    collectionId: COLLECTION_ID,
    model: 'global/gpt-4o'
  })
});
```

### 2. Created Test Script
**File**: `server/test-sidekick-stream.js`

Tests the new endpoint with proper error handling and streaming response parsing.

## Test Results

### Attempt 1: Missing `x-security-key` header
```
❌ Error 400: Required header 'x-security-key' is not present
```

### Attempt 2: Added `x-security-key` - Missing `x-extension-app-id` header
```
❌ Error 400: Required header 'x-extension-app-id' is not present
```

## Required Headers

The `/apis/v1/sidekick-ai/executePromptStream` endpoint requires:

1. ✅ `Authorization: Bearer ${SERVICE_TOKEN}` - Have this
2. ✅ `Content-Type: application/json` - Have this
3. ✅ `x-security-key: ${SERVICE_TOKEN}` - Added
4. ❌ `x-extension-app-id: ${???}` - **MISSING - Need from colleague**

## Questions for Colleague

1. **What is the value for `x-extension-app-id`?**
   - Is this a constant value?
   - Is it specific to the application?
   - Should it be in .env configuration?

2. **Are there any other required headers we're missing?**

3. **Is the request body structure correct?**
   ```json
   {
     "prompt": "Search query here",
     "collectionId": "695fd3c445825c3b9aeac633",
     "model": "global/gpt-4o"
   }
   ```

4. **Documentation link?**
   - Is there API documentation for this endpoint we should reference?

## Current Status

- ✅ Code updated to use `/apis/v1/sidekick-ai/executePromptStream`
- ✅ Removed old `/apis/v3/threads` implementation
- ✅ Test script created
- ❌ Cannot test fully until we have `x-extension-app-id` value
- ❌ Function currently disabled (will return null) until proper configuration

## Next Steps

1. **Get `x-extension-app-id` from colleague**
2. Add it to:
   - `.env` file (as `IBM_ICA_EXTENSION_APP_ID`)
   - `.env.example` (with placeholder)
   - Service code (`server/services/icaService.js`)
   - Test script (`server/test-sidekick-stream.js`)
3. Re-run test: `node server/test-sidekick-stream.js`
4. Verify streaming response works correctly
5. Update session notes with results

## Configuration Needed

Add to `.env`:
```env
# ICA Sidekick AI Configuration
IBM_ICA_EXTENSION_APP_ID=<TO_BE_PROVIDED_BY_COLLEAGUE>
```

## Code References

- **Service**: `server/services/icaService.js` lines 35-85
- **Test**: `server/test-sidekick-stream.js`
- **Usage**: When `useDocumentCollection=true` in `generateRFIResponse()` (currently Azure Blob is default)

## Impact

- Document collection search currently **NOT WORKING** until we have extension app ID
- Azure Blob Storage RAG is the **DEFAULT** and **WORKING** alternative
- No impact to current production functionality (Azure Blob is primary)
- Once configured, can enable ICA collection by setting `useDocumentCollection=true`

---

**Action Required**: Please provide the `x-extension-app-id` value so we can complete the migration from threads API to Sidekick AI executePromptStream.
