// Test various ways to import pdf-parse
console.log('Testing pdf-parse imports...\n');

// Try 1: Default import
try {
  import('pdf-parse').then(mod => {
    console.log('Default import keys:', Object.keys(mod));
    console.log('Has default?', 'default' in mod);
    console.log('Module:', mod);
  });
} catch (err) {
  console.error('❌ Default import failed:', err.message);
}
