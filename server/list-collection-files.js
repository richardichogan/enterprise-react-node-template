import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = process.env.IBM_ICA_API_URL;
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
const COLLECTION_ID = '695fd3c445825c3b9aeac633';

async function listCollectionFiles() {
  try {
    console.log('📚 Listing all vector stores to find documents...\n');
    
    // Get all vector stores
    const response = await fetch(`${API_BASE}/apis/v3/vector_stores`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.log('❌ Error fetching vector stores:', response.status);
      console.log('Error details:', error);
      return;
    }
    
    const data = await response.json();
    
    console.log('All vector stores:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listCollectionFiles();
