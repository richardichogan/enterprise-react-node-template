/**
 * Briefing Quality Test Suite
 * Tests briefing deck generation with real documents and scores content quality
 * Outputs: PPTX file + scoring report
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

import { generateBriefingDeck, createPresentationFromDeck } from './services/briefingDeckService.js';
import { downloadDocument, listDocuments } from './services/azureBlobService.js';
import { searchDocuments } from './services/azureSearchService.js';
import { extractDocumentText } from './services/documentProcessor.js';
import fs from 'fs/promises';

// Test configuration
const PASS_THRESHOLD = 0.75; // 75% required to pass

// Document names in Azure Blob Storage
const BRIEFING_PACK = '2026-01-12T13-21-31-281Z_Live Briefing Guidelines for Cloud ERP Services, 2026';
const WELCOME_PACKET = '2026-01-12T13-23-46-101Z_Welcome Packet for Cloud ERP Services, 2026[66].pdf';
const IBM_RFI = 'Microsoft MQ & CC_Cloud-ERP-Services_IBM_05-Dec-2025.';

console.log('🧪 BRIEFING QUALITY TEST SUITE');
console.log('================================\n');

async function fetchDocuments() {
  console.log('📥 Step 1: Fetching documents from Azure Blob Storage...');
  
  try {
    // First, list all documents to find exact names
    const allDocs = await listDocuments();
    console.log(`   Found ${allDocs.length} documents in storage`);
    
    // Find the documents we need
    const briefingDoc = allDocs.find(d => d.name.includes('Live Briefing Guidelines'));
    const welcomeDoc = allDocs.find(d => d.name.includes('Welcome Packet'));
    const ibmDoc = allDocs.find(d => d.name.includes('Cloud-ERP-Services_IBM'));
    
    if (!briefingDoc || !welcomeDoc || !ibmDoc) {
      console.log('\n   Available documents:');
      allDocs.forEach(d => console.log(`     - ${d.name}`));
      throw new Error('Could not find required documents');
    }
    
    console.log(`   📄 Briefing Pack: ${briefingDoc.name}`);
    console.log(`   📄 Welcome Packet: ${welcomeDoc.name}`);
    console.log(`   📄 IBM RFI: ${ibmDoc.name}`);
    
    const [briefingPackBuffer, welcomePacketBuffer, ibmRfiBuffer] = await Promise.all([
      downloadDocument(briefingDoc.name),
      downloadDocument(welcomeDoc.name),
      downloadDocument(ibmDoc.name)
    ]);
    
    console.log(`   ⚙️  Extracting text from documents...`);
    
    // Extract text from PDFs and Excel
    const briefingPack = await extractDocumentText(briefingDoc.name, briefingPackBuffer);
    const welcomePacket = await extractDocumentText(welcomeDoc.name, welcomePacketBuffer);
    const ibmRfi = await extractDocumentText(ibmDoc.name, ibmRfiBuffer);
    
    console.log(`   ✅ Briefing Pack: ${(briefingPack.length / 1024).toFixed(2)} KB text extracted`);
    console.log(`   ✅ Welcome Packet: ${(welcomePacket.length / 1024).toFixed(2)} KB text extracted`);
    console.log(`   ✅ IBM RFI Response: ${(ibmRfi.length / 1024).toFixed(2)} KB text extracted\n`);
    
    return { briefingPack, welcomePacket, ibmRfi };
  } catch (error) {
    console.error('❌ Failed to fetch documents:', error.message);
    throw error;
  }
}

async function fetchFoundryKB() {
  console.log('📚 Step 2: Fetching ALL Foundry KB content...');
  
  try {
    // Search for all content (empty query returns everything)
    const allContent = await searchDocuments('Cloud ERP IBM capabilities', 50);
    
    console.log(`   ✅ Retrieved ${allContent.length} characters of KB content\n`);
    return allContent;
  } catch (error) {
    console.error('❌ Failed to fetch Foundry KB:', error.message);
    throw error;
  }
}

async function generateDeck(briefingPack, welcomePacket, ibmRfi, kbContent) {
  console.log('🎨 Step 3: Generating briefing deck...');
  
  // DEBUG: Show first 2000 chars of briefing pack
  console.log('\n📋 BRIEFING PACK PREVIEW (first 2000 chars):');
  console.log('='.repeat(80));
  console.log(briefingPack.substring(0, 2000));
  console.log('='.repeat(80));
  console.log('\n');
  
  const briefingInstructions = `
    ${welcomePacket}
    
    ADDITIONAL CONTEXT FROM FOUNDRY KB:
    ${kbContent}
  `;
  
  try {
    const result = await generateBriefingDeck(
      briefingPack.toString(),
      briefingInstructions,
      ibmRfi.toString(),
      'Gartner',
      'gpt-4o'
    );
    
    console.log(`   ✅ Generated ${result.deck.slides.length} slides`);
    console.log(`   ✅ Generated ${result.deck.qaBank?.length || 0} Q&A items\n`);
    
    return result.deck;
  } catch (error) {
    console.error('❌ Failed to generate deck:', error.message);
    throw error;
  }
}

function scoreSlide(slide, index) {
  const scores = {
    hasTitle: slide.title && slide.title !== 'Untitled' ? 1 : 0,
    hasContent: slide.content && (Array.isArray(slide.content) ? slide.content.length > 0 : Object.keys(slide.content).length > 0) ? 1 : 0,
    hasEvidence: slide.evidence && slide.evidence.length > 10 ? 1 : 0,
    hasMQMapping: slide.mq_mapping && slide.mq_mapping.length > 0 ? 1 : 0,
    noGenericContent: true, // Check for generic phrases
    hasSpecificData: false // Check for numbers, dates, names
  };
  
  // Check for generic marketing speak
  const contentStr = JSON.stringify(slide.content).toLowerCase();
  const genericPhrases = ['comprehensive', 'extensive', 'robust', 'leading', 'innovative'];
  const hasGeneric = genericPhrases.some(phrase => contentStr.includes(phrase));
  scores.noGenericContent = !hasGeneric ? 1 : 0;
  
  // Check for specific data (numbers, percentages, dates)
  const hasNumbers = /\d+%|\d+ clients|\d+ deployments|\$\d+/i.test(contentStr);
  scores.hasSpecificData = hasNumbers ? 1 : 0;
  
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = Object.keys(scores).length;
  const percentage = (totalScore / maxScore) * 100;
  
  return {
    slideNumber: index + 1,
    title: slide.title,
    layout: slide.layout,
    scores,
    totalScore,
    maxScore,
    percentage: percentage.toFixed(1),
    passed: percentage >= (PASS_THRESHOLD * 100)
  };
}

function generateReport(deck, slideScores) {
  console.log('📊 Step 4: Scoring Results');
  console.log('================================\n');
  
  const passed = slideScores.filter(s => s.passed).length;
  const total = slideScores.length;
  const overallPass = (passed / total) >= PASS_THRESHOLD;
  
  console.log(`Overall: ${passed}/${total} slides passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`Threshold: ${(PASS_THRESHOLD * 100)}%`);
  console.log(`Status: ${overallPass ? '✅ PASSED' : '❌ FAILED'}\n`);
  
  console.log('Slide-by-Slide Scores:');
  console.log('─────────────────────────────────────────────────\n');
  
  slideScores.forEach(score => {
    const status = score.passed ? '✅' : '❌';
    console.log(`${status} Slide ${score.slideNumber}: ${score.title}`);
    console.log(`   Layout: ${score.layout || 'L2'}`);
    console.log(`   Score: ${score.percentage}% (${score.totalScore}/${score.maxScore})`);
    console.log(`   Details:`);
    console.log(`     - Title: ${score.scores.hasTitle ? '✅' : '❌'}`);
    console.log(`     - Content: ${score.scores.hasContent ? '✅' : '❌'}`);
    console.log(`     - Evidence: ${score.scores.hasEvidence ? '✅' : '❌'}`);
    console.log(`     - MQ Mapping: ${score.scores.hasMQMapping ? '✅' : '❌'}`);
    console.log(`     - No Generic Phrases: ${score.scores.noGenericContent ? '✅' : '❌'}`);
    console.log(`     - Specific Data: ${score.scores.hasSpecificData ? '✅' : '❌'}`);
    console.log('');
  });
  
  return overallPass;
}

async function savePPTX(deck) {
  console.log('💾 Step 5: Saving PowerPoint file...');
  
  try {
    const buffer = await createPresentationFromDeck(deck);
    const filename = `test-briefing-${new Date().toISOString().replace(/[:.]/g, '-')}.pptx`;
    await fs.writeFile(filename, buffer);
    
    console.log(`   ✅ Saved: ${filename}`);
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB\n`);
    
    return filename;
  } catch (error) {
    console.error('❌ Failed to save PPTX:', error.message);
    throw error;
  }
}

// Run the test
(async () => {
  try {
    const { briefingPack, welcomePacket, ibmRfi } = await fetchDocuments();
    const kbContent = await fetchFoundryKB();
    const deck = await generateDeck(briefingPack, welcomePacket, ibmRfi, kbContent);
    
    const slideScores = deck.slides.map((slide, idx) => scoreSlide(slide, idx));
    const passed = generateReport(deck, slideScores);
    
    // Show sample slide content (slides 3, 11, 12 which scored well)
    console.log('\n📄 SAMPLE SLIDE CONTENT:\n');
    [2, 10, 11].forEach(idx => {
      if (deck.slides[idx]) {
        const slide = deck.slides[idx];
        console.log(`\n${'='.repeat(80)}`);
        console.log(`SLIDE ${idx + 1}: ${slide.title}`);
        console.log(`Layout: ${slide.layout}`);
        console.log(`${'='.repeat(80)}`);
        if (slide.intro) {
          console.log(`\nIntro: ${slide.intro}`);
        }
        if (slide.subtitle) {
          console.log(`Subtitle: ${slide.subtitle}`);
        }
        if (slide.content) {
          console.log('\nContent:');
          if (slide.content.key_bullets) {
            slide.content.key_bullets.forEach((bullet, i) => {
              console.log(`  ${i + 1}. ${bullet}`);
            });
          }
          if (slide.content.left_bullets) {
            console.log('\nLeft Column:');
            slide.content.left_bullets.forEach((bullet, i) => {
              console.log(`  ${i + 1}. ${bullet}`);
            });
          }
          if (slide.content.right_bullets) {
            console.log('\nRight Column:');
            slide.content.right_bullets.forEach((bullet, i) => {
              console.log(`  ${i + 1}. ${bullet}`);
            });
          }
          if (slide.content.metric_strip) {
            console.log('\nMetric Strip:');
            slide.content.metric_strip.forEach((metric, i) => {
              console.log(`  ${i + 1}. ${metric.label}: ${metric.value} - ${metric.context}`);
              console.log(`     Source: ${metric.source}`);
            });
          }
          if (slide.content.tiles) {
            console.log('\nTiles:');
            slide.content.tiles.forEach((tile, i) => {
              console.log(`  ${i + 1}. ${tile.label}: ${tile.value}`);
              console.log(`     ${tile.context}`);
              console.log(`     Source: ${tile.source}`);
            });
          }
        }
        if (slide.evidence) {
          console.log(`\nEvidence: ${slide.evidence}`);
        }
        if (slide.mq_mapping && slide.mq_mapping.length > 0) {
          console.log(`\nMQ Mapping: ${slide.mq_mapping.join('; ')}`);
        }
      }
    });
    console.log(`\n${'='.repeat(80)}\n`);
    
    const filename = await savePPTX(deck);
    
    console.log('================================');
    console.log(`Final Result: ${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'}`);
    console.log(`Review: ${filename}`);
    console.log('================================\n');
    
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
