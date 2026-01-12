/**
 * Quick debug test - check token and try simple chat completion
 */

import dotenv from 'dotenv';
dotenv.config();

const API_BASE = process.env.IBM_ICA_API_URL;
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;

console.log('🔍 Debug Info:');
console.log('API Base:', API_BASE);
console.log('Token:', SERVICE_TOKEN ? `${SERVICE_TOKEN.substring(0, 20)}...` : 'NOT FOUND');
console.log('Token length:', SERVICE_TOKEN?.length || 0);
console.log('\nAttempting simple chat completion...\n');

async function testSimpleChat() {
  try {
    const response = await fetch(`${API_BASE}/apis/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'global/gpt-5.1-chat',
        messages: [
          { role: 'user', content: 'Say hello' }
        ],
        max_tokens: 50
      })
    });
    
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SUCCESS!');
      console.log('Response:', data.choices[0].message.content);
    } else {
      const error = await response.text();
      console.log('❌ FAILED:', error.substring(0, 500));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testSimpleChat();
