/**
 * Quality Validation Agent
 * Reviews generated slides against quality standards and 2024 reference
 * This agent ONLY validates - it does NOT fix issues (returns actionable feedback)
 * 
 * Reusable across any project that needs content quality validation
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
 * Validate slide quality against standards
 * 
 * @param {Object} input - Input data
 * @param {Object} input.slide - Generated slide to validate
 * @param {string} input.referenceExamples - 2024 deck examples as quality benchmark
 * @param {Object} input.originalFacts - Original facts used (to verify no hallucinations)
 * @param {Object} input.narrativeSpine - Strategic narrative spine for coherence validation
 * @param {Object} options - Agent options
 * @param {Array<string>} options.checkCriteria - What to validate (default: all)
 * @returns {Promise<Object>} - Validation report with pass/fail and specific issues
 */
export async function validateQuality(input, options = {}) {
  const { slide, referenceExamples = '', originalFacts = {}, narrativeSpine = null } = input;
  const { 
    checkCriteria = [
      'citation_accuracy',
      'data_specificity', 
      'generic_content',
      'fact_verification',
      'structure_compliance',
      'quality_comparison'
    ]
  } = options;

  const systemPrompt = `You are a quality validation agent for analyst briefing presentations.
Your ONLY job is to review content and report issues - you do NOT fix them.

CRITICAL VALIDATION RULES (AUTO-REJECT if ANY fail):

1. EMPTY CONTENT CHECK:
   - FAIL if any text field is empty or <50 characters (intro, key_bullets, left_bullets, right_bullets)
   - FAIL if intro is missing or generic
   - FAIL if bullet arrays are empty

2. PLACEHOLDER DETECTION:
   - FAIL if tiles contain "Tile N" pattern instead of actual metric labels/values
   - FAIL if content contains "{TO_FILL}", "TBD", "pending", "placeholder"
   - FAIL if evidence states "No specific sources" or "not available"

3. CONTENT QUALITY:
   - FAIL if bullets are <100 characters (too thin)
   - FAIL if 70%+ similarity between bullets (repetitive)
   - FAIL if generic phrases without proof: "extensive", "comprehensive", "strategic" alone
   - FAIL if documentation language: "This slide shows", "The following outlines"

4. DATA VALIDATION:
   - FAIL if tiles/metrics have no numeric values
   - FAIL if tables have <2 populated rows with distinct data
   - FAIL if timelines have no dates/phases
   - FAIL if case studies have no outcomes/metrics

5. EXECUTIVE BRIEFING STYLE:
   - WARN if >50% passive voice detected
   - WARN if >2 citations visible in slide content (should be in speaker notes)
   - WARN if reads like documentation, not conversation

6. FACT VERIFICATION:
   - All data must trace to original facts (no hallucinations)
   - Metrics must match source documents

7. NARRATIVE COHERENCE:
${narrativeSpine ? `
   - WARN if content doesn't reference market_tension: "${narrativeSpine.market_tension || 'N/A'}"
   - WARN if content doesn't reinforce ibm_differentiation: "${narrativeSpine.ibm_differentiation || 'N/A'}"
   - WARN if content doesn't align with proof_themes: ${(narrativeSpine.proof_themes || []).map(t => t.theme).join(', ')}
   - WARN if language pattern doesn't match memory_lines (AE: "${(narrativeSpine.memory_lines?.ae || [''])[0]}", CV: "${(narrativeSpine.memory_lines?.cv || [''])[0]}")
   - Content should feel like part of cohesive narrative, not isolated slide
` : '   No narrative spine available - skip coherence validation.\n'}

SCORING:
- Start at 100 points
- Empty content: -50 points (auto-fail)
- Placeholders: -40 points (auto-fail)
- Thin content (<100 chars/bullet): -20 points
- Repetition: -15 points
- Generic phrases: -10 points each
- Documentation tone: -10 points
- Passive voice: -5 points
- Pass threshold: 60 points

Return structured validation report with actionable feedback.`;

  const userPrompt = `Validate this slide against quality standards:

SLIDE TO VALIDATE:
${JSON.stringify(slide, null, 2)}

ORIGINAL FACTS (verify no hallucinations):
${JSON.stringify(originalFacts, null, 2).substring(0, 10000)}

${referenceExamples ? `\nQUALITY BENCHMARK (2024 DECK):\n${referenceExamples.substring(0, 3000)}` : ''}

CHECK THESE CRITERIA: ${checkCriteria.join(', ')}

CRITICAL CHECKLIST - FAIL slide if ANY condition is true:
1. Any text field (intro, bullets) is empty or <50 characters
2. Tiles contain "Tile N" instead of actual labels/values
3. Evidence states "No specific sources" or similar
4. Tables have <2 populated rows
5. Bullets <100 characters or >70% similar to each other
6. Generic phrases: "strategic", "robust", "comprehensive" without supporting data
7. Contains "{TO_FILL}", "TBD", placeholders
8. Documentation language: "This slide shows", "outlines", "describes"

Return ONLY valid JSON:
{
  "slideTitle": "${slide.title}",
  "overallPass": true|false,
  "score": 0-100,
  "autoReject": true|false,
  "autoRejectReason": "Empty content detected in key_bullets field" | null,
  "issues": [
    {
      "criterion": "empty_content|placeholder_data|thin_content|repetition|generic_phrases|documentation_tone|passive_voice|fact_verification",
      "severity": "critical|warning|info",
      "location": "content.key_bullets[2] or 'intro' or 'tiles[0]'",
      "problem": "Specific description of the issue",
      "suggestedFix": "Actionable fix recommendation",
      "example": "Example of correct format if applicable"
    }
  ],
  "strengths": [
    "Specific metrics used throughout",
    "Executive briefing tone"
  ],
  "recommendation": "approve|regenerate|manual_review"
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
        temperature: 0.2, // Low temperature for consistent validation
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Quality Validation Agent failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  });
}

/**
 * Batch validate multiple slides
 * @param {Array<Object>} slides - Array of slides to validate
 * @param {string} referenceExamples - 2024 deck examples
 * @param {Object} originalFacts - Original facts
 * @param {Object} narrativeSpine - Strategic narrative spine for coherence validation
 * @returns {Promise<Object>} - Aggregate validation report
 */
export async function validateBatch(slides, referenceExamples, originalFacts, narrativeSpine = null) {
  const results = [];
  
  for (const slide of slides) {
    try {
      const validation = await validateQuality({
        slide,
        referenceExamples,
        originalFacts,
        narrativeSpine // Pass spine for narrative coherence checks
      });
      results.push(validation);
    } catch (error) {
      results.push({
        slideTitle: slide.title,
        overallPass: false,
        error: error.message
      });
    }
  }
  
  const passCount = results.filter(r => r.overallPass).length;
  const avgScore = results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length;
  
  return {
    totalSlides: slides.length,
    passedSlides: passCount,
    passRate: (passCount / slides.length * 100).toFixed(1) + '%',
    averageScore: avgScore.toFixed(1),
    slideResults: results
  };
}
