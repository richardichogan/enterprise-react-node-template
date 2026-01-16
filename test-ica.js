import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env manually
const envPath = path.join(__dirname, 'server', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};

envContent.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  }
});

const SERVICE_TOKEN = env.IBM_ICA_SERVICE_TOKEN;
const API_BASE = env.IBM_ICA_API_URL || 'https://api.ibm.com/ica';

console.log('🔍 Testing ICA API Connection');
console.log('📤 API Base:', API_BASE);
console.log('🔑 Token length:', SERVICE_TOKEN?.length || 'MISSING');

if (!SERVICE_TOKEN) {
  console.error('❌ IBM_ICA_SERVICE_TOKEN not found in .env');
  process.exit(1);
}

const testPayload = {
  model: 'global/gpt-5.1-chat',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Test message' }
  ],
  temperature: 0.7,
  max_tokens: 100
};

console.log('📝 Test Payload created');
console.log('\n🚀 Sending request to:', `${API_BASE}/apis/v3/chat/completions`);
console.log('\n');

fetch(`${API_BASE}/apis/v3/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(testPayload)
})
  .then(response => {
    console.log('📊 Response Status:', response.status, response.statusText);
    return response.text().then(text => ({ status: response.status, text }));
  })
  .then(({ status, text }) => {
    console.log('\n📄 Response Body:');
    console.log(text);
    if (status !== 200) {
      console.error(`\n❌ Error (${status})`);
    } else {
      console.log('\n✅ Success!');
    }
  })
  .catch(error => {
    console.error('❌ Network/Fetch Error:', error.message);
  });
