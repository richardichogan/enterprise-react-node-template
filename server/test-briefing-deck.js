// Test briefing deck generation endpoint
const testData = {
  briefingPack: "Test briefing pack content with agenda and requirements",
  briefingInstructions: "Test instructions for the briefing",
  vendorResponse: "Test vendor response content",
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
    console.log('Response headers:', Object.fromEntries(response.headers));
    const text = await response.text();
    console.log('Response body:', text.substring(0, 500));
    
    if (!response.ok) {
      console.error('❌ ERROR Response');
    } else {
      console.log('✅ SUCCESS');
    }
  })
  .catch((error) => {
    console.error('❌ Fetch error:', error.message);
  });
