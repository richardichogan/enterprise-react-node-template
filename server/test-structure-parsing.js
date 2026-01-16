import dotenv from 'dotenv';
import { BlobServiceClient } from '@azure/storage-blob';

dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = '2025-01-01-preview';

async function fetchBriefingPack() {
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  const connectionString = `DefaultEndpointsProtocol=https;AccountName=${accountName};AccountKey=${accountKey};EndpointSuffix=core.windows.net`;
  
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient('documents');
  
  const blobs = [];
  for await (const blob of containerClient.listBlobsFlat()) {
    blobs.push(blob.name);
  }
  
  const briefingPackBlob = blobs.find(name => 
    name.toLowerCase().includes('briefing') && 
    name.toLowerCase().includes('guidelines')
  );
  
  if (!briefingPackBlob) {
    throw new Error('Briefing pack not found');
  }
  
  const blobClient = containerClient.getBlobClient(briefingPackBlob);
  const downloadResponse = await blobClient.download();
  const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
  
  return downloaded.toString('utf-8');
}

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

async function parseBriefingStructure(briefingPack) {
  const systemPrompt = `You are an expert at parsing analyst briefing documents.
Extract the presentation structure including all sections, slide titles, timings, and constraints.

CRITICAL: Extract the EXACT section names and structure from the document.
Do NOT make up generic names like "Introduction" or "Market Analysis".
Use the ACTUAL section headings from the briefing pack.

Return ONLY valid JSON with no markdown formatting.`;

  const userPrompt = `Read this briefing document THOROUGHLY and extract the EXACT presentation structure.
Use the ACTUAL section names from the document (e.g., "Part One: Vision and Execution", "Centers of Excellence", "Recent Acquisitions"):

${briefingPack.substring(0, 40000)}

Return JSON in this format:
{
  "agendaTimings": ["Part One (15min)", "Part Two (45min)", ...],
  "sections": [
    {
      "name": "EXACT name from document (e.g., 'Executive Summary')",
      "duration": "15 minutes",
      "constraintType": "time",
      "timeInMinutes": 15,
      "maxSlides": null,
      "slideTopics": ["Extract EXACT topics mentioned in this section"],
      "keyPoints": ["Extract 3-5 key facts that must be covered in this section"]
    }
  ],
  "constraints": {
    "totalTimeMinutes": 75,
    "evidenceRequirements": "..."
  }
}

CRITICAL: Use EXACT section names from the document. If you see "Part One: Vision and Execution" → use that EXACT text.`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
  
  const response = await fetch(azureUrl, {
    method: 'POST',
    headers: {
      'api-key': AZURE_OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 4000
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`❌ Azure OpenAI Error ${response.status}:`, errorBody.substring(0, 500));
    throw new Error(`${response.status}`);
  }

  const data = await response.json();
  let structureJSON = data.choices[0].message.content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(structureJSON);
}

(async () => {
  try {
    console.log('🔍 STRUCTURE PARSING TEST\n');
    
    console.log('📥 Fetching briefing pack...');
    const briefingPack = await fetchBriefingPack();
    console.log(`   ✅ Retrieved ${(briefingPack.length / 1024).toFixed(2)} KB\n`);
    
    console.log('🏗️  Parsing structure...\n');
    const structure = await parseBriefingStructure(briefingPack);
    
    console.log('📋 EXTRACTED STRUCTURE:\n');
    console.log(JSON.stringify(structure, null, 2));
    
    console.log('\n\n🎯 SECTIONS EXTRACTED:\n');
    structure.sections.forEach((section, idx) => {
      console.log(`${idx + 1}. ${section.name}`);
      console.log(`   Duration: ${section.duration || 'N/A'}`);
      console.log(`   Topics: ${section.slideTopics?.join(', ') || 'N/A'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
