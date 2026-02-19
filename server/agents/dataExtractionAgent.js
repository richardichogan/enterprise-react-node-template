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

  const systemPrompt = `You are a precise data extraction agent for analyst briefings.
Your ONLY job is to extract atomic facts from the provided text.

CRITICAL EXTRACTION RULES:

1. METRIC EXTRACTION (for tiles/dashboards):
   - Extract EXACT numeric values with units: "160,000 consultants", "90% retention", "65 countries"
   - For tile/metric requests, return structured format:
     {metric: "consultants", value: 160000, formatted: "160K", unit: "people", source: "doc.pdf p.6", confidence: 0.95}
   - NEVER use placeholders: "Tile 1", "Metric TBD", "Value pending"
   - If metric not found, return: {found: false, reason: "No mention of [metric] in source documents"}

2. BUSINESS OUTCOMES (for case studies):
   - Extract quantifiable results: revenue impact, efficiency gains, time savings
   - Extract before/after metrics where available
   - Extract decision rationale: why client chose IBM over alternatives
   - Extract client quotes or testimonials if present
   - Format: {client: "X", outcome: "30% cost reduction", timeframe: "6mo", whyIBM: "reason", source: "doc"}

3. CONFIDENCE SCORING:
   - High (>0.8): Exact match, explicit statement in source
   - Medium (0.5-0.8): Inferred from related text, reasonable interpretation
   - Low (<0.5): Uncertain, flag for manual review
   - Return confidence with each fact

4. MISSING DATA HANDLING:
   - When data not found, explicitly state: {found: false, reason: "specific reason"}
   - Don't fabricate or use generic placeholders
   - Flag gaps early so synthesis agent can handle appropriately

5. STRUCTURE REQUIREMENTS:
   - All facts must have source reference (doc name + page if available)
   - Include context: what the metric/outcome relates to
   - Separate facts atomically (don't combine multiple claims)

Extract these categories:
- scale: Metrics about size (consultants, countries, certifications, revenue) - MUST have numeric values
- capabilities: Named offerings, methodologies, platforms, tools - MUST have specific names
- customers: Client examples with industry, outcome, timeline - MUST have business results
- partnerships: Partner names, types, certifications - MUST have partner names
- innovations: Recent launches, acquisitions, investments - MUST have dates
- outcomes: Specific results (%, $, timeframes) - MUST be quantifiable

Focus on: ${focusAreas}

FORBIDDEN: Generic descriptions, "extensive expertise", capabilities without names, metrics without numbers`;

  const userPrompt = `Extract all facts from this text with STRUCTURED METRICS and BUSINESS OUTCOMES:

CONTEXT: ${JSON.stringify(context, null, 2)}

TEXT TO EXTRACT FROM:
${searchResults.substring(0, 80000)}

CRITICAL: For metrics/tiles, extract structured format with actual values:
✅ CORRECT: {metric: "consultants", value: 160000, formatted: "160K", unit: "people", source: "doc.pdf", confidence: 0.95}
❌ WRONG: {title: "Tile 1", content: "Our scale"}

CRITICAL: For case studies, extract business outcomes:
✅ CORRECT: {client: "Pfizer", industry: "Pharma", outcome: "90% client return rate", whyIBM: "guaranteed business continuity", source: "doc"}
❌ WRONG: {client: "Pfizer", description: "multi-year engagement"}

Return ONLY valid JSON with this structure:
{
  "scale": [
    {
      "metric": "consultants",
      "value": 160000,
      "formatted": "160K",
      "unit": "people",
      "context": "Cloud ERP practice",
      "source": "doc.pdf - page 3",
      "confidence": 0.95
    }
  ],
  "capabilities": [
    {
      "name": "IBM Garage",
      "description": "co-creation methodology for ERP transformation",
      "source": "doc.xlsx",
      "confidence": 0.9
    }
  ],
  "customers": [
    {
      "name": "Company X",
      "industry": "Manufacturing",
      "projectType": "S/4HANA implementation",
      "outcome": "30% cost reduction, 50% faster close",
      "timeline": "6 months",
      "whyIBM": "only vendor with industry-specific accelerators",
      "beforeAfter": {
        "before": "manual processes",
        "after": "automated workflows"
      },
      "source": "doc.pdf - page 12",
      "confidence": 0.85
    }
  ],
  "partnerships": [
    {
      "partner": "SAP",
      "type": "Global SI",
      "certification": "Platinum",
      "capabilities": "S/4HANA, SuccessFactors",
      "source": "doc.xlsx",
      "confidence": 1.0
    }
  ],
  "innovations": [
    {
      "type": "acquisition",
      "name": "CompanyY",
      "date": "2025-Q3",
      "purpose": "AI capabilities for ERP automation",
      "impact": "55% productivity improvement",
      "source": "doc.pdf",
      "confidence": 0.9
    }
  ],
  "outcomes": [
    {
      "metric": "ROI",
      "value": "250%",
      "timeframe": "12 months",
      "context": "HCM implementation for global manufacturer",
      "source": "doc.xlsx",
      "confidence": 0.8
    }
  ],
  "missing": [
    {
      "requested": "Azure OpenAI integration timeline",
      "found": false,
      "reason": "No mention of Azure OpenAI timeline in source documents"
    }
  ]
}

If metric/data not found, add to "missing" array with reason.`;

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
