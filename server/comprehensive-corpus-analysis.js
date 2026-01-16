/**
 * Comprehensive Corpus Analysis
 * Loads ALL documents from Azure Blob and displays complete inventory
 * PURPOSE: Extract key data from EVERY source for briefing deck generation
 */

import 'dotenv/config';
import { listDocuments, downloadDocument } from './services/azureBlobService.js';
import { extractDocumentText } from './services/documentProcessor.js';
import path from 'path';
import fs from 'fs/promises';

async function main() {
  console.log('📚 COMPREHENSIVE CORPUS ANALYSIS');
  console.log('================================\n');

  try {
    // STEP 1: List all documents
    console.log('STEP 1: Listing all documents in Azure Blob Storage...\n');
    const blobs = await listDocuments();
    
    console.log(`Found ${blobs.length} documents:\n`);
    blobs.forEach((blob, i) => {
      const name = blob.name || blob;
      console.log(`${i + 1}. ${name}`);
    });

    // STEP 2: Download and analyze each document
    console.log('\n\nSTEP 2: Extracting text from EACH document...\n');
    
    const allDocumentsContent = {};
    let totalChars = 0;

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const blobName = blob.name || blob;
      try {
        console.log(`[${i + 1}/${blobs.length}] Processing: ${blobName}`);
        
        // Download the blob
        const blobData = await downloadDocument(blobName);
        
        if (blobData && blobData.length > 0) {
          // Extract text from downloaded blob - NOTE: extractDocumentText(fileName, buffer)
          const textContent = await extractDocumentText(blobName, blobData);
          
          if (textContent) {
            allDocumentsContent[blobName] = {
              size: textContent.length,
              preview: textContent.substring(0, 500),
              fullContent: textContent
            };
            totalChars += textContent.length;
            console.log(`   ✅ Extracted ${textContent.length} characters`);
          } else {
            console.log(`   ⚠️  No content extracted`);
          }
        } else {
          console.log(`   ⚠️  Could not download`);
        }
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
      }
    }

    // STEP 3: Summary statistics
    console.log(`\n\nSTEP 3: Corpus Summary\n`);
    console.log(`Total documents processed: ${Object.keys(allDocumentsContent).length}`);
    console.log(`Total corpus size: ${totalChars.toLocaleString()} characters`);
    console.log(`Average document size: ${Math.round(totalChars / Object.keys(allDocumentsContent).length).toLocaleString()} characters\n`);

    // STEP 4: Display key snippets from each document
    console.log('\nSTEP 4: Key Data Points by Document\n');
    Object.entries(allDocumentsContent).forEach(([docName, content]) => {
      console.log(`\n────────────────────────────────────`);
      console.log(`📄 ${docName}`);
      console.log(`────────────────────────────────────`);
      console.log(`Size: ${content.size.toLocaleString()} characters`);
      console.log(`Preview (first 300 chars):\n${content.preview.substring(0, 300)}...`);
    });

    // STEP 5: Search across ALL documents for key terms
    console.log(`\n\nSTEP 5: Searching for key data across ALL documents\n`);
    
    const searchTerms = [
      'consultants',
      'countries',
      'certifications',
      'Garage',
      'Rapid Discovery',
      'case study',
      'implementation',
      'customer',
      'outcome'
    ];

    searchTerms.forEach(term => {
      console.log(`\n🔍 Searching for: "${term}"`);
      let foundCount = 0;
      
      Object.entries(allDocumentsContent).forEach(([docName, content]) => {
        const matches = (content.fullContent.match(new RegExp(term, 'gi')) || []).length;
        if (matches > 0) {
          console.log(`   ${docName}: ${matches} mentions`);
          foundCount += matches;
        }
      });
      
      if (foundCount === 0) {
        console.log(`   (Not found in any document)`);
      }
    });

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

main();
