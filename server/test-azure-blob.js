import { uploadDocument, listDocuments, deleteDocument, getDocumentMetadata } from './services/azureBlobService.js';
import fs from 'fs';

console.log('🧪 Testing Azure Blob Storage Connection...\n');

async function runTests() {
  try {
    // Test 1: Check configuration
    console.log('1️⃣ Checking configuration...');
    if (!process.env.AZURE_STORAGE_ACCOUNT_NAME || !process.env.AZURE_STORAGE_ACCOUNT_KEY) {
      console.log('❌ Azure Blob Storage not configured');
      console.log('📝 Follow docs/AZURE-BLOB-SETUP.md to set up Azure Blob Storage');
      return;
    }
    console.log(`✅ Storage Account: ${process.env.AZURE_STORAGE_ACCOUNT_NAME}`);
    console.log(`✅ Container: ${process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents'}\n`);

    // Test 2: Upload a test file
    console.log('2️⃣ Testing file upload...');
    const testContent = Buffer.from('This is a test document for RFI-Helper Azure Blob Storage integration.\n\nCreated: ' + new Date().toISOString());
    const testFileName = 'test-document.txt';
    
    const uploadResult = await uploadDocument(testContent, testFileName, 'text/plain');
    console.log('Upload result:', JSON.stringify(uploadResult, null, 2));
    console.log('');

    // Test 3: List documents
    console.log('3️⃣ Testing document listing...');
    const documents = await listDocuments();
    console.log(`Found ${documents.length} document(s):`);
    documents.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.originalName} (${doc.size} bytes, uploaded: ${new Date(doc.uploadDate).toLocaleString()})`);
    });
    console.log('');

    // Test 4: Get metadata
    console.log('4️⃣ Testing metadata retrieval...');
    const metadata = await getDocumentMetadata(uploadResult.blobName);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
    console.log('');

    // Test 5: Delete test file
    console.log('5️⃣ Testing file deletion...');
    const deleteResult = await deleteDocument(uploadResult.blobName);
    console.log('Delete result:', JSON.stringify(deleteResult, null, 2));
    console.log('');

    // Test 6: Verify deletion
    console.log('6️⃣ Verifying deletion...');
    const documentsAfter = await listDocuments();
    console.log(`Documents remaining: ${documentsAfter.length}`);
    console.log('');

    console.log('✅ All tests passed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Test file upload via API: POST http://localhost:3001/api/documents/upload');
    console.log('   2. Use tools like Postman or curl to test multipart/form-data uploads');
    console.log('   3. Integrate with frontend for user file uploads');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   - Check .env file has AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY');
    console.error('   - Verify storage account exists in Azure Portal');
    console.error('   - Ensure access key is correct and not expired');
    console.error('   - Container "rfi-documents" will be created automatically if missing');
  }
}

runTests();
