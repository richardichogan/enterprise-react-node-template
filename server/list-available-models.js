import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = process.env.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;

async function listModels() {
  try {
    console.log('🔍 Querying available models from IBM ICA...');
    const response = await fetch(`${API_BASE}/apis/v3/models`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Available models:');
      if (data.data && Array.isArray(data.data)) {
        data.data.forEach(model => {
          console.log(`   - ${model.id}`);
        });
      } else {
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      const error = await response.text();
      console.log('⚠️ Models endpoint returned:', response.status);
      console.log(error.substring(0, 200));
      console.log('\nTrying alternate endpoint...');
      
      const altResponse = await fetch(`${API_BASE}/apis/v3/chat/models`, {
        headers: {
          'Authorization': `Bearer ${SERVICE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (altResponse.ok) {
        const altData = await altResponse.json();
        console.log('✅ Available models (alt endpoint):');
        console.log(JSON.stringify(altData, null, 2));
      } else {
        console.log('⚠️ Alternate endpoint also failed');
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

listModels();
