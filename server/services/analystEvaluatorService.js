/**
 * Analyst Evaluator Service
 * Scores vendor responses against Gartner Magic Quadrant (MQ) evaluation criteria
 * Supports Cloud ERP Services and other analyst framework assessments
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
const API_BASE = process.env.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';

/**
 * Evaluate a vendor response against analyst criteria
 * @param {string} analystQuestion - The exact analyst question
 * @param {string} vendorResponse - The vendor's written response
 * @param {string} analyst - Framework (e.g., 'Gartner', 'Forrester', 'IDC')
 * @param {string} aiModel - AI model to use for evaluation
 * @returns {Promise<Object>} Structured evaluation with scores and feedback
 */
export const evaluateVendorResponse = async (
  analystQuestion,
  vendorResponse,
  analyst = 'Gartner',
  aiModel = 'global/gpt-4o'
) => {
  console.log('📊 [ANALYST EVALUATOR] Starting response evaluation...');
  console.log(`   Framework: ${analyst}`);
  console.log(`   Question length: ${analystQuestion.length} chars`);
  console.log(`   Response length: ${vendorResponse.length} chars`);

  try {
    // Build evaluation prompt for each dimension
    const evaluationPrompt = buildEvaluationPrompt(
      analystQuestion,
      vendorResponse,
      analyst
    );

    const requestBody = {
      model: aiModel,
      messages: [
        {
          role: 'system',
          content: `You are an expert Analyst Relations (AR) evaluator specializing in ${analyst} assessments. 
Your task is to score vendor responses against specific evaluation criteria with precision, providing evidence-based justifications.
Output MUST be valid JSON with no markdown formatting.`
        },
        {
          role: 'user',
          content: evaluationPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' }
    };

    console.log('📤 Sending evaluation request...');
    console.log(`   Endpoint: ${API_BASE}/apis/v3/chat/completions`);
    console.log(`   Model: ${aiModel}`);
    console.log(`   Token available: ${SERVICE_TOKEN ? 'Yes' : 'No'}`);

    const response = await fetch(`${API_BASE}/apis/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error (${response.status}): ${errorText}`);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let evaluationJSON = data.choices[0].message.content;

    // Clean up response if wrapped in markdown
    evaluationJSON = evaluationJSON
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const evaluation = JSON.parse(evaluationJSON);

    console.log('✅ Evaluation completed');
    console.log(`   Framework: ${evaluation.framework || analyst}`);
    console.log(`   Dimensions: ${evaluation.totalDimensions || 10}`);
    console.log(`   Total score: ${evaluation.totalScore}/${(evaluation.totalDimensions || 10) * 5}`);

    return {
      evaluation,
      model: data.model,
      tokensUsed: data.usage?.total_tokens || 0
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('❌ Error evaluating vendor response:', errorMsg);
    throw error;
  }
};

/**
 * Build the evaluation prompt for the AI model
 */
function buildEvaluationPrompt(question, response, analyst) {
  const frameworkContext = getFrameworkContext(analyst);
  const criteria = getFrameworkCriteria(analyst);
  
  // Build dimensions list for the prompt
  const dimensionsList = criteria.dimensions
    .map((d, idx) => `${idx + 1}. **${d.name}** - ${d.description}\n   Focus: ${d.evaluationFocus}`)
    .join('\n');

  return `${frameworkContext}

### Evaluation Dimensions for This Assessment

${dimensionsList}

### Analyst Question
${question}

### Vendor Response
${response}

### Your Task
Score this response across ${criteria.dimensions.length} framework-specific dimensions (0-5 each). For EACH dimension, provide:
1. score: 0-5
2. evidence: Quoted text snippets from the response that support the score
3. reasoning: Brief explanation of why this score was given
4. gaps: Key missing elements (if any)

Return ONLY valid JSON in this exact structure:
{
  "framework": "${criteria.framework}",
  "totalDimensions": ${criteria.dimensions.length},
  "dimensions": [${criteria.dimensions.map((d, idx) => `
    {
      "name": "${d.name}",
      "score": 0,
      "evidence": ["quote 1"],
      "reasoning": "...",
      "gaps": []
    }${idx < criteria.dimensions.length - 1 ? ',' : ''}`).join('')}
  ],
  "totalScore": 0,
  "verdict": "One-paragraph summary of overall quality and readiness.",
  "gapAnalysis": ["missing element 1", "missing element 2"],
  "rewriteSuggestions": [
    "Suggestion 1: ...",
    "Suggestion 2: ...",
    "Suggestion 3: ..."
  ],
  "complianceNotes": "Observations on terminology, format, and RFI best practices for ${analyst}."
}

Grade strictly and provide evidence. No inflated scores. Calculate totalScore as sum of all dimension scores.`;
}

/**
 * Get framework-specific evaluation criteria
 */
function getFrameworkCriteria(analyst) {
  const criteria = {
    'Gartner': {
      framework: 'Gartner Magic Quadrant for Cloud ERP Services',
      dimensions: [
        {
          name: 'Direct Answer Check',
          description: 'Does the response explicitly and completely answer the analyst question?',
          evaluationFocus: 'Completeness, clarity, relevance'
        },
        {
          name: 'Ability to Execute - Products/Services',
          description: 'Clear articulation of Cloud ERP services delivery (assessment → implementation → evolution)',
          evaluationFocus: 'Service scope, delivery methodology, technical scope'
        },
        {
          name: 'Ability to Execute - Viability & Operations',
          description: 'Financial strength, operational maturity, change management, customer support SLAs',
          evaluationFocus: 'Business viability, operational excellence, risk mitigation'
        },
        {
          name: 'Ability to Execute - Sales & Marketing',
          description: 'Sales execution, pricing models, market responsiveness, marketing effectiveness',
          evaluationFocus: 'Go-to-market strategy, pricing clarity, market alignment'
        },
        {
          name: 'Completeness of Vision - Market Understanding',
          description: 'Demonstrates understanding of Cloud ERP market trends, customer needs, competitive landscape',
          evaluationFocus: 'Market insight, trend awareness, customer pain points'
        },
        {
          name: 'Completeness of Vision - Strategy',
          description: 'Sales strategy, offering strategy, vertical/industry strategy, geographic strategy',
          evaluationFocus: 'Strategic positioning, market targeting, differentiation'
        },
        {
          name: 'Completeness of Vision - Innovation & Roadmap',
          description: 'Innovation capability, product roadmap, emerging tech (GenAI, low-code), future direction',
          evaluationFocus: 'Forward-looking capability, technology adoption, vision clarity'
        },
        {
          name: 'Evidence Quality & Proof Points',
          description: 'Quantified outcomes (KPIs, % improvements, cost savings), named client references, timeframes',
          evaluationFocus: 'Metrics rigor, case study specificity (industry/region/scale), before/after data'
        },
        {
          name: 'Risk, Governance & Compliance',
          description: 'Data migration controls, change management, GenAI governance, compliance posture',
          evaluationFocus: 'Risk awareness, mitigation strategies, control frameworks'
        },
        {
          name: 'Credibility, Differentiation & Format',
          description: 'Clear differentiation vs. competitors, overclaim flags, terminology precision, RFI compliance',
          evaluationFocus: 'Unique positioning, transparency, professional format, accuracy'
        }
      ]
    },
    'Forrester': {
      framework: 'Forrester Wave Assessment',
      dimensions: [
        {
          name: 'Current Offering Strategy & Execution',
          description: 'Product capabilities, delivery model, feature set, solution maturity',
          evaluationFocus: 'What is offered now, how mature, execution track record'
        },
        {
          name: 'Strategy - Market & Customer Focus',
          description: 'Understanding of customer needs, market trends, customer value delivery',
          evaluationFocus: 'Market insights, customer outcomes emphasis, strategic clarity'
        },
        {
          name: 'Market Presence & Momentum',
          description: 'Customer base, revenue trajectory, customer satisfaction (NPS/CSAT), market share',
          evaluationFocus: 'Growth indicators, customer traction, competitive momentum'
        },
        {
          name: 'Go-to-Market & Sales Execution',
          description: 'Sales effectiveness, channel strategy, pricing, customer acquisition success',
          evaluationFocus: 'Sales rigor, GTM clarity, customer win rates'
        },
        {
          name: 'Business Outcomes & ROI Focus',
          description: 'Emphasis on measurable business value, ROI, TCO, risk reduction',
          evaluationFocus: 'Outcomes orientation, business metrics, value quantification'
        },
        {
          name: 'Customer Experience & Support',
          description: 'Customer success programs, support quality, onboarding, ongoing enablement',
          evaluationFocus: 'Support SLAs, customer satisfaction, success metrics'
        },
        {
          name: 'Roadmap & Innovation',
          description: 'Product roadmap clarity, innovation direction, emerging capabilities',
          evaluationFocus: 'Future capabilities, innovation pace, strategic direction'
        },
        {
          name: 'Financial Viability & Sustainability',
          description: 'Revenue stability, profitability, growth investment, long-term viability',
          evaluationFocus: 'Financial health, sustainability indicators, growth investment'
        },
        {
          name: 'Evidence & References',
          description: 'Quantified customer outcomes, named references, timeframes, case study specificity',
          evaluationFocus: 'Proof points rigor, reference credibility, outcome metrics'
        },
        {
          name: 'Transparency & Risk Awareness',
          description: 'Candid discussion of limitations, risk mitigation, realistic claims',
          evaluationFocus: 'Honesty, balanced positioning, risk acknowledgment'
        }
      ]
    },
    'IDC': {
      framework: 'IDC MarketScape Assessment',
      dimensions: [
        {
          name: 'Direct Answer Completeness',
          description: 'Fully addresses the analyst question with relevant detail',
          evaluationFocus: 'Answer completeness, relevance, specificity'
        },
        {
          name: 'Overall Market Presence',
          description: 'Customer base size, revenue scale, market share, global/regional coverage',
          evaluationFocus: 'Market penetration, customer count, geographic reach'
        },
        {
          name: 'Product/Service Capabilities',
          description: 'Core competencies, solution breadth, technical maturity, integration capabilities',
          evaluationFocus: 'Feature depth, breadth of offerings, technical sophistication'
        },
        {
          name: 'Viability & Financial Strength',
          description: 'Financial health, funding, growth trajectory, long-term viability',
          evaluationFocus: 'Financial stability, investment capacity, sustainability'
        },
        {
          name: 'Market Understanding & Strategy',
          description: 'Insights into market dynamics, customer needs, competitive positioning',
          evaluationFocus: 'Market acumen, strategic clarity, competitive awareness'
        },
        {
          name: 'Vertical/Industry Coverage',
          description: 'Deep capabilities in target industries, vertical-specific solutions',
          evaluationFocus: 'Industry expertise, vertical specialization, relevant experience'
        },
        {
          name: 'Geographic Strategy & Presence',
          description: 'Global reach, regional focus, local partnerships, market coverage',
          evaluationFocus: 'Geographic footprint, regional strategy, expansion plans'
        },
        {
          name: 'Customer Success & References',
          description: 'Named customer references, case studies with metrics, customer satisfaction indicators',
          evaluationFocus: 'Reference quality, outcome metrics, customer validation'
        },
        {
          name: 'Innovation & Roadmap',
          description: 'R&D investment, emerging tech adoption (AI, cloud-native), future direction',
          evaluationFocus: 'Innovation pace, technology adoption, forward vision'
        },
        {
          name: 'Governance & Risk Posture',
          description: 'Compliance, security, data governance, risk management practices',
          evaluationFocus: 'Risk awareness, compliance rigor, governance frameworks'
        }
      ]
    }
  };

  return criteria[analyst] || criteria['Gartner']; // Default to Gartner
}

/**
 * Get framework-specific context for evaluation
 */
function getFrameworkContext(analyst) {
  const contexts = {
    'Gartner': `You are evaluating for **Gartner's Magic Quadrant for Cloud ERP Services**.

Key Assessment Areas:
- **Ability to Execute**: Products/services, viability, sales execution/pricing, market responsiveness, marketing execution, customer experience, operations
- **Completeness of Vision**: Market understanding, marketing strategy, sales strategy, offering strategy, business model, vertical/industry strategy, innovation, geographic strategy

Cloud ERP **services** vendors must demonstrate: assessment capabilities, implementation expertise (SaaS + PaaS), change management, data transformation, and ongoing managed services/evolution.`,

    'Forrester': `You are evaluating for **Forrester Wave assessments**.

Key Assessment Areas:
- **Current offering** strategy and execution
- **Strategy** for market penetration and customer value delivery
- **Presence** in key customer segments and geographies
- Emphasis on **business outcomes** and **customer experience**
- Financial viability and market momentum`,

    'IDC': `You are evaluating for **IDC MarketScape assessments**.

Key Assessment Areas:
- **Market presence** and customer base
- **Viability and financial strength**
- **Product/service capabilities** and roadmap
- **Market understanding** and **strategic direction**
- **Go-to-market** and **customer success** capabilities
- Geographic and vertical coverage`,

    'default': `You are evaluating a vendor response for analyst consideration.

Key Assessment Areas:
- **Completeness** of answering the analyst's question
- **Evidence quality** (metrics, named references, timeframes)
- **Differentiation** vs. competitors
- **Credibility** and transparency
- **Strategic alignment** with market trends
- **Risk and governance** posture`
  };

  return contexts[analyst] || contexts['default'];
}

export { getFrameworkCriteria };

export default {
  evaluateVendorResponse
};
