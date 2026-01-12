# Azure Blob Storage Integration - Test Upload

## Test with cURL (PowerShell)

```powershell
# Create a test file
"This is a test RFI document" | Out-File -FilePath test-doc.txt

# Upload to API
curl.exe -X POST http://localhost:3001/api/documents/upload `
  -F "document=@test-doc.txt" `
  -H "Accept: application/json"
```

## Test with cURL (Unix/Linux/Mac)

```bash
# Create test file
echo "This is a test RFI document" > test-doc.txt

# Upload
curl -X POST http://localhost:3001/api/documents/upload \
  -F "document=@test-doc.txt" \
  -H "Accept: application/json"
```

## Expected Response

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "success": true,
    "blobName": "2026-01-09T12-30-45-678Z_test-doc.txt",
    "originalName": "test-doc.txt",
    "url": "https://youraccountname.blob.core.windows.net/rfi-documents/2026-01-09T12-30-45-678Z_test-doc.txt",
    "size": 28,
    "mimeType": "text/plain",
    "uploadDate": "2026-01-09T12:30:45.678Z",
    "etag": "\"0x8D9F2B3C4D5E6F7\""
  }
}
```

## List Documents

```powershell
curl.exe http://localhost:3001/api/documents
```

Expected response:
```json
{
  "success": true,
  "count": 1,
  "documents": [
    {
      "name": "2026-01-09T12-30-45-678Z_test-doc.txt",
      "originalName": "test-doc.txt",
      "size": 28,
      "mimeType": "text/plain",
      "uploadDate": "2026-01-09T12:30:45.678Z",
      "lastModified": "2026-01-09T12:30:45.000Z",
      "url": "https://youraccountname.blob.core.windows.net/rfi-documents/..."
    }
  ]
}
```

## Delete Document

```powershell
curl.exe -X DELETE http://localhost:3001/api/documents/2026-01-09T12-30-45-678Z_test-doc.txt
```

## Error Handling

### File too large (>10MB)
```json
{
  "error": "Failed to upload document",
  "details": "File too large"
}
```

### Unsupported file type
```json
{
  "error": "Failed to upload document",
  "details": "Unsupported file type: image/jpeg. Allowed: PDF, Word, PowerPoint, TXT"
}
```

### Azure not configured
```json
{
  "error": "Failed to upload document",
  "details": "Azure Blob Storage not configured. Check .env file."
}
```

## Supported File Types

- PDF: `application/pdf`
- Word (.docx): `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Word (.doc): `application/msword`
- PowerPoint (.pptx): `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- PowerPoint (.ppt): `application/vnd.ms-powerpoint`
- Text: `text/plain`

## File Size Limits

- Maximum: 10 MB per file
- Can be increased in `server/index.js` (multer configuration)

## Security Notes

- Files stored in **private** container (not publicly accessible)
- Access requires Azure Storage Account Key
- URLs include SAS tokens for authenticated access (if enabled)
- CORS configured for frontend domain only
