/**
 * Extract EXACT briefing pack requirements (structure + content requirements)
 * NOT hardcoded - parsed from briefing pack itself
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

import { downloadDocument, listDocuments } from './services/azureBlobService.js';
import { extractDocumentText } from './services/documentProcessor.js';

(async () => {
  try {
    console.log('📋 EXTRACTING BRIEFING PACK STRUCTURE & REQUIREMENTS\n');
    
    // Fetch briefing pack
    const allDocs = await listDocuments();
    const briefingDoc = allDocs.find(d => d.name.includes('Live Briefing Guidelines'));
    
    if (!briefingDoc) {
      throw new Error('Briefing pack not found');
    }
    
    const buffer = await downloadDocument(briefingDoc.name);
    const briefingPack = await extractDocumentText(briefingDoc.name, buffer);
    
    console.log('📄 FULL BRIEFING PACK STRUCTURE:\n');
    console.log(briefingPack);
    
    // Extract structure manually to show what we should be parsing
    console.log('\n\n🔍 KEY SECTIONS IDENTIFIED:\n');
    
    // Find Part One
    const partOneMatch = briefingPack.match(/Part One:.*?Vision and Execution.*?\((\d+)\s*minutes?\)/i);
    if (partOneMatch) {
      console.log(`✅ Found: ${partOneMatch[0]}`);
    }
    
    // Find subsections
    const subsections = briefingPack.match(/\d+\.\s+([^(]+(?:\([^)]*\))?)\n/g);
    if (subsections) {
      console.log(`\n✅ Found ${subsections.length} subsections:`);
      subsections.forEach((sub, idx) => {
        console.log(`   ${idx + 1}. ${sub.trim()}`);
      });
    }
    
    // Extract specific requirements (bullet points under each section)
    const parts = briefingPack.split(/Part\s+(One|Two|Three|Four):/i);
    console.log(`\n✅ Found ${parts.length - 1} major parts\n`);
    
    for (let i = 1; i < parts.length; i += 2) {
      const partName = parts[i];
      const partContent = parts[i + 1] || '';
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`PART ${partName.toUpperCase()}`);
      console.log(`${'='.repeat(80)}\n`);
      
      // Extract subsections for this part
      const subsectionMatches = partContent.match(/\d+\.\s+([^\n]+)\n([\s\S]*?)(?=\d+\.|Part|$)/g);
      if (subsectionMatches) {
        subsectionMatches.slice(0, 3).forEach(match => {
          // Extract title
          const titleMatch = match.match(/\d+\.\s+([^\n]+)/);
          const title = titleMatch ? titleMatch[1].trim() : '';
          
          // Extract bullet points
          const bullets = match.match(/◦\s+([^\n]+)/g) || match.match(/•\s+([^\n]+)/g) || [];
          
          console.log(`\n📌 SUBSECTION: ${title}`);
          if (bullets.length > 0) {
            console.log('   Requirements:');
            bullets.forEach(bullet => {
              const cleanedBullet = bullet.replace(/^[◦•]\s+/, '').trim();
              console.log(`     • ${cleanedBullet}`);
            });
          }
          console.log('');
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
