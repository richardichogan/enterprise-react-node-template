import mammoth from 'mammoth';

// Test mammoth API
(async () => {
  try {
    console.log('🧪 Testing mammoth API...');
    
    // Check what mammoth exports
    console.log('🔍 Mammoth exports:', Object.keys(mammoth).filter(k => !k.startsWith('_')));
    
    // Check method signature
    console.log('🔍 mammoth.extractRawText type:', typeof mammoth.extractRawText);
    
    // Test with a dummy buffer
    const dummyBuffer = Buffer.from('test');
    const result = await mammoth.extractRawText({ buffer: dummyBuffer });
    
    console.log('✅ Result object keys:', Object.keys(result));
    console.log('✅ Result.value type:', typeof result.value);
    console.log('✅ Result.value:', result.value);
    console.log('✅ Full result:', result);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
})();
