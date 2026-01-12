/**
 * IBM Consulting Advantage (ICA) Service
 * Provides AI-powered RFI response generation with document collection grounding
 */

import dotenv from 'dotenv';
dotenv.config();

const API_BASE = process.env.IBM_ICA_API_URL || 'https://servicesessentials.ibm.com';
const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
const ROO_TOKEN = process.env.IBM_ICA_ROO_TOKEN;
const COLLECTION_ID = process.env.IBM_ICA_COLLECTION_ID || '695fd3c445825c3b9aeac633';
const COLLECTION_NAME = process.env.IBM_ICA_COLLECTION_NAME || 'Gartner ERP Analysts Response';

// Use Roo token for document searches, Cline token for chat
const SEARCH_TOKEN = ROO_TOKEN || SERVICE_TOKEN;

/**
 * Search document collection for relevant context
 */
async function searchDocumentCollection(query) {
  try {
    console.log(`🔍 Searching collection "${COLLECTION_NAME}" for: ${query.substring(0, 100)}...`);
    console.log(`🔑 Using ${SEARCH_TOKEN === ROO_TOKEN ? 'Roo' : 'Cline'} token for search...`);
    
    // Create a thread for the search conversation
    const threadResponse = await fetch(`${API_BASE}/apis/v3/threads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SEARCH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool_resources: {
          file_search: {
            vector_store_ids: [COLLECTION_ID]
          }
        }
      })
    });
    
    if (!threadResponse.ok) {
      const error = await threadResponse.text();
      throw new Error(`Failed to create thread: ${error}`);
    }
    
    const thread = await threadResponse.json();
    const threadId = thread.id;
    
    // Add a message to search the collection
    const messageResponse = await fetch(`${API_BASE}/apis/v3/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SEARCH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'user',
        content: `Search the documents for information about: ${query}`
      })
    });
    
    if (!messageResponse.ok) {
      const error = await messageResponse.text();
      throw new Error(`Failed to add message: ${error}`);
    }
    
    // Create a run with file search
    const runResponse = await fetch(`${API_BASE}/apis/v3/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SEARCH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistant_id: null,
        model: 'gpt-5.1-chat',
        tools: [{ type: 'file_search' }],
        instructions: 'Search the document collection and provide relevant excerpts.'
      })
    });
    
    if (!runResponse.ok) {
      const error = await runResponse.text();
      throw new Error(`Failed to create run: ${error}`);
    }
    
    const run = await runResponse.json();
    
    // Wait for completion (simplified - production should poll)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get messages
    const messagesResponse = await fetch(`${API_BASE}/apis/v3/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${SEARCH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!messagesResponse.ok) {
      const error = await messagesResponse.text();
      throw new Error(`Failed to get messages: ${error}`);
    }
    
    const messages = await messagesResponse.json();
    
    // Extract assistant's response
    const assistantMessages = messages.data
      .filter(m => m.role === 'assistant')
      .map(m => m.content.map(c => c.text?.value || '').join('\n'));
    
    return assistantMessages[0] || '';
    
  } catch (error) {
    console.error('❌ Document collection search error:', error);
    return null;
  }
}

/**
 * Generate RFI response using IBM ICA Chat Completions API
 * Note: Direct vector store search requires different API scope
 * Using collection context in system prompt instead
 */
export async function generateRFIResponse(question, context = '', useDocumentCollection = true) {
  try {
    let groundingContext = '';
    
    // Search document collection if enabled and Roo token available
    if (useDocumentCollection && COLLECTION_ID && SEARCH_TOKEN) {
      const searchResults = await searchDocumentCollection(question);
      if (searchResults) {
        groundingContext = `\n\n### Relevant Information from ${COLLECTION_NAME}:\n${searchResults}\n`;
        console.log('✅ Found grounding context from document collection');
      }
    }
    
    // Build the prompt with grounding
    const systemPrompt = `You are an expert RFI (Request for Information) response writer for IBM Consulting. 
Your role is to create compelling, accurate, and professional responses to client questions.

When document collection context is provided, use it to ground your responses with real examples, 
case studies, and specific details. Always cite the source material when using it.

Response Guidelines:
- Be specific and detailed
- Use concrete examples when available  
- Maintain professional tone
- Structure responses clearly with headings and bullet points
- Include relevant metrics or outcomes
- If grounding material is available, reference it naturally`;

    const userPrompt = `${context ? `Context: ${context}\n\n` : ''}${groundingContext}Question: ${question}

Please provide a comprehensive RFI response that addresses the question thoroughly.`;

    console.log('🤖 Generating RFI response with IBM ICA...');
    
    const response = await fetch(`${API_BASE}/apis/v3/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'global/gpt-5.1-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`ICA API error: ${error}`);
    }
    
    const data = await response.json();
    const generatedResponse = data.choices[0].message.content;
    
    console.log('✅ Response generated successfully');
    
    return {
      answer: generatedResponse,
      usedDocumentCollection: !!groundingContext,
      collectionName: groundingContext ? COLLECTION_NAME : null,
      model: data.model,
      tokensUsed: data.usage?.total_tokens
    };
    
  } catch (error) {
    console.error('❌ Error generating RFI response:', error);
    throw error;
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
        model: 'global/gpt-5.1-chat',
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
        model: 'global/gpt-5.1-chat',
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
