/**
 * Structure Planning Agent
 * Takes extracted facts and creates a slide blueprint (layout decisions + content distribution)
 * This agent ONLY plans structure - it does NOT write content
 * 
 * Reusable across any project that needs to plan presentation structure
 */

import dotenv from 'dotenv';
dotenv.config();

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

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
 * Plan slide structure based on extracted facts and narrative spine
 * 
 * @param {Object} input - Input data
 * @param {Object} input.facts - Extracted facts from dataExtractionAgent
 * @param {string} input.sectionName - Section name (e.g., "Part One: Vision and Execution")
 * @param {number} input.targetSlides - Number of slides to generate
 * @param {string} input.referenceExamples - Optional 2024 deck examples for structure guidance
 * @param {Object} input.narrativeSpine - (Optional) Hidden spine JSON from narrativeSpineAgent
 * @param {Object} options - Agent options
 * @param {Array<string>} options.availableLayouts - Approved slide layouts (default: L1, L2, L5)
 * @returns {Promise<Array>} - Slide blueprint (array of slide plans)
 */
export async function planStructure(input, options = {}) {
  const { facts, sectionName, targetSlides, referenceExamples = '', requiredTopics = [], keyPoints = [], narrativeSpine = null } = input;
  const { availableLayouts = ['L1_Executive_Header', 'L2_TwoColumn_Proof', 'L5_Metric_Tiles_3x1'] } = options;

  const systemPrompt = `You are a presentation structure planning agent for analyst briefings.
Your ONLY job is to plan slide structure - decide layouts and fact distribution.
You will also consume a hidden narrative spine that shapes slide sequencing and axis balance.

CRITICAL: You are planning an EXECUTIVE BRIEFING for analysts, not documentation.
Structure must support a NARRATIVE ARC with clear story progression.

${narrativeSpine ? `NARRATIVE SPINE (From NarrativeSpineAgent):
${JSON.stringify(narrativeSpine, null, 2).substring(0, 2000)}

USE THIS SPINE TO:
1. Establish market_tension as opening narrative
2. Inject ibm_differentiation thesis throughout proof slides
3. Prioritize proof_themes in order of narrative arc
4. Include ai_roadmap_12m as penultimate slide
5. Use memory_lines to shape key takeaway messaging
6. Respect slide_sequence_bias for AE vs CV balance
7. Flag gaps_and_theses in output for AR/Offering validation

AXIS BALANCE REQUIREMENT FOR PART ONE:
- Minimum 4 slides with axis="Execute" (Ability to Execute)
- Minimum 4 slides with axis="Vision" (Completeness of Vision)
- This ensures balanced coverage for both buyer personas` : ''}

NARRATIVE ARC FRAMEWORK (STORY SPINE - MANDATORY ORDER FOR PART ONE):
1. Market Context (set up tension and buyer pain points)
2. IBM Vision (differentiated POV anchored in AI-augmented operating models, composability, industry accelerators, risk reduction, time-to-value compression)
3. Execution Model (methodology maturity, repeatability, risk frameworks, QA/governance)
4. Platform/IP Advantage (IDCP, Garage, accelerators, AI/agentic capabilities)
5. Global Delivery Advantage (scale and talent industrialisation → outcomes)
6. Industry Strength (manufacturing, public sector, retail, life sciences, financial services)
7. Risk & Quality Engine (risk mitigation, architecture governance, customer success discipline)
8. AI Roadmap (near/mid-term milestones; agentic AI; productivity metrics with dates)
9. Takeaways framed against MQ axes (Ability to Execute vs Completeness of Vision)

AVAILABLE LAYOUTS:
- L1_Executive_Header: Executive summary with 6-8 key bullets (use for vision statements)
- L2_TwoColumn_Proof: Two columns (3-4 bullets each) + metric strip (3 metrics)
- L5_Metric_Tiles_3x1: Up to 3 large metric tiles with context (requires ACTUAL METRICS, not placeholders)
- L3_Case_Card_Grid: Case study overview (5 cards)
- L4_OneCase_DeepDive: Single case study deep dive
- L6_Table_2xN: Comparison table (capabilities vs proof)
- L7_Roadmap_Timeline: Timeline with milestones (requires dates/phases)
- L8_Risk_Mitigation: Risk assessment with mitigations
- L9_Partner_Ecosystem: Partner showcase

RULES:
1. Assign one layout per slide based on AVAILABLE DATA
2. Distribute facts across slides logically (group related facts)
3. Specify which facts go on which slide (by fact ID or category)
4. DO NOT write content - only plan structure
5. Ensure ${targetSlides} slides total
6. Match approved layouts only
7. Consider narrative arc: follow the STORY SPINE for Part One
8. CRITICAL: You MUST include slides for ALL "REQUIRED TOPICS" provided
9. For "Executive Summary" slide: mark it for VISION STATEMENT generation
10. Only use L5 if you have ACTUAL METRIC VALUES (numbers), not placeholders
11. Only use L7 if you have ACTUAL DATES/PHASES for timeline
12. Each slide MUST include explicit MQ axis tagging:
    - axis: "Execute" or "Vision"
    - criteria: one or more of:
      Ability to Execute → ["Service delivery quality", "Methodology maturity", "Talent scale", "Repeatability & industrialisation", "Risk mitigation", "Customer success discipline", "Internal enabling platforms"]
      Completeness of Vision → ["Market understanding", "Innovation roadmap", "Offering strategy", "Vertical/industry strategy", "Business model evolution", "AI/agentic roadmap", "Go-to-market strategy"]
13. MANDATORY: Avoid hype in topics/rationale; use analytical phrasing.
14. MANDATORY: Include "Good fit for..." statement on capability slides (e.g., "Good fit for manufacturers seeking rapid SAP S/4HANA implementations")
15. MANDATORY: If spine is provided, respect the unconfirmed_theses in gaps_and_theses - add notes to output if key claims lack confidence.

CRITICAL FOR PART ONE SECTIONS:

For "Part One: Vision and Execution" sections, structure should be:
1. **Executive Summary** slide (L1_Executive_Header) - Focus on:
   - Viability: Scale metrics (160K consultants, 65 countries)
   - Client success proof (90% retention rate)
   - Operational excellence
   - This slide establishes credibility and execution capability

2. **Vision Statement** slide (L1_Executive_Header) - Focus on:
   - IBM's unique market POV (how we differentiate)
   - Strategic direction (where we lead the market)
   - Memorable positioning vs competitors
   - This slide establishes strategic vision

3. **Proof/Capabilities** slides (L2_TwoColumn_Proof) - Focus on:
   - Centers of Excellence, partnerships, innovation hubs
   - How these enablers drive client outcomes
   - Specific capabilities with proof points

4. **Strategic Insights** slides (L2_TwoColumn_Proof, L6_Table) - Focus on:
   - Strengths & areas for improvement
   - Sweet spots & square pegs (client fit analysis)
   - Risk mitigation approaches
   - Shows market understanding

5. **Future Vision** slide (L7_Roadmap_Timeline) - EXPANDED with:
   - AI-augmented delivery capabilities and timeline
   - GenAI/Agentic AI adoption milestones
   - Productivity improvement narrative (55% → 62%)
   - Specific dates/quarters (2025, 2026)
   - Each milestone tied to client impact

MANDATORY FOR PART ONE: NO case studies or customer success stories
- Deliberately excluded for executive briefing format
- Part One is analyst briefing on IBM capabilities, not proof via client stories
- If customer proof is needed, use metrics and partnership indicators instead
- Example: "Our work with 500+ SAP S/4HANA implementations shows..."

NON-PART ONE SECTIONS: Case studies allowed if explicitly required or if topic is "Customer Success"
   - AI-augmented delivery roadmap
   - GenAI/Agentic AI capabilities
   - Productivity improvement trajectory (55% → 62%)
   - Innovation timeline with specific dates
   - This establishes forward-looking vision

CRITICAL: DO NOT include case studies in Part One unless explicitly required.
Case studies are left-behind material for asynchronous review.
Instead, focus on strategic narrative and proof of execution capability.

For roadmap slides: MUST include specific dates, metrics (productivity %), and AI innovations.
Generic "future vision" without concrete details = rejection.

If reference examples provided, match their structural patterns.`;

  const userPrompt = `Plan ${targetSlides} slides for: ${sectionName}

REQUIRED TOPICS (Must be covered):
${requiredTopics.length > 0 ? requiredTopics.map(t => `- ${t}`).join('\n') : 'No specific topic requirements'}

KEY POINTS TO COVER:
${keyPoints.length > 0 ? keyPoints.map(p => `- ${p}`).join('\n') : 'No specific key points'}

EXTRACTED FACTS:
${JSON.stringify(facts, null, 2).substring(0, 15000)}

${referenceExamples ? `\nREFERENCE EXAMPLES (2024 DECK):\n${referenceExamples.substring(0, 5000)}` : ''}

CRITICAL CONSTRAINTS - MUST FOLLOW EXACTLY:
1. Generate EXACTLY ${targetSlides} slides - NO MORE, NO LESS
2. slideNumber must go from 1 to ${targetSlides} ONLY
3. STOP after slide ${targetSlides} - do not continue past this number
4. For Part One sections, ensure axis balance: minimum 4 "Execute" slides + minimum 4 "Vision" slides
5. Include "Good fit for..." guidance on each capability slide
6. ALL property names must be double-quoted ("slideNumber", "layout", etc.)
7. ALL string values must be double-quoted, not single-quoted
8. Remove ALL trailing commas before closing brackets/braces
9. Do NOT wrap response in markdown code blocks (no \`\`\`json)
10. Close the JSON properly after the last slide

Return this exact structure with VALID JSON containing EXACTLY ${targetSlides} slides:
{
  "slides": [
    {
      "slideNumber": 1,
      "layout": "L1_Executive_Header",
      "topic": "Global Scale and Presence",
      "factsToInclude": ["scale[0]", "scale[1]", "scale[2]"],
      "rationale": "Opening slide showcasing breadth of capabilities",
      "axis": "Execute",
      "criteria": ["Talent scale", "Repeatability & industrialisation"],
      "goodFitFor": "Any global enterprise requiring delivery at scale across multiple regions"
    }
  ]
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
        temperature: 0.3, // Moderate temperature for creative planning
        max_tokens: 6000, // Increased to prevent truncation with 15 slides
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Structure Planning Agent failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    if (!content) {
      console.error('   ❌ Structure Planning Agent returned empty content');
      console.error('   Response data:', JSON.stringify(data, null, 2).substring(0, 500));
      return [];
    }
    
    // Check for truncation (incomplete JSON)
    const finishReason = data.choices[0].finish_reason;
    if (finishReason === 'length') {
      console.warn('   ⚠️  Response truncated due to token limit - attempting to complete JSON...');
      // Try to close the JSON properly
      if (!content.trim().endsWith('}')) {
        // Find the last complete slide
        const lastCompleteSlideMatch = content.lastIndexOf('},');
        if (lastCompleteSlideMatch > 0) {
          content = content.substring(0, lastCompleteSlideMatch + 1);
          content += '\n  ]\n}';
          console.log('   🔧 Truncated and closed JSON at last complete slide');
        }
      }
    }
    
    // Strip markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Debug output
    console.log('   📋 Structure Planning Agent response preview:', content.substring(0, 200));
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.warn('   ⚠️  Initial JSON parse failed, attempting repair...');
      console.warn('   Error:', parseError.message);
      console.warn('   Content length:', content.length, 'characters');
      
      // Common JSON repair strategies
      let repairedContent = content;
      
      // 1. Remove trailing commas before closing brackets/braces
      repairedContent = repairedContent.replace(/,(\s*[}\]])/g, '$1');
      
      // 2. Fix unquoted property names (common GPT-4o error)
      repairedContent = repairedContent.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // 3. Remove duplicate commas
      repairedContent = repairedContent.replace(/,+/g, ',');
      
      // 4. Fix missing commas between objects in arrays
      repairedContent = repairedContent.replace(/}\s*{/g, '},{');
      
      // 5. Ensure proper string escaping
      repairedContent = repairedContent.replace(/\\'/g, "'").replace(/([^\\])"/g, (match, p1) => {
        // Don't escape quotes that are already part of JSON structure
        return match;
      });
      
      try {
        parsed = JSON.parse(repairedContent);
        console.log('   ✅ JSON repair successful!');
      } catch (repairError) {
        console.error('   ❌ JSON repair failed:', repairError.message);
        console.error('   First 500 chars of content:', content.substring(0, 500));
        console.error('   Last 500 chars of content:', content.substring(content.length - 500));
        
        // Last resort: try to extract just the slides array if it's embedded
        const slidesMatch = content.match(/"slides"\s*:\s*\[([\s\S]*)\]/);
        if (slidesMatch) {
          console.log('   🔧 Attempting to extract slides array directly...');
          try {
            parsed = { slides: JSON.parse('[' + slidesMatch[1] + ']') };
            console.log('   ✅ Successfully extracted slides array!');
          } catch (extractError) {
            console.error('   ❌ Could not extract slides array');
            throw new Error(`JSON parse failed and repair unsuccessful: ${parseError.message}`);
          }
        } else {
          throw new Error(`JSON parse failed and repair unsuccessful: ${parseError.message}`);
        }
      }
    }
    
    // Handle both array and object with "slides" property
    const result = Array.isArray(parsed) ? parsed : (parsed.slides || []);
    console.log(`   📋 Returning ${result.length} slide plans`);
    return result;
  });
}
