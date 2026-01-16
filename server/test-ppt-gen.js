// Test PowerPoint generation functionality
import { createPresentationFromDeck } from './services/briefingDeckService.js';
import fs from 'fs/promises';
import path from 'path';

const mockDeckStructure = {
  slides: [
    {
      title: "Title Slide",
      content: ["Bullet 1", "Bullet 2"],
      speakerNotes: "Say hello to everyone"
    },
    {
      title: "Content Slide",
      content: ["Point A", "Point B", "Sub-point C"],
      speakerNotes: "Explain points in detail"
    }
  ]
};

(async () => {
  console.log('🧪 Testing PowerPoint Generation...');
  try {
    const buffer = await createPresentationFromDeck(mockDeckStructure);
    console.log(`✅ Generated buffer size: ${buffer.length} bytes`);
    
    // Validating it's a valid zip (starts with PK)
    const header = buffer.toString('utf8', 0, 2);
    if (header === 'PK') {
      console.log('✅ Valid ZIP signature detected');
    } else {
      console.error('❌ Invalid ZIP signature');
    }

    try {
      await fs.writeFile('test-output.pptx', buffer);
      console.log('✅ Saved test-output.pptx locally');
    } catch (writeErr) {
      console.error('⚠️ Could not save file locally:', writeErr.message);
    }
    
  } catch (err) {
    console.error('❌ Error generating PPT:', err);
    console.error('Stack:', err.stack);
  }
})();
