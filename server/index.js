import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { evaluateVendorResponse } from './services/analystEvaluatorService.js';
import { createBlankPresentation } from './services/presentationService.js';
import { generateBriefingDeck, createPresentationFromDeck } from './services/briefingDeckService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = Number(process.env.PORT || 3001);
const DATA_DIR = path.join(__dirname, 'data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({ origin: origins }));
app.use(express.json());

// Local JSON storage helpers (temporary persistence)
const ensureProjectsFile = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(PROJECTS_FILE);
  } catch {
    await fs.writeFile(PROJECTS_FILE, '[]', 'utf-8');
  }
};

const loadProjects = async () => {
  await ensureProjectsFile();
  const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
  return JSON.parse(data || '[]');
};

const saveProjects = async (projects) => {
  await ensureProjectsFile();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
};

// Configure multer for file uploads (memory storage)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024 // 250MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Accept common document formats
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'text/plain',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint' // .ppt
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, Word, PowerPoint, TXT`));
    }
  }
});

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Import services
import { generateRFIResponse, analyzeResponseScore, generatePresentationOutline } from './services/icaService.js';
import { uploadDocument, listDocuments, downloadDocument, deleteDocument, getDocumentMetadata } from './services/azureBlobService.js';

// RFI Generation Endpoint
app.post('/api/rfi/generate-response', async (req, res) => {
  try {
    const { 
      question, 
      analyst, 
      category, 
      technologyFocus, 
      partner,
      guidance,
      characterLimit,
      answerType,
      useDocumentCollection,
      documents
    } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Build comprehensive context from project metadata
    const contextParts = [];
    if (analyst) contextParts.push(`Analyst: ${analyst}`);
    if (partner) contextParts.push(`Partner/Vendor: ${partner}`);
    if (category) contextParts.push(`Category: ${category}`);
    if (technologyFocus) contextParts.push(`Technology Focus: ${technologyFocus}`);
    if (guidance) contextParts.push(`Specific Guidance: ${guidance}`);
    if (answerType) contextParts.push(`Response Format: ${answerType}`);
    if (characterLimit) contextParts.push(`Character Limit: ${characterLimit}`);
    
    // Pass ALL documents for RAG consideration (not just selected ones)
    // The RAG system will score all documents for relevance and use the best ones
    if (documents && documents.length > 0) {
      contextParts.push(`Available Documents (all will be considered): ${documents.join(', ')}`);
    }
    
    const projectContext = contextParts.length > 0 
      ? `Project Context:\n${contextParts.join('\n')}\n\n`
      : '';

    console.log('📨 Calling generateRFIResponse with question:', question.substring(0, 50) + '...');
    console.log('📏 Character limit:', characterLimit || 'none');
    console.log('� Answer type:', answerType || 'Single');
    console.log('📄 Documents available for RAG:', documents?.length || 0);
    console.log('👤 Analyst framework:', analyst || 'generic');
    // Use Azure AI Search RAG by default
    const response = await generateRFIResponse(
      question, 
      projectContext, 
      useDocumentCollection, 
      characterLimit ? parseInt(characterLimit) : null,
      true,  // useAzureBlob - now uses Azure AI Search
      documents, // explicit list of document names to consider
      null, // aiModel - using Azure OpenAI deployment from env
      analyst, // analyst framework for prompt shaping
      answerType // answer type (Single or Multi-Section)
    );
    console.log('📤 Response from generateRFIResponse:', response?.model || 'unknown');
    console.log('📄 Used documents in response:', response?.usedDocuments || 'none');
    console.log('🏷️  Used document collection:', response?.usedDocumentCollection || false);
    res.json(response);
  } catch (error) {
    console.error('❌ Error in RFI endpoint:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate response', 
      details: error.message 
    });
  }
});

// Score Analysis Endpoint
app.post('/api/rfi/analyze-score', async (req, res) => {
  try {
    const { answer, criteria } = req.body;
    
    if (!answer) {
      return res.status(400).json({ error: 'Answer is required' });
    }

    const analysis = await analyzeResponseScore(answer, criteria);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing score:', error);
    res.status(500).json({ 
      error: 'Failed to analyze response', 
      details: error.message 
    });
  }
});


// Analyst Evaluation Endpoint
app.post('/api/rfi/evaluate-analyst', async (req, res) => {
  try {
    const { question, response, analyst = 'Gartner', model } = req.body;
    
    if (!question || !response) {
      return res.status(400).json({ 
        error: 'Both question and response are required' 
      });
    }

    console.log(`🎯 Analyst Evaluation Request:`);
    console.log(`   Analyst: ${analyst}`);
    console.log(`   Model: ${model || 'default'}`);

    const result = await evaluateVendorResponse(
      question,
      response,
      analyst,
      model
    );

    res.json({
      evaluation: result.evaluation,
      model: result.model,
      tokensUsed: result.tokensUsed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error evaluating vendor response:', error);
    res.status(500).json({ 
      error: 'Failed to evaluate vendor response', 
      details: error.message 
    });
  }
});

// Presentation Outline Endpoint
app.post('/api/rfi/generate-outline', async (req, res) => {
  try {
    const { topic, keyPoints, audience } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }

    const outline = await generatePresentationOutline(topic, keyPoints, audience);
    res.json(outline);
  } catch (error) {
    console.error('Error generating outline:', error);
    res.status(500).json({ 
      error: 'Failed to generate outline', 
      details: error.message 
    });
  }
});

// Create Blank Presentation Endpoint
app.post('/api/presentations/create-blank', async (req, res) => {
  try {
    const { title, subtitle } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    console.log('📊 Creating blank presentation...');
    console.log(`   Title: ${title}`);

    const pptxBuffer = await createBlankPresentation(title, subtitle);

    // Set headers for file download
    const filename = `${title.replace(/[^a-z0-9]/gi, '_')}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);

    res.send(pptxBuffer);
  } catch (error) {
    console.error('Error creating presentation:', error);
    res.status(500).json({ 
      error: 'Failed to create presentation', 
      details: error.message 
    });
  }
});

// Generate Briefing Deck from Briefing Pack
// Generate Briefing Deck with Server-Sent Events for progress updates
app.post('/api/presentations/generate-briefing-deck-stream', async (req, res) => {
  try {
    const { 
      briefingPack, 
      briefingInstructions, 
      vendorResponse = '', 
      analystFirm = 'Gartner',
      model 
    } = req.body;
    
    if (!briefingPack || !briefingInstructions) {
      return res.status(400).json({ 
        error: 'Briefing pack and instructions are required' 
      });
    }

    // Set up SSE response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    console.log('📊 Generating briefing deck with progress stream...');
    console.log(`   Analyst firm: ${analystFirm}`);

    const progressMessages = [];
    let finalResult = null;

    const onProgress = (step, total, message) => {
      progressMessages.push({ step, total, message, timestamp: Date.now() });
      res.write(`data: ${JSON.stringify({ step, total, message })}\n\n`);
    };

    try {
      const result = await generateBriefingDeck(
        briefingPack,
        briefingInstructions,
        vendorResponse,
        analystFirm,
        model,
        onProgress
      );
      finalResult = result;
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }

    // Send completion message with full result
    if (finalResult) {
      res.write(`data: ${JSON.stringify({ 
        complete: true, 
        deck: finalResult.deck,
        model: finalResult.model,
        tokensUsed: finalResult.tokensUsed,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }

    res.end();
  } catch (error) {
    console.error('Error generating briefing deck stream:', error);
    res.write(`data: ${JSON.stringify({ error: 'Failed to generate briefing deck', details: error.message })}\n\n`);
    res.end();
  }
});

app.post('/api/presentations/generate-briefing-deck', async (req, res) => {
  try {
    const { 
      briefingPack, 
      briefingInstructions, 
      vendorResponse = '', 
      analystFirm = 'Gartner',
      model 
    } = req.body;
    
    if (!briefingPack || !briefingInstructions) {
      return res.status(400).json({ 
        error: 'Briefing pack and instructions are required' 
      });
    }

    console.log('📊 Generating briefing deck...');
    console.log(`   Analyst firm: ${analystFirm}`);

    const result = await generateBriefingDeck(
      briefingPack,
      briefingInstructions,
      vendorResponse,
      analystFirm,
      model
    );

    res.json({
      deck: result.deck,
      model: result.model,
      tokensUsed: result.tokensUsed,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating briefing deck:', error);
    res.status(500).json({ 
      error: 'Failed to generate briefing deck', 
      details: error.message 
    });
  }
});

// Create PowerPoint from Deck Structure
app.post('/api/presentations/create-from-deck', async (req, res) => {
  try {
    const { deckStructure, filename = 'Briefing_Deck' } = req.body;
    
    if (!deckStructure) {
      return res.status(400).json({ error: 'Deck structure is required' });
    }

    console.log('📊 Creating PowerPoint from deck structure...');

    const pptxBuffer = await createPresentationFromDeck(deckStructure);

    // Set headers for file download
    const sanitizedFilename = `${filename.replace(/[^a-z0-9]/gi, '_')}.pptx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('Content-Length', pptxBuffer.length);

    res.send(pptxBuffer);
  } catch (error) {
    console.error('Error creating PowerPoint:', error);
    res.status(500).json({ 
      error: 'Failed to create PowerPoint', 
      details: error.message 
    });
  }
});

// ========================================
// PROJECT PERSISTENCE (JSON FILE)
// ========================================
app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await loadProjects();
    res.json({ success: true, projects, count: projects.length });
  } catch (error) {
    console.error('Error loading projects:', error);
    res.status(500).json({ error: 'Failed to load projects', details: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects)) {
      return res.status(400).json({ error: 'projects must be an array' });
    }

    await saveProjects(projects);
    res.json({ success: true, count: projects.length });
  } catch (error) {
    console.error('Error saving projects:', error);
    res.status(500).json({ error: 'Failed to save projects', details: error.message });
  }
});

// Document Collections Endpoint
app.get('/api/collections', async (req, res) => {
  try {
    const API_BASE = process.env.IBM_ICA_API_URL;
    const SERVICE_TOKEN = process.env.IBM_ICA_SERVICE_TOKEN;
    
    const response = await fetch(`${API_BASE}/apis/v3/vector_stores`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ 
      error: 'Failed to fetch collections', 
      details: error.message 
    });
  }
});

// ========================================
// DOCUMENT MANAGEMENT ENDPOINTS (Azure Blob Storage)
// ========================================

// Upload document to Azure Blob Storage
app.post('/api/documents/upload', (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific error
      console.error('❌ Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum size is 250MB.' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      // Unknown error
      console.error('❌ Upload error:', err);
      return res.status(500).json({ error: err.message });
    }
    
    // No error, proceed to handler
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { buffer, originalname, mimetype } = req.file;
    
    console.log(`📤 Uploading document: ${originalname} (${mimetype}, ${buffer.length} bytes)`);
    
    const result = await uploadDocument(buffer, originalname, mimetype);
    console.log(`✅ Upload successful: ${originalname}`);
    
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: result
    });
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to upload document', 
      details: error.message 
    });
  }
});

// List all uploaded documents
app.get('/api/documents', async (req, res) => {
  try {
    try {
      const documents = await listDocuments();
      res.json({
        success: true,
        count: documents.length,
        documents
      });
    } catch (listError) {
      // If Azure not configured, return mock documents
      console.log('⚠️  Azure not configured, returning mock documents');
      res.json({
        success: true,
        count: 0,
        documents: []
      });
    }
  } catch (error) {
    console.error('❌ List documents error:', error);
    res.status(500).json({ 
      error: 'Failed to list documents', 
      details: error.message 
    });
  }
});

// Get document metadata
app.get('/api/documents/:blobName', async (req, res) => {
  try {
    const { blobName } = req.params;
    
    const metadata = await getDocumentMetadata(blobName);
    
    res.json({
      success: true,
      document: metadata
    });
  } catch (error) {
    console.error('❌ Get metadata error:', error);
    res.status(404).json({ 
      error: 'Document not found', 
      details: error.message 
    });
  }
});

// Download document content
app.get('/api/documents/download/:blobName', async (req, res) => {
  try {
    const { blobName } = req.params;
    console.log(`📥 Downloading document: ${blobName}`);
    
    const buffer = await downloadDocument(blobName);
    const fileExt = path.extname(blobName).toLowerCase();
    
    let text = '';
    
    // Extract text based on file type
    if (fileExt === '.pdf') {
      try {
        console.log(`  🔍 Parsing PDF (${buffer.length} bytes)...`);
        // Use pdfjs-dist for PDF extraction
        // Convert Buffer to Uint8Array (pdfjs requires Uint8Array, not Buffer)
        const uint8Array = new Uint8Array(buffer);
        const pdfDoc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
        const pages = [];
        
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item) => item.str).join(' ');
          pages.push(pageText);
        }
        
        text = pages.join('\n\n');
        console.log(`✅ PDF extracted: ${text.length} chars from ${pdfDoc.numPages} pages`);
      } catch (pdfErr) {
        console.error('❌ PDF parse failed:', pdfErr.message);
        text = `[PDF file - could not extract text: ${pdfErr.message}]`;
      }
    } else if (fileExt === '.docx') {
      try {
        console.log(`  🔍 Parsing DOCX (${buffer.length} bytes)...`);
        const result = await mammoth.extractRawText({ buffer });
        text = result.value || '';
        if (result.messages && result.messages.length > 0) {
          console.log(`  ⚠️  Extraction messages:`, result.messages.map(m => m.message).join('; '));
        }
        console.log(`✅ DOCX extracted: ${text.length} chars`);
      } catch (docxErr) {
        console.error('❌ DOCX parse failed:', docxErr.message);
        text = `[Word document - could not extract text: ${docxErr.message}]`;
      }
    } else if (fileExt === '.pptx') {
      try {
        console.log(`  🔍 Parsing PPTX (${buffer.length} bytes)...`);
        // PPTX is a ZIP file containing XML
        const zip = new JSZip();
        await zip.loadAsync(buffer);
        
        const textParts = [];
        
        // Extract text from all slides
        const slideFolder = zip.folder('ppt/slides');
        if (slideFolder) {
          const files = Object.keys(slideFolder.files).filter(f => f.match(/slide\d+\.xml$/));
          
          for (const slideFile of files.sort()) {
            const slideContent = await zip.file(`ppt/slides/${slideFile}`).async('text');
            // Extract text from <a:t> tags (text elements in PowerPoint)
            const matches = slideContent.match(/<a:t>([^<]*)<\/a:t>/g);
            if (matches) {
              matches.forEach(match => {
                const txt = match.replace(/<a:t>|<\/a:t>/g, '').trim();
                if (txt) textParts.push(txt);
              });
            }
          }
        }
        
        text = textParts.join(' ');
        console.log(`✅ PPTX extracted: ${text.length} chars from ${textParts.length} text elements`);
      } catch (pptxErr) {
        console.error('❌ PPTX parse failed:', pptxErr.message);
        text = `[PowerPoint - could not extract text: ${pptxErr.message}]`;
      }
    } else if (fileExt === '.txt') {
      try {
        console.log(`  🔍 Converting TXT (${buffer.length} bytes)...`);
        text = buffer.toString('utf-8');
        console.log(`✅ TXT extracted: ${text.length} chars`);
      } catch (txtErr) {
        console.error('❌ TXT conversion failed:', txtErr.message);
        text = `[Text file - could not read: ${txtErr.message}]`;
      }
    } else {
      text = `[${fileExt} file type not supported]`;
    }
    
    // Truncate if too large
    const maxLength = 30000;
    if (text && text.length > maxLength) {
      text = text.substring(0, maxLength) + '\n\n[...document truncated...]';
    }
    
    console.log(`✅ Extracted ${text.length} characters from ${blobName}`);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text || '');
  } catch (error) {
    console.error('❌ Download error:', error.message);
    res.status(500).json({ error: 'Failed to extract document', details: error.message });
  }
});

// Delete document
app.delete('/api/documents/:blobName', async (req, res) => {
  try {
    const { blobName } = req.params;
    
    const result = await deleteDocument(blobName);
    
    res.json({
      success: true,
      message: 'Document deleted successfully',
      result
    });
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete document', 
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`✅ RFI-Helper API server listening on port ${port}`);
  console.log(`✅ CORS enabled for: ${origins.join(', ')}`);
  console.log(`✅ AI Provider: IBM Consulting Advantage`);
  console.log(`✅ ICA API URL: ${process.env.IBM_ICA_API_URL || 'NOT SET'}`);
  console.log(`✅ ICA Service Token: ${process.env.IBM_ICA_SERVICE_TOKEN ? process.env.IBM_ICA_SERVICE_TOKEN.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`✅ Document Collection: ${process.env.IBM_ICA_COLLECTION_NAME || 'Default'}`);
  console.log(`✅ Azure Blob Storage: ${process.env.AZURE_STORAGE_ACCOUNT_NAME ? 'Configured' : 'Not configured'}`);
});
