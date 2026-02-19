import dotenv from 'dotenv';
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

/**
 * Retry helper for Azure OpenAI calls with exponential backoff
 * Handles 429 rate limits automatically
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

export async function generateNarrativeSpine(rfiContext, briefingStructure) {
  /**
   * Generate a hidden narrative spine JSON that shapes all downstream slide generation.
   * 
   * Input: RFI context (market, customer pain, competitive landscape) + briefing structure
   * Output: JSON spine with market_tension, ibm_differentiation, proof_themes, ai_roadmap, gaps
   * 
   * This spine is NOT shown to user; it drives slide sequencing, axis balance, and thesis confidence.
   */

  console.log(`   📖 Spine Agent: Input validation...`);
  console.log(`      - RFI Context keys: ${Object.keys(rfiContext || {}).join(', ')}`);
  console.log(`      - Briefing Structure keys: ${Object.keys(briefingStructure || {}).join(', ')}`);

  const systemPrompt = `You are a strategic narrative architect for enterprise briefings. Your role is to synthesize RFI context into a hidden narrative spine that will shape all downstream briefing content.

## NARRATIVE SPINE STRUCTURE

You will produce a JSON object with these fields:

{
  "market_tension": {
    "statement": "<One sentence capturing the key market pressure/opportunity driving the buyer>",
    "source_status": "confirmed|inferred|missing",
    "confidence": 0.0-1.0,
    "supporting_facts": ["<fact from RFI>", "<fact from RFI>"]
  },
  
  "ibm_differentiation": {
    "thesis": "<Core IBM competitive advantage in 1-2 sentences>",
    "mechanism": "<How IBM's approach/offering differs from competitors>",
    "proof_anchor": "<Which IBM capability/investment backs this claim>",
    "source_status": "confirmed|inferred|missing",
    "confidence": 0.0-1.0,
    "evidence_foundation": ["<IBM capability from docs>", "<IBM capability from docs>"]
  },
  
  "proof_themes": [
    {
      "theme": "<Category of proof: scale|execution_track_record|innovation|partnership|risk_mitigation>",
      "narrative": "<How this theme demonstrates IBM's differentiation>",
      "key_metric": "<Quantified evidence or proof point>",
      "axis_alignment": "AE|CV|both",
      "confidence": 0.0-1.0
    }
  ],
  
  "ai_roadmap_12m": {
    "headline": "<One-line vision for AI-enabled transformation in next 12 months>",
    "phases": [
      {
        "quarter": "Q1|Q2|Q3|Q4",
        "milestone": "<Concrete deliverable or capability>",
        "productivity_impact": "<Quantified impact if available>",
        "confidence": 0.0-1.0
      }
    ]
  },
  
  "memory_lines": {
    "ae_memory": "<Single line AE buyer remembers: what IBM can execute for them>",
    "cv_memory": "<Single line CV buyer remembers: what IBM's vision enables>"
  },
  
  "gaps_and_theses": {
    "unconfirmed_theses": [
      {
        "thesis": "<Claim made in RFI responses but not backed by evidence in docs>",
        "needed_evidence": "<What would validate this thesis>",
        "owner": "<AR|Offering|Product|Customer>",
        "priority": "critical|important|nice_to_have"
      }
    ],
    "missing_narratives": [
      {
        "gap": "<Key story element missing from RFI context>",
        "impact": "<Why this gap matters for the briefing>",
        "suggested_source": "<Where to find this info>"
      }
    ]
  },
  
  "slide_sequence_bias": {
    "opening_thesis": "<The market tension statement that must lead>",
    "closing_thesis": "<The forward-looking AI/roadmap statement that must close>",
    "ae_dominant_slides": ["<slide topics where AE proof dominates>"],
    "cv_dominant_slides": ["<slide topics where CV proof dominates>"],
    "both_slides": ["<slide topics where both axes are equally important>"]
  }
}

## GENERATION RULES

1. **Market Tension First**: Every narrative spine starts with a single, specific market dynamic that motivated the RFI. Avoid generic ("digital transformation needed") and anchor to facts from RFI context.

2. **IBM Differentiation is NOT Features**: Identify IBM's *positioning* vs. competitors, not product features. Example:
   - ❌ "We have AI tools"
   - ✅ "We deliver AI-augmented delivery that compresses implementation timelines by 40%, reducing client cost of ownership"

3. **Proof Themes Match Axes**: 
   - AE (Ability to Execute): scale, execution track record, delivery excellence, risk mitigation
   - CV (Completeness of Vision): innovation roadmap, industry strategy, partnership ecosystem, forward vision
   - Tag each proof theme with dominant axis

4. **Confidence Tracking**: Rate each claim 0.0–1.0 based on:
   - 0.9–1.0 = Multiple sources in RFI docs, quantified, IBM-authored
   - 0.7–0.8 = Stated in RFI responses, one doc source, needs minor validation
   - 0.5–0.6 = Inferred from RFI context, plausible but not explicitly stated
   - 0.0–0.4 = Missing evidence, speculation only

5. **Gaps Are NOT Failures**: If a thesis is unconfirmed or evidence is missing, FLAG IT with owner and priority. This feeds back to AR/Offering for validation, not to user.

6. **Slide Sequencing Bias**: Provide hints for structurePlanning to follow:
   - Opening must establish market tension
   - Core proof slides alternate AE/CV to avoid monotony
   - Closing must land AI roadmap + forward vision

7. **Memory Lines**: These are the 2 sound bites the buyer should remember walking out of the room—one for AE stakeholder, one for CV buyer.

## OUTPUT FORMAT

Return ONLY valid JSON. No markdown, no explanation, no caveats. If you cannot generate a field with confidence > 0.5, mark source_status as "missing" and confidence as a low number, then include in gaps_and_theses.`;

  const userPrompt = `Generate narrative spine for this briefing:

## RFI CONTEXT
${JSON.stringify(rfiContext, null, 2)}

## BRIEFING STRUCTURE
${JSON.stringify(briefingStructure, null, 2)}

Synthesize these inputs into a strategic narrative spine. Flag all unconfirmed claims and missing evidence.`;

  try {
    const response = await retryWithBackoff(async () => {
      const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
      
      return await fetch(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': AZURE_OPENAI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 3000,
          response_format: { type: 'json_object' }
        })
      });
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Spine API call failed with ${response.status}`);
      console.error(`   Response: ${errorText.substring(0, 500)}`);
      throw new Error(`Narrative spine generation failed: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid API response structure:', JSON.stringify(data, null, 2).substring(0, 500));
      throw new Error('Invalid response structure from Azure OpenAI');
    }

    let spineJson;
    try {
      const content = data.choices[0].message.content.trim();
      console.log(`   📊 Spine response length: ${content.length} chars`);
      spineJson = JSON.parse(content);
    } catch (parseErr) {
      console.error('Failed to parse spine JSON response:', parseErr);
      console.error('   Content preview:', data.choices[0].message.content.substring(0, 500));
      throw new Error(`Invalid spine JSON from GPT-4o: ${parseErr.message}`);
    }

    // Validate spine has minimum required structure
    if (!spineJson || typeof spineJson !== 'object') {
      throw new Error('Spine JSON is not a valid object');
    }

    return {
      success: true,
      spine: spineJson,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error generating narrative spine:', error.message);
    console.error('   Stack:', error.stack);
    throw new Error(`Narrative spine generation failed: ${error.message}`);
  }
}

export async function validateSpineCompleteness(spine) {
  /**
   * Check if spine has all required fields and confidence levels > threshold.
   * Return validation report with gaps.
   */

  // Handle null/undefined spine gracefully
  if (!spine) {
    return {
      is_complete: false,
      missing_fields: ['ALL - spine is null or undefined'],
      low_confidence_items: [],
      gaps_count: 0,
      recommendations: ['Spine generation failed - cannot proceed'],
    };
  }

  const requiredFields = [
    'market_tension',
    'ibm_differentiation',
    'proof_themes',
    'ai_roadmap_12m',
    'memory_lines',
    'gaps_and_theses',
    'slide_sequence_bias',
  ];

  const report = {
    is_complete: true,
    missing_fields: [],
    low_confidence_items: [],
    gaps_count: 0,
    recommendations: [],
  };

  // Check required top-level fields
  for (const field of requiredFields) {
    if (!spine[field]) {
      report.missing_fields.push(field);
      report.is_complete = false;
    }
  }

  // Check confidence thresholds
  if (spine.market_tension?.confidence < 0.6) {
    report.low_confidence_items.push({
      field: 'market_tension',
      confidence: spine.market_tension.confidence,
      recommendation: 'Market tension lacks strong evidence; verify with buyer context',
    });
  }

  if (spine.ibm_differentiation?.confidence < 0.6) {
    report.low_confidence_items.push({
      field: 'ibm_differentiation',
      confidence: spine.ibm_differentiation.confidence,
      recommendation: 'IBM differentiation thesis needs validation from AR/Offering',
    });
  }

  // Count gaps
  if (spine.gaps_and_theses?.unconfirmed_theses) {
    report.gaps_count += spine.gaps_and_theses.unconfirmed_theses.length;
    const criticalGaps = spine.gaps_and_theses.unconfirmed_theses.filter(
      (g) => g.priority === 'critical'
    );
    if (criticalGaps.length > 0) {
      report.recommendations.push(
        `${criticalGaps.length} CRITICAL gaps require validation before briefing`
      );
    }
  }

  return report;
}
