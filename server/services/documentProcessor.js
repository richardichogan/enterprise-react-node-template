/**
 * Document Processor Service
 * Handles extraction and retrieval of text from uploaded documents
 * Now with Azure AI Search integration for better retrieval
 */

import fs from 'fs/promises';
import path from 'path';
import https from 'https';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import { searchDocuments, isSearchAvailable } from './azureSearchService.js';

// Ensure env vars are available even if module is imported before index.js loads dotenv
import dotenv from 'dotenv';
dotenv.config({ path: path.join(path.dirname(new URL(import.meta.url).pathname), '../.env') });

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

function getAzureConfig() {
  return {
    account: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    key: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    container: process.env.AZURE_STORAGE_CONTAINER_NAME || 'rfi-documents',
    sasToken: process.env.AZURE_STORAGE_SAS_TOKEN || ''
  };
}

let cachedBlobServiceClient = null;
function getBlobServiceClient() {
  const { account, key, sasToken } = getAzureConfig();
  if (!account) {
    throw new Error('AZURE_STORAGE_ACCOUNT_NAME is not set');
  }

  if (cachedBlobServiceClient) return cachedBlobServiceClient;

  if (sasToken) {
    const sas = sasToken.startsWith('?') ? sasToken : `?${sasToken}`;
    cachedBlobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net${sas}`);
  } else if (key) {
    const credential = new StorageSharedKeyCredential(account, key);
    cachedBlobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, credential);
  } else {
    throw new Error('Neither AZURE_STORAGE_ACCOUNT_KEY nor AZURE_STORAGE_SAS_TOKEN is set');
  }
  return cachedBlobServiceClient;
}

// Cache for extracted document contents
const documentCache = new Map();

/**
 * Download a file from Azure Blob Storage
 */
async function downloadFromAzure(blobName) {
  const { container } = getAzureConfig();
  const blobServiceClient = getBlobServiceClient();
  const containerClient = blobServiceClient.getContainerClient(container);
  const blobClient = containerClient.getBlobClient(blobName);
  const downloadResponse = await blobClient.download();
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Generate Azure Blob Storage signature (simplified - uses public access)
 * In production, implement proper SAS token generation
 */
function getSignature(blobName) {
  // For now, rely on public container or implement SAS token properly
  return '';
}

/**
 * Extract text from PDF
 */
async function extractPdf(buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text;
  } catch (error) {
    console.error('❌ PDF extraction error:', error.message);
    return null;
  }
}

/**
 * Extract text from Word document
 */
async function extractWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('❌ Word extraction error:', error.message);
    return null;
  }
}

/**
 * Extract text from Excel
 */
async function extractExcel(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    
    workbook.SheetNames.forEach(sheetName => {
      text += `\n## Sheet: ${sheetName}\n`;
      const worksheet = workbook.Sheets[sheetName];
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      text += csvData;
    });
    
    return text;
  } catch (error) {
    console.error('❌ Excel extraction error:', error.message);
    return null;
  }
}

/**
 * Extract structured Q&A from Gartner RFI Excel (specialized extraction)
 * Returns array of Q&A objects instead of plain text
 */
async function extractGartnerRFI(buffer) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const qaEntries = [];
    
    // Skip "Question overview" and "Data" sheets - process all evaluation sheets
    const sheetsToProcess = workbook.SheetNames.filter(name => 
      name !== 'Question overview' && name !== 'Data'
    );
    
    console.log(`📊 Processing ${sheetsToProcess.length} evaluation sheets...`);
    
    for (const sheetName of sheetsToProcess) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref']);
      
      // Header row is at index 5 (row 6 in Excel)
      const headerRow = 5;
      
      // Extract headers
      const headers = {};
      for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
        const cell = sheet[cellAddress];
        if (cell && cell.v) {
          const value = String(cell.v).trim();
          // Map key column positions
          if (value.includes('Question No')) headers.questionNo = col;
          if (value.includes('Question Title')) headers.questionTitle = col;
          if (value.includes('Answer Guidance')) headers.guidance = col;
          if (value.includes('Character Count')) headers.charCount = col;
          if (value.includes('Your Response')) headers.response = col;
          if (value.includes('Additional Information')) headers.additionalInfo = col;
          if (value.includes('Subsection Name')) headers.subsection = col;
          if (value.includes('2024 Response')) headers.response2024 = col;
        }
      }
      
      // Process data rows (start after header)
      let currentQuestion = null;
      for (let row = headerRow + 1; row <= range.e.r; row++) {
        const questionNoCell = sheet[XLSX.utils.encode_cell({ r: row, c: headers.questionNo || 1 })];
        
        // If we have a question number, this is a new question
        if (questionNoCell && questionNoCell.v && String(questionNoCell.v).trim() !== '') {
          // Save previous question if it exists
          if (currentQuestion) {
            qaEntries.push(currentQuestion);
          }
          
          // Start new question
          const getCell = (col) => {
            if (col === undefined) return '';
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
            return cell && cell.v ? String(cell.v).trim() : '';
          };
          
          currentQuestion = {
            section: sheetName,
            questionNo: getCell(headers.questionNo),
            questionTitle: getCell(headers.questionTitle),
            guidance: getCell(headers.guidance),
            charCount: getCell(headers.charCount),
            response: getCell(headers.response),
            additionalInfo: getCell(headers.additionalInfo),
            subsection: getCell(headers.subsection),
            response2024: getCell(headers.response2024),
            subRows: [] // For regional/tech breakdowns
          };
        } else if (currentQuestion && headers.response) {
          // This might be a sub-row (regional data, etc.)
          const responseCell = sheet[XLSX.utils.encode_cell({ r: row, c: headers.response })];
          if (responseCell && responseCell.v) {
            const subData = String(responseCell.v).trim();
            if (subData) {
              currentQuestion.subRows.push(subData);
            }
          }
        }
      }
      
      // Don't forget the last question
      if (currentQuestion) {
        qaEntries.push(currentQuestion);
      }
    }
    
    console.log(`✅ Extracted ${qaEntries.length} Q&A entries from Gartner RFI`);
    return qaEntries;
    
  } catch (error) {
    console.error('❌ Gartner RFI extraction error:', error.message);
    return null;
  }
}

/**
 * Extract text from PowerPoint (fixed to properly identify slide files)
 */
async function extractPowerPoint(buffer) {
  try {
    // PowerPoint files are ZIP archives
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    await zip.loadAsync(buffer);
    
    let allText = [];
    
    // Extract from actual slide files (not master pages or relationships)
    const slideFiles = Object.keys(zip.files)
      .filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml') && !f.includes('_rels'))
      .sort((a, b) => {
        // Sort numerically by slide number
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    
    if (slideFiles.length === 0) {
      console.warn('   ⚠️  No slide files found in PowerPoint');
      return null;
    }
    
    console.log(`   Processing ${slideFiles.length} slides...`);
    
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const file = zip.file(slideFile);
      if (!file) continue;
      
      const content = await file.async('string');
      
      // Extract all <a:t> tags (this is where PowerPoint stores text)
      const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g) || [];
      const slideTexts = textMatches
        .map(match => match.replace(/<\/?a:t>/g, '').trim())
        .filter(text => text.length > 0);
      
      if (slideTexts.length > 0) {
        allText.push(`Slide ${i + 1}:`, ...slideTexts, '');
      }
      
      // Show progress for large presentations
      if (slideFiles.length > 100 && (i + 1) % 50 === 0) {
        console.log(`   Processed ${i + 1}/${slideFiles.length} slides...`);
      }
    }
    
    // Extract from notes slides
    const noteFiles = Object.keys(zip.files)
      .filter(f => f.startsWith('ppt/notesSlides/notesSlide') && f.endsWith('.xml') && !f.includes('_rels'))
      .sort();
    
    if (noteFiles.length > 0) {
      console.log(`   Processing ${noteFiles.length} notes slides...`);
      
      for (const noteFile of noteFiles) {
        const file = zip.file(noteFile);
        if (!file) continue;
        
        const content = await file.async('string');
        const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g) || [];
        const noteTexts = textMatches
          .map(match => match.replace(/<\/?a:t>/g, '').trim())
          .filter(text => text.length > 0);
        
        if (noteTexts.length > 0) {
          allText.push('Notes:', ...noteTexts, '');
        }
      }
    }
    
    const finalText = allText.join('\n');
    
    if (!finalText || finalText.length < 10) {
      console.warn('   ⚠️  Minimal text content found in PowerPoint');
      return null;
    }
    
    console.log(`   ✅ Extracted ${finalText.length} characters from ${slideFiles.length} slides`);
    return finalText;
    
  } catch (error) {
    console.error('❌ PowerPoint extraction error:', error.message);
    return null;
  }
}

/**
 * Extract text from document based on file type
 */
export async function extractDocumentText(fileName, buffer) {
  const ext = path.extname(fileName).toLowerCase();
  
  console.log(`📄 Extracting text from ${fileName} (${ext})`);
  
  let text = null;
  
  switch (ext) {
    case '.pdf':
      text = await extractPdf(buffer);
      break;
    case '.docx':
    case '.doc':
      text = await extractWord(buffer);
      break;
    case '.xlsx':
    case '.xls':
      text = await extractExcel(buffer);
      break;
    case '.pptx':
    case '.ppt':
      text = await extractPowerPoint(buffer);
      break;
    case '.txt':
      text = buffer.toString('utf-8');
      break;
    default:
      console.warn(`⚠️  Unsupported file type: ${ext}`);
      return null;
  }
  
  if (text) {
    console.log(`✅ Extracted ${text.length} characters from ${fileName}`);
  }
  
  return text;
}

/**
 * Load and cache document content
 */
export async function loadDocumentContent(fileName) {
  // Check cache first
  if (documentCache.has(fileName)) {
    console.log(`💾 Using cached content for ${fileName}`);
    return documentCache.get(fileName);
  }
  
  try {
    console.log(`📥 Loading ${fileName} from Azure...`);
    const buffer = await downloadFromAzure(fileName);
    const text = await extractDocumentText(fileName, buffer);
    
    if (text) {
      // Cache the result
      documentCache.set(fileName, text);
      return text;
    }
    console.warn(`⚠️  No text extracted from ${fileName}`);
  } catch (error) {
    console.error(`❌ Error loading ${fileName}:`, error.message);
  }
  
  return null;
}

/**
 * Split text into chunks for retrieval
 */
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let start = 0;
  const step = Math.max(1, chunkSize - overlap);
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += step;
  }
  
  return chunks;
}

/**
 * Simple relevance scoring based on keyword matching
 */
function scoreChunkRelevance(chunk, query) {
  const queryTerms = query.toLowerCase().split(/\s+/);
  let score = 0;
  
  queryTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = chunk.match(regex) || [];
    score += matches.length;
  });
  
  return score;
}

/**
 * Retrieve relevant chunks from documents and track which documents were used
 * Uses Azure AI Search when available, falls back to blob storage chunking
 */
export async function retrieveDocumentContext(documentNames, question, maxChunks = 5) {
  if (!documentNames || documentNames.length === 0) {
    return { context: '', usedDocuments: [] };
  }
  
  console.log(`🔍 Retrieving context from ${documentNames.length} document(s)`);
  
  // Try Azure AI Search first (better retrieval quality)
  if (isSearchAvailable()) {
    console.log('🚀 Using Azure AI Search for retrieval');
    try {
      const searchContext = await searchDocuments(question, maxChunks);
      
      if (searchContext) {
        // Extract document names from search results (basic parsing)
        const usedDocuments = documentNames; // For now, assume all docs may be searched
        console.log(`✅ Retrieved context from Azure AI Search`);
        return { context: searchContext, usedDocuments };
      }
    } catch (error) {
      console.warn('⚠️ Azure Search failed, falling back to blob storage:', error.message);
    }
  }
  
  // Fallback to original blob storage chunking
  console.log('📦 Using Azure Blob Storage chunking (fallback)');
  
  const allChunks = [];
  const loadedDocuments = new Set();
  
  // Load and chunk all documents
  for (const docName of documentNames) {
    const content = await loadDocumentContent(docName);
    if (content) {
      loadedDocuments.add(docName);
      const chunks = chunkText(content);
      chunks.forEach(chunk => {
        allChunks.push({
          source: docName,
          content: chunk,
          relevance: scoreChunkRelevance(chunk, question)
        });
      });
    }
  }
  
  // Sort by relevance and select top chunks
  const topChunks = allChunks
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxChunks);
  
  if (topChunks.length === 0) {
    console.log('⚠️  No relevant document content found');
    return { context: '', usedDocuments: [] };
  }
  
  // Track which unique documents were actually used in top chunks
  const usedDocuments = [...new Set(topChunks.map(chunk => chunk.source))];
  
  // Build context string
  let context = '\n## Document References:\n';
  topChunks.forEach(chunk => {
    context += `\n### From ${chunk.source}:\n${chunk.content}\n`;
  });
  
  console.log(`✅ Retrieved ${topChunks.length} relevant chunks from ${usedDocuments.length} document(s)`);
  usedDocuments.forEach(doc => console.log(`   📄 ${doc}`));
  
  return { context, usedDocuments };
}

/**
 * Clear document cache
 */
export function clearDocumentCache() {
  documentCache.clear();
  console.log('🗑️  Document cache cleared');
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return {
    cachedDocuments: documentCache.size,
    documents: Array.from(documentCache.keys())
  };
}

/**
 * Export Gartner RFI extraction for specialized indexing
 */
export { extractGartnerRFI };
