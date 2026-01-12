import dotenv from 'dotenv';
dotenv.config();

import { generateRFIResponse } from './services/icaService.js';

console.log('🧪 Testing with RFP_PROPOSALS Collection\n');
console.log('Collection ID:', process.env.IBM_ICA_COLLECTION_ID);
console.log('Collection Name:', process.env.IBM_ICA_COLLECTION_NAME);
console.log('='.repeat(70) + '\n');

async function quickTest() {
  const question = "What are best practices for responding to cloud ERP RFPs?";
  
  try {
    const response = await generateRFIResponse(question, '', true);
    
    console.log('✅ Success!');
    console.log('Used Document Collection:', response.usedDocumentCollection);
    console.log('Collection Name:', response.collectionName);
    console.log('\nResponse preview:');
    console.log(response.answer.substring(0, 500) + '...');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

quickTest();
