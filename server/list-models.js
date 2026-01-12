import dotenv from 'dotenv';
dotenv.config();

const API_BASE = process.env.IBM_ICA_API_URL;
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;

async function getModels() {
  const response = await fetch(`${API_BASE}/apis/v3/models/`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_TOKEN}`
    }
  });
  
  const data = await response.json();
  console.log('Available models:\n');
  data.data.forEach(model => {
    console.log(`  - ${model.id}`);
  });
}

getModels();
