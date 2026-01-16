/**
 * Data Extraction Agent
 * Reads search results and extracts atomic facts (numbers, dates, names, capabilities, customers)
 * This agent ONLY extracts - it does NOT synthesize or write narratives
 * 
 * Reusable across any project that needs fact extraction from unstructured text
 */

import dotenv from 'dotenv';
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

/**
 * Retry helper for API calls with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, delayMs = 65000) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const is429 = error.message?.includes('429') || error.status === 429;
      
      if (!is429 || attempt === maxRetries - 1) {
        throw error;
      }
      
      console.log(`   ⏳ Rate limit - waiting ${delayMs/1000}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 * Extract atomic facts from search results
 * 
 * @param {Object} input - Input data
 * @param {string} input.searchResults - Raw search results text (comprehensive context)
 * @param {string} input.context - Additional context (section name, requirements)
 * @param {Object} options - Agent options
 * @param {string} options.focusAreas - What to extract (e.g., "scale metrics, capabilities, customers")
 * @returns {Promise<Object>} - Extracted facts as structured JSON
 */
export async function extractFacts(input, options = {}) {
  const { searchResults, context } = input;
  const { focusAreas = "all relevant facts" } = options;

  const systemPrompt = `You are a precise data extraction agent.
Your ONLY job is to extract atomic facts from the provided text.

RULES:
1. Extract ONLY facts that are explicitly stated in the text
2. Include exact numbers, dates, names, capabilities, customer examples
3. Always note the source document for each fact
4. DO NOT synthesize or combine information
5. DO NOT add context or narrative
6. If a fact is unclear or ambiguous, note it as "uncertain"
7. Return structured JSON

Extract these categories:
- scale: Metrics about size (consultants, countries, certifications, revenue)
- capabilities: Named offerings, methodologies, platforms, tools
- customers: Client examples with industry, outcome, timeline
- partnerships: Partner names, types, certifications
- innovations: Recent launches, acquisitions, investments
- outcomes: Specific results (%, $, timeframes)

Focus on: ${focusAreas}`;

  const userPrompt = `Extract all facts from this text:

CONTEXT: ${context}

TEXT TO EXTRACT FROM:
${searchResults.substring(0, 80000)}

Return ONLY valid JSON with this structure:
{
  "scale": [{"metric": "consultants", "value": 160000, "source": "doc.pdf - page 3"}],
  "capabilities": [{"name": "IBM Garage", "description": "co-creation methodology", "source": "doc.xlsx"}],
  "customers": [{"name": "Company X", "industry": "Manufacturing", "outcome": "30% cost reduction", "timeline": "6 months", "source": "doc.pdf"}],
  "partnerships": [{"partner": "SAP", "type": "Global SI", "certification": "Platinum", "source": "doc.xlsx"}],
  "innovations": [{"type": "acquisition", "name": "CompanyY", "date": "2025-Q3", "purpose": "AI capabilities", "source": "doc.pdf"}],
  "outcomes": [{"metric": "ROI", "value": "250%", "timeframe": "12 months", "context": "HCM implementation", "source": "doc.xlsx"}]
}`;

  const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;

  return await retryWithBackoff(async () => {
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
        temperature: 0.1, // Low temperature for factual extraction
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Data Extraction Agent failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  });
}
