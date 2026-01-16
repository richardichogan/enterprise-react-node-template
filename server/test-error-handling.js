// Test error handling when document extraction fails
const testData = {
  briefingPack: "[PDF file - could not extract text: test error]",
  briefingInstructions: "Test instructions",
  vendorResponse: "",
  analystFirm: "Gartner",
  model: "global/gpt-4o"
};

fetch('http://localhost:3001/api/presentations/generate-briefing-deck', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testData)
})
  .then(async (response) => {
    console.log('Response status:', response.status);
    const data = await response.json();
    console.log('Response body:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.log('❌ Expected error (for testing):');
      console.log('   Error:', data.error);
      console.log('   Details:', data.details);
      console.log('\n✅ Error handling works! Frontend will now see:', data.details);
    } else {
      console.log('⚠️ Unexpected success - should have failed with extraction error');
    }
  })
  .catch((error) => {
    console.error('❌ Fetch error:', error.message);
  });
