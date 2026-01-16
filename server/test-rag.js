// Quick test of RAG document processing
import { retrieveDocumentContext } from './services/documentProcessor.js';

const testDocuments = ['test.pdf', 'test.docx', 'test.xlsx', 'test.pptx'];
const testQuestion = 'What are the key features of IBM Cloud?';

console.log('🧪 Testing RAG Document Processor...\n');
console.log('Question:', testQuestion);
console.log('Documents:', testDocuments);
console.log('\nAttempting to retrieve document context...\n');

try {
    const context = await retrieveDocumentContext(testDocuments, testQuestion, 3);
    
    if (context) {
        console.log('✅ RAG system retrieved context successfully!');
        console.log('\n📄 Retrieved Context:');
        console.log('─'.repeat(80));
        console.log(context);
        console.log('─'.repeat(80));
        console.log(`\n📊 Context length: ${context.length} characters`);
    } else {
        console.log('⚠️  No context retrieved (documents may not exist in Azure Blob Storage)');
    }
} catch (error) {
    console.log('❌ Error testing RAG:');
    console.log('   Message:', error.message);
    console.log('   This is expected if test documents don\'t exist in Azure Blob Storage');
}

console.log('\n✅ RAG test complete!');
console.log('\nTo test with real documents:');
console.log('1. Upload documents via the UI');
console.log('2. Create a project and attach the documents');
console.log('3. Generate a response - check API logs for "📚 Retrieving content from X document(s)"');
