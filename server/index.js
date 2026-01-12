import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());

app.use(cors({ origin: origins }));
app.use(express.json());

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
import { uploadDocument, listDocuments, deleteDocument, getDocumentMetadata } from './services/azureBlobService.js';

// RFI Generation Endpoint
app.post('/api/rfi/generate-response', async (req, res) => {
  try {
    const { question, context, useDocumentCollection } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const response = await generateRFIResponse(question, context, useDocumentCollection);
    res.json(response);
  } catch (error) {
    console.error('Error generating RFI response:', error);
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
  console.log(`✅ Document Collection: ${process.env.IBM_ICA_COLLECTION_NAME || 'Default'}`);
  console.log(`✅ Azure Blob Storage: ${process.env.AZURE_STORAGE_ACCOUNT_NAME ? 'Configured' : 'Not configured'}`);
});
