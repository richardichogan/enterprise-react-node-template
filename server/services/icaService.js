/**
 * Azure OpenAI Service (formerly ICA Service)
 * Provides AI-powered RFI response generation with Azure AI Search RAG grounding
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { retrieveDocumentContext } from './documentProcessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Azure OpenAI configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

// Legacy ICA configuration (kept for potential fallback)
const API_BASE = process.env.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
const ROO_TOKEN = process.env.IBM_ICA_ROO_TOKEN;
const COLLECTION_ID = process.env.IBM_ICA_COLLECTION_ID;
const COLLECTION_NAME = process.env.IBM_ICA_COLLECTION_NAME;
const SEARCH_TOKEN = ROO_TOKEN || SERVICE_TOKEN;

console.log('🔧 Azure OpenAI Service initialized');
console.log('🤖 AZURE_OPENAI_ENDPOINT:', AZURE_OPENAI_ENDPOINT?.substring(0, 50) + '...' || 'MISSING');
console.log('📦 AZURE_OPENAI_DEPLOYMENT:', AZURE_OPENAI_DEPLOYMENT);
console.log('🔑 AZURE_OPENAI_API_KEY length:', AZURE_OPENAI_API_KEY?.length || 'MISSING');
console.log('📚 COLLECTION_NAME:', COLLECTION_NAME || 'NOT CONFIGURED');

/**
 * Search document collection for relevant context
 * REVERTED to Azure Blob Storage RAG - ICA Sidekick AI blocked on token permissions
 */
async function searchDocumentCollection(query) {
  console.log(`🔍 ICA document collection search disabled (token permission issues)`);
  console.log(`📦 Using Azure Blob Storage RAG instead...`);
  
  // Use Azure Blob Storage document retrieval
  try {
    const context = await retrieveDocumentContext(query);
    return context;
  } catch (error) {
    console.error('❌ Azure Blob Storage error:', error);
    return null;
  }
}

/**
 * Get analyst-specific prompting guidance
 * Shapes response structure and tone based on analyst framework
 */
function getAnalystGuidance(analyst) {
  const frameworks = {
    'Gartner': {
      framework: 'Magic Quadrant',
      structure: `Structure your answer to address competitive positioning:
- Highlight IBM Consulting's strategic positioning vs competitors in your market segment
- Include qualitative differentiation on vision and execution capability
- Reference platform maturity (D365 roadmap, security capabilities, integration breadth)
- Use competitive language ("leaders", "differentiation", "strategic advantage")`,
      tone: 'Strategic, competitive, positioned for executive decision-making'
    },
    'Forrester': {
      framework: 'Wave / Customer Outcomes',
      structure: `Structure your answer to emphasise customer outcomes and business transformation:
- Lead with customer impact metrics (revenue growth, cost reduction, time-to-market)
- Outline methodology for measuring success (KPIs, maturity models, benchmarks)
- Connect to customer journey and change enablement
- Emphasise modernisation and customer engagement benefits`,
      tone: 'Outcome-focused, customer-centric, measurable ROI-driven'
    },
    'IDC': {
      framework: 'Market Sizing / TCO',
      structure: `Structure your answer to address market opportunity and cost-benefit:
- Quantify market segments, TAM/SAM, growth rates where relevant
- Include total cost of ownership or cost reduction narrative
- Reference market share implications or competitive positioning
- Provide deployment scalability and roadmap implications`,
      tone: 'Data-driven, market-focused, quantified impact'
    },
    'Magic Quadrant': {
      framework: 'MQ Positioning',
      structure: `Structure your answer to demonstrate capability and vision alignment:
- Address execution capability and vision completeness
- Include feature/functionality depth and strategic alignment
- Demonstrate platform roadmap and innovation commitment
- Connect product capabilities to customer outcomes`,
      tone: 'Comprehensive, capability-focused, visionary'
    }
  };
  
  return frameworks[analyst] || {
    framework: 'Generic RFI',
    structure: 'Answer comprehensively and directly, supporting claims with evidence.',
    tone: 'Professional, clear, outcome-focused'
  };
}

/**
 * Extract sections from response (marked by ##, #, or numbered lines)
 * For Multi-Section answers, enforce character limit per section
 */
function extractSections(response) {
  const sections = [];
  const lines = response.split('\n');
  let currentSection = { heading: '', content: [] };
  
  for (const line of lines) {
    // Detect section headers (##, ###, or numbered like "1.", "A.", etc)
    if (line.match(/^#+\s/) || line.match(/^\d+\.\s/) || line.match(/^[A-Z]\.\s/)) {
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { heading: line, content: [] };
    } else if (line.trim()) {
      currentSection.content.push(line);
    }
  }
  
  if (currentSection.content.length > 0) {
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * Reconstruct response from sections
 */
function reconstructFromSections(sections) {
  return sections.map(s => {
    const parts = [];
    if (s.heading) parts.push(s.heading);
    if (s.content.length > 0) parts.push(s.content.join('\n'));
    return parts.join('\n');
  }).join('\n\n');
}

/**
 * Check and enforce character limits for Multi-Section responses
 */
function checkSectionLimits(response, characterLimit, answerType) {
  if (!characterLimit || answerType !== 'Multi-Section') {
    return { valid: response.length <= characterLimit, sections: null };
  }
  
  const sections = extractSections(response);
  const violations = sections.map((s, i) => {
    const sectionLength = (s.heading ? s.heading.length + 1 : 0) + s.content.join('\n').length;
    return {
      index: i,
      heading: s.heading || `Section ${i + 1}`,
      length: sectionLength,
      valid: sectionLength <= characterLimit
    };
  }).filter(s => !s.valid);
  
  return {
    valid: violations.length === 0,
    sections,
    violations
  };
}


/**
 * Generate RFI response using IBM ICA Chat Completions API
 * Supports both Azure Blob Storage RAG and ICA Document Collection
 */
export async function generateRFIResponse(question, context = '', useDocumentCollection = false, characterLimit = null, useAzureBlob = true, documentNamesParam = [], aiModel = null, analyst = '', answerType = 'Single') {
  try {
    let groundingContext = '';
    let usedDocumentCollection = false;
    let usedDocuments = [];
    
    // Use Azure Blob Storage RAG for document grounding (currently more reliable)
    if (useAzureBlob) {
      // Prefer explicit list passed from caller; fall back to context parsing for compatibility
      const documentNames = (documentNamesParam && documentNamesParam.length > 0)
        ? documentNamesParam
        : (() => {
            const docMatch = context.match(/Available Documents \(all will be considered\): ([^\n]+)/);
            return docMatch ? docMatch[1].split(',').map(d => d.trim()) : [];
          })();
      console.log('🧾 [STAGE 1/6] Documents loaded from project');
      console.log('   Documents:', documentNames.length, documentNames.slice(0, 5));
      
      if (documentNames.length > 0) {
        console.log('📚 [STAGE 2/6] Extracting text from documents...');
        console.log('   Processing:', documentNames.length, 'document(s)');
        // retrieveDocumentContext will:
        // 1. Load ALL provided documents
        // 2. Extract and chunk text from each
        // 3. Score all chunks against the question
        // 4. Return top-N most relevant chunks regardless of source document
        // 5. Track which documents contributed to the final context
        const result = await retrieveDocumentContext(documentNames, question, 5);
        groundingContext = result.context;
        usedDocuments = result.usedDocuments;  // Array of document names that contributed chunks
        if (groundingContext) {
          console.log('🔍 [STAGE 3/6] Relevance scoring complete');
          console.log(`✅ Retrieved context from ${usedDocuments.length} document(s): ${usedDocuments.join(', ')}`);
          usedDocumentCollection = false;
        }
      } else {
        console.log('⚠️  No documents were parsed from context; skipping RAG retrieval');
      }
    }
    // Alternative: Use ICA Gartner Collection (currently has auth issues)
    else if (useDocumentCollection && COLLECTION_ID) {
      console.log(`🔍 Attempting to search ICA Document Collection: "${COLLECTION_NAME}"...`);
      groundingContext = await searchDocumentCollection(question);
      if (groundingContext) {
        console.log('✅ ICA Document collection context retrieved successfully');
        usedDocumentCollection = true;
        usedDocuments = [COLLECTION_NAME];
      } else {
        console.log('⚠️  ICA Document collection search returned no results or failed');
      }
    }
    
    console.log('⚙️  [STAGE 4/6] Building system prompt...');
    
    // Get analyst-specific guidance
    const analystGuidance = getAnalystGuidance(analyst);
    
    // Build the prompt with grounding
    const systemPrompt = `# Mission
Generate submission-ready answers for analyst RFIs and MQ questionnaires that are accurate, concise, defensible, and clearly differentiated for IBM Consulting. Prioritise Microsoft Dynamics 365 ERP (Finance, SCM, HR) when specified, and adapt to SAP/Oracle/Workday contexts as required.

# CRITICAL: Always Generate Complete Responses
- NEVER refuse to answer or claim insufficient information
- Use provided document context when available
- Draw on general knowledge of IBM Consulting's capabilities, methodologies, and industry positioning
- Reference IBM's publicly known differentiators (ICA, IBM Garage, NextGen Managed Services, partnership with Microsoft)
- Focus on outcomes, methodology, and value delivery patterns that are consistent with IBM Consulting's approach
- If specific metrics aren't available from documents, describe assurance methods (governance, benchmarking, controlled rollouts)

# Analyst Framework: ${analystGuidance.framework}${analyst ? ` (${analyst})` : ''}
**Tone**: ${analystGuidance.tone}

**Response Structure**:
${analystGuidance.structure}

# Format & Structure
- Use clear section headings (## Heading) to organise content logically.
- Write in paragraphs, not bullet points unless unavoidable.
- Lead with the direct answer in the first section.
- Maximum 3–4 sections; each section 2–3 sentences unless depth is required.
${characterLimit ? `- CRITICAL: Your response must be under ${characterLimit} characters. Plan content to fit.` : ''}

# Tone & Style
Professional, concise, outcome-focused. UK English spelling and grammar. Short sentences; minimal jargon. Avoid hype and vague words (e.g., "transformational", "robust"). Use specific action verbs (accelerates, optimises, predicts, assures, governs).

# Directness & Relevance
- Lead with the direct answer in the first sentence.
- Tie every element to measurable business outcomes (e.g., % improvement, time-to-value reduction, defect reduction).
- Include platform-specific detail where relevant (D365 Finance/SCM/HR; Microsoft-native tools like Copilot, Power BI, Azure IoT).

# Evidence & Citations
- Prefer quantified outcomes from delivery benchmarks or anonymised case data; where public sources are used, include compact footnotes (recent and relevant).
- If metrics are unavailable, state the assurance method (e.g., controlled rollout, benchmarked accelerators, governance reviews).

# IBM Differentiators (use only when relevant; never force)
- IBM Consulting Advantage (ICA) and ICA4AA agentic accelerators for asset-enabled delivery.
- IBM Garage for co-creation and Rapid Discovery; design thinking integrated with measurable KPIs.
- NextGen Managed Services for continuous optimisation and quarterly release adoption.
- Governance and control plane alignment with Microsoft security stack (Purview, Entra) and agent management patterns.

# Governance Emphasis
Explicitly show how AI, automation, and Copilot integration are governed:
- Access, data protection, auditability, and policy enforcement (Purview/Entra).
- Change management and sentiment analytics embedded through delivery.
- Continuous improvement loop post go-live (automated telemetry, KPI tracking, managed releases).

# QA Checklist
Before finalising:
- Direct answer in first sentence?
- Correct format and character limits respected?
- Outcomes quantified (% improvement, time-to-value reduction)?
- IBM differentiators included naturally (ICA, Garage, NextGen)?
- Governance and compliance hooks present (Purview, Entra, policy assurance)?
- Tone: professional, concise, UK English, free of hype?
- Platform specifics accurate (D365 modules, Copilot, Power BI)?
- Footnotes or source cues included if metrics used?
- Aligned with analyst framework (${analystGuidance.framework})?
- Explains why IBM approach is distinct?`;

    const lengthConstraint = characterLimit
      ? answerType === 'Multi-Section'
        ? `\n\nNote: Provide multiple detailed sections (3-5 sections recommended). Each section should be approximately ${characterLimit} characters - do NOT limit the total response length. Write each section fully and thoroughly.`
        : `\n\nNote: Target response length is approximately ${characterLimit} characters. Write a complete, thorough response.`
      : '';

    const userPrompt = `${context ? `${context}\n` : ''}${groundingContext}Question: ${question}${lengthConstraint}

Please provide a submission-ready RFI response that addresses the question thoroughly, following all guidelines above.`;

    console.log('🤖 [STAGE 5/6] Sending to Azure OpenAI...');
    console.log('   Deployment:', AZURE_OPENAI_DEPLOYMENT);
    console.log('   Answer type:', answerType);
    console.log('   Character limit:', characterLimit || 'none');
    
    // For Multi-Section, allow more tokens since each section is independent
    // Assume ~3 sections as baseline for token budgeting
    const tokenBudgetMultiplier = answerType === 'Multi-Section' ? 3 : 1;
    const maxTokens = characterLimit
      ? Math.min(4000, Math.ceil((characterLimit * tokenBudgetMultiplier) / 3))
      : 4000;

    const requestBody = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: maxTokens
    };
    
    const azureUrl = `${AZURE_OPENAI_ENDPOINT}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`;
    console.log('📤 Sending request to Azure OpenAI');
    
    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'api-key': AZURE_OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('✅ Response received from Azure OpenAI');
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Azure OpenAI API Error Status:', response.status);
      console.error('❌ Azure OpenAI API Error Body:', errorText);
      throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      console.error('❌ Invalid Azure OpenAI response structure:', JSON.stringify(data));
      throw new Error('Invalid response structure from Azure OpenAI API');
    }
    
    let generatedResponse = data.choices[0].message.content;
    let tokensUsed = data.usage?.total_tokens || 0;
    
    console.log('✅ Response generated successfully');
    
    // Check against character limit(s) based on answer type
    let needsCondensing = false;
    if (answerType === 'Multi-Section') {
      console.log(`📊 Initial response length: ${generatedResponse.length} characters (Multi-Section mode - per-section limit: ${characterLimit} chars)`);
      const check = checkSectionLimits(generatedResponse, characterLimit, answerType);
      if (!check.valid && check.violations) {
        console.log(`⚠️ SECTIONS EXCEED LIMIT:`);
        check.violations.forEach(v => {
          console.log(`   - ${v.heading}: ${v.length} > ${characterLimit}`);
        });
        needsCondensing = true;
      }
    } else {
      console.log(`📊 Initial response length: ${generatedResponse.length} characters`);
      if (characterLimit && generatedResponse.length > characterLimit) {
        console.log(`⚠️ EXCEEDS LIMIT (${generatedResponse.length} > ${characterLimit})`);
        needsCondensing = true;
      }
    }
    
    // Iterative condense approach: keep condensing until within limit (no truncation)
    if (characterLimit && needsCondensing) {
      console.log('🔄 [STAGE 6/6] Condensing response to fit character limit...');

      const runCondense = async (targetChars, attemptLabel, temperature = 0.3) => {
        const sectionNote = answerType === 'Multi-Section' 
          ? `Each section should independently be ~${targetChars} characters or fewer where possible.`
          : '';
        
        const condensingPrompt = `Condense this response to be more concise.

Original response:
${generatedResponse}

Instructions:
- Aim for${answerType === 'Multi-Section' ? ' each section around' : ' approximately'} ${targetChars} characters or less
- Prioritize: key technical points, business value, IBM differentiators
- Remove: redundancy, verbose explanations, less critical details
- Keep: structure (sections/headings), logical flow, accuracy
- ${sectionNote}
- This is best-effort condensing; being slightly over the target is acceptable if it preserves critical information

Provide ONLY the condensed response, nothing else.`;

        const condensingRequest = {
          messages: [
            { role: 'system', content: 'You are an expert at condensing technical content while preserving all key information.' },
            { role: 'user', content: condensingPrompt }
          ],
          temperature,
          max_tokens: Math.max(50, Math.ceil(targetChars / 3))
        };

        const condensingResponse = await fetch(azureUrl, {
          method: 'POST',
          headers: {
            'api-key': AZURE_OPENAI_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(condensingRequest)
        });

        if (condensingResponse.ok) {
          const condensingData = await condensingResponse.json();
          if (condensingData.choices?.[0]?.message?.content) {
            generatedResponse = condensingData.choices[0].message.content;
            tokensUsed += condensingData.usage?.total_tokens || 0;
            
            // Log detailed status
            if (answerType === 'Multi-Section') {
              const check = checkSectionLimits(generatedResponse, targetChars, answerType);
              if (check.valid) {
                console.log(`✅ ${attemptLabel} succeeded: All sections now ≤ ${targetChars} chars`);
              } else {
                const maxSectionLen = Math.max(...(check.violations?.map(v => v.length) || [0]));
                console.log(`✅ ${attemptLabel} condensed (Max section: ${maxSectionLen}/${targetChars} chars, ${(maxSectionLen/targetChars*100).toFixed(1)}%)`);
              }
            } else {
              console.log(`✅ ${attemptLabel} condensed to ${generatedResponse.length} characters`);
            }
            return true;
          }
        }
        console.log(`⚠️ ${attemptLabel} condense failed or empty response`);
        return false;
      };

      // Check if within limit(s) based on answer type
      const checkWithinLimit = () => {
        if (answerType === 'Multi-Section') {
          const check = checkSectionLimits(generatedResponse, characterLimit, answerType);
          return check.valid;
        } else {
          return generatedResponse.length <= characterLimit;
        }
      };
      
      // Up to two iterative condense passes to hit the target
      let attempts = 0;
      while (!checkWithinLimit() && attempts < 2) {
        attempts += 1;
        await runCondense(characterLimit, `Condense attempt ${attempts}`);
      }

      // Final aggressive pass if still over the limit: target 90% to create headroom
      if (!checkWithinLimit()) {
        const aggressiveTarget = Math.floor(characterLimit * 0.9);
        await runCondense(aggressiveTarget, 'Aggressive condense', 0.2);
        if (!checkWithinLimit()) {
          if (answerType === 'Multi-Section') {
            const check = checkSectionLimits(generatedResponse, characterLimit, answerType);
            console.log(`⚠️ Still above limit after aggressive condense. Sections over limit: ${check.violations?.length || 0}`);
          } else {
            console.log(`⚠️ Still above limit after aggressive condense (${generatedResponse.length} > ${characterLimit}), returning best-effort condensed response.`);
          }
        }
      }

      // Log final status
      if (answerType === 'Multi-Section') {
        const check = checkSectionLimits(generatedResponse, characterLimit, answerType);
        if (check.valid) {
          console.log(`📋 Final result: ✅ All sections within ${characterLimit} character limit`);
        } else {
          console.log(`📋 Final result: ⚠️ ${check.violations?.length || 0} sections still over limit`);
          check.violations?.forEach(v => {
            console.log(`   - ${v.heading}: ${v.length} chars`);
          });
        }
      } else {
        console.log(`📋 Final length after condensing: ${generatedResponse.length} | Status: ${generatedResponse.length <= characterLimit ? '✅ WITHIN LIMIT' : '⚠️ ABOVE LIMIT'}`);
      }
    } else if (characterLimit) {
      console.log(`✅ WITHIN LIMIT (${generatedResponse.length} <= ${characterLimit})`);
    }
    
    return {
      answer: generatedResponse,
      usedDocumentCollection,
      usedDocuments,
      collectionName: usedDocumentCollection ? COLLECTION_NAME : null,
      model: AZURE_OPENAI_DEPLOYMENT,
      tokensUsed,
      characterCount: generatedResponse.length,
      characterLimit
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('❌ Error generating RFI response:', errorMsg);
    console.error('Full error:', error);
    
    // Fallback to mock response for development/testing
    console.log('⚠️  Using mock response for development - ICA unavailable');
    return {
      answer: `[DEVELOPMENT RESPONSE] Question: ${question}\n\nContext:\n${context}\n\nIBM Consulting delivers modern ERP implementations through our proven delivery methodology. Our approach prioritises measurable business outcomes, including:\n\n• Accelerated time-to-value through pre-built accelerators and asset libraries\n• Risk mitigation via controlled delivery phases and governance checkpoints\n• Continuous optimisation post go-live with NextGen Managed Services\n• Governance integration with comprehensive security controls and audit requirements\n\nThis approach is distinct through our use of IBM Consulting Advantage (ICA) agentic accelerators for asset-enabled delivery and integration with IBM Garage for co-creation and rapid discovery.\n\n_Note: This is a development/fallback response. ICA API is currently unavailable. Error: ${errorMsg}_`,
      usedDocumentCollection: false,
      usedDocuments: [],
      collectionName: null,
      model: 'development-mock',
      tokensUsed: 0,
      isDevelopment: true,
      originalError: errorMsg
    };
  }
}

/**
 * Analyze response quality and provide scoring
 */
export async function analyzeResponseScore(answer, criteria = '') {
  try {
    console.log('📊 Analyzing response score...');
    
    const prompt = `As an RFI quality analyst, evaluate this response and provide:
1. Overall score (0-100)
2. Strengths (bullet points)
3. Areas for improvement (bullet points)
4. Specific suggestions for enhancement

${criteria ? `Evaluation Criteria: ${criteria}\n\n` : ''}Response to evaluate:
${answer}`;

    const response = await fetch(`${API_BASE}/apis/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'global/gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert RFI response evaluator. Provide structured, actionable feedback.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ICA API error: ${error}`);
    }
    
    const data = await response.json();
    const analysis = data.choices[0].message.content;
    
    console.log('✅ Analysis complete');
    
    return {
      analysis,
      model: data.model,
      tokensUsed: data.usage?.total_tokens
    };
    
  } catch (error) {
    console.error('❌ Error analyzing response:', error);
    throw error;
  }
}

/**
 * Generate presentation outline
 */
export async function generatePresentationOutline(topic, keyPoints = [], audience = '') {
  try {
    console.log('📋 Generating presentation outline...');
    
    const keyPointsText = keyPoints.length > 0 
      ? `\nKey Points to Include:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
      : '';
    
    const audienceText = audience ? `\nTarget Audience: ${audience}` : '';
    
    const prompt = `Create a professional PowerPoint presentation outline for:

Topic: ${topic}${keyPointsText}${audienceText}

Provide:
1. Suggested title slide
2. 5-7 main sections with slide titles
3. 3-4 bullet points per slide
4. Recommended closing slide

Format as a structured outline.`;

    const response = await fetch(`${API_BASE}/apis/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'global/gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert presentation designer. Create clear, engaging slide outlines.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ICA API error: ${error}`);
    }
    
    const data = await response.json();
    const outline = data.choices[0].message.content;
    
    console.log('✅ Outline generated');
    
    return {
      outline,
      model: data.model,
      tokensUsed: data.usage?.total_tokens
    };
    
  } catch (error) {
    console.error('❌ Error generating outline:', error);
    throw error;
  }
}
