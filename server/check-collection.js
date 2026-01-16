import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const API_BASE = process.env.IBM_ICA_API_URL;
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
const COLLECTION_ID = '695fd3c445825c3b9aeac633';

async function checkCollection() {
  const response = await fetch(`${API_BASE}/apis/v3/vector_stores`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_TOKEN}`
    }
  });
  
  const data = await response.json();
  const gartnerCollection = data.data.find(c => c.id === COLLECTION_ID);
  
  if (gartnerCollection) {
    console.log('✅ Found Gartner ERP Analysts Response collection:\n');
    console.log('Name:', gartnerCollection.name);
    console.log('ID:', gartnerCollection.id);
    console.log('Visibility:', gartnerCollection.metadata['ica.visibility']);
    console.log('Is Global:', gartnerCollection.metadata['ica.is_global']);
    console.log('Roles:', gartnerCollection.metadata['ica.roles']);
    console.log('\nFull metadata:');
    console.log(JSON.stringify(gartnerCollection.metadata, null, 2));
  } else {
    console.log('❌ Collection not found');
  }
}

checkCollection();
