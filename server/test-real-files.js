import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';

// Test with real Office files from Azure
(async () => {
  try {
    console.log('🧪 Testing mammoth with real Office files...');
    console.log('📁 Current directory:', process.cwd());
    
    // List what's in current directory
    const files = await fs.readdir('.');
    console.log('📂 Files in directory:', files.slice(0, 10));
    
    // Look for test files
    const testFiles = files.filter(f => f.match(/\.(docx|pptx|pdf)$/i));
    console.log('📄 Office/PDF files found:', testFiles);
    
    if (testFiles.length === 0) {
      console.log('\n⚠️ No test files found. Need to download actual documents from Azure Blob Storage.');
      console.log('💡 This means we need to test with REAL documents that users have uploaded.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
