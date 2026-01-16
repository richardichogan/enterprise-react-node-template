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
 * @param {Object} options - Agent options
 * @param {Array<string>} options.checkCriteria - What to validate (default: all)
 * @returns {Promise<Object>} - Validation report with pass/fail and specific issues
 */
export async function validateQuality(input, options = {}) {
  const { slide, referenceExamples = '', originalFacts = {} } = input;
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

  const systemPrompt = `You are a quality validation agent.
Your ONLY job is to review content and report issues - you do NOT fix them.

VALIDATION CRITERIA:
1. Citation Accuracy: Every bullet must have [From: source] citation
2. Data Specificity: Every bullet must include specific numbers, dates, or names
3. Generic Content: Flag any vague/generic phrases ("extensive expertise", "comprehensive")
4. Fact Verification: All data must match original facts (no hallucinations)
5. Structure Compliance: Slide must match required layout contract
6. Quality Comparison: Content depth/style should match 2024 reference examples

For each issue found, provide:
- Issue type (from criteria above)
- Location (bullet number, field name)
- Specific problem
- Suggested fix

Return structured validation report.`;

  const userPrompt = `Validate this slide against quality standards:

SLIDE TO VALIDATE:
${JSON.stringify(slide, null, 2)}

ORIGINAL FACTS (verify no hallucinations):
${JSON.stringify(originalFacts, null, 2).substring(0, 10000)}

${referenceExamples ? `\nQUALITY BENCHMARK (2024 DECK):\n${referenceExamples.substring(0, 3000)}` : ''}

CHECK THESE CRITERIA: ${checkCriteria.join(', ')}

Return ONLY valid JSON:
{
  "slideTitle": "${slide.title}",
  "overallPass": true|false,
  "score": 0-100,
  "issues": [
    {
      "criterion": "citation_accuracy",
      "severity": "critical|warning|info",
      "location": "content.key_bullets[2]",
      "problem": "Missing source citation",
      "suggestedFix": "Add [From: document name] to bullet",
      "example": "160,000 consultants [From: IBM RFI Response 2026]"
    }
  ],
  "strengths": [
    "Specific metrics used throughout",
    "Clear narrative structure"
  ],
  "comparisonTo2024": "Matches depth and specificity of 2024 examples" | "Falls short of 2024 quality"
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
 * @returns {Promise<Object>} - Aggregate validation report
 */
export async function validateBatch(slides, referenceExamples, originalFacts) {
  const results = [];
  
  for (const slide of slides) {
    try {
      const validation = await validateQuality({
        slide,
        referenceExamples,
        originalFacts
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
