/**
 * Test Part Four Generation ONLY
 * Focus: Verify structurePlanningAgent generates exactly 15 MQ slides
 */

import dotenv from 'dotenv';
dotenv.config();

import { planStructure } from './agents/structurePlanningAgent.js';

const mockFacts = {
  scale: [
    { value: '160K+', label: 'Consultants globally' },
    { value: '65+', label: 'Countries' }
  ],
  capabilities: [
    { name: 'SAP S/4HANA', expertise: 'Cloud ERP implementations' },
    { name: 'Oracle Cloud', expertise: 'Enterprise resource planning' }
  ],
  partnerships: [
    { partner: 'SAP', type: 'Strategic Alliance' },
    { partner: 'Microsoft', type: 'Cloud Partnership' },
    { partner: 'AWS', type: 'Infrastructure Partner' }
  ]
};

const mqCriteria = [
  'Ability to Execute: Product/Service',
  'Ability to Execute: Overall Viability',
  'Ability to Execute: Sales Execution/Pricing',
  'Ability to Execute: Market Responsiveness and Track Record',
  'Ability to Execute: Marketing Execution',
  'Ability to Execute: Customer Experience',
  'Ability to Execute: Operations',
  'Completeness of Vision: Market Understanding',
  'Completeness of Vision: Marketing Strategy',
  'Completeness of Vision: Sales Strategy',
  'Completeness of Vision: Offering (Product) Strategy',
  'Completeness of Vision: Business Model',
  'Completeness of Vision: Vertical/Industry Strategy',
  'Completeness of Vision: Geographic Strategy',
  'Completeness of Vision: Innovation Roadmap'
];

async function testPartFour() {
  console.log('\n🧪 Testing Part Four Generation (MQ Section)\n');
  console.log(`Target: Exactly 15 slides`);
  console.log(`MQ Criteria to cover: ${mqCriteria.length} items\n`);

  try {
    const input = {
      facts: mockFacts,
      sectionName: 'Part Four: Gartner Magic Quadrant Positioning and Competitive Context',
      targetSlides: 15,
      requiredTopics: mqCriteria,
      keyPoints: ['MQ axis balance', 'Execute vs Vision positioning'],
      narrativeSpine: {
        market_tension: 'Digital transformation drives demand for scalable cloud ERP',
        ibm_differentiation: 'IBM combines global delivery scale with industry-specific expertise',
        proof_themes: ['global scale', 'delivery methodology', 'innovation pipeline'],
        memory_lines: ['Scale meets expertise', 'Delivery with differentiation'],
        slide_sequence_bias: 'balanced'
      }
    };

    console.log('📋 Calling planStructure with:');
    console.log(`   - targetSlides: ${input.targetSlides}`);
    console.log(`   - requiredTopics: ${input.requiredTopics.length} MQ criteria`);
    console.log(`   - narrativeSpine: Present ✓\n`);

    const startTime = Date.now();
    const result = await planStructure(input);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Structure Planning completed in ${duration}s\n`);
    console.log(`📊 RESULT: ${result.length} slides generated\n`);

    if (result.length !== 15) {
      console.error(`❌ FAILED: Expected 15 slides, got ${result.length}`);
      console.error('\nFirst 3 slides:');
      result.slice(0, 3).forEach((slide, i) => {
        console.error(`  [${i+1}] ${slide.topic}`);
      });
      if (result.length > 3) {
        console.error(`  ...\nLast 2 slides:`);
        result.slice(-2).forEach((slide, i) => {
          console.error(`  [${result.length - 1 + i}] ${slide.topic}`);
        });
      }
      process.exit(1);
    }

    console.log('📋 All 15 slides:');
    result.forEach((slide, i) => {
      const axis = slide.axis || 'MISSING';
      const layout = slide.layout || 'MISSING';
      console.log(`  [${String(i+1).padStart(2, ' ')}] ${slide.topic.substring(0, 50).padEnd(50)} | ${axis.padEnd(7)} | ${layout}`);
    });

    console.log('\n✅ VALIDATION:');
    
    // Check all have required fields
    const allValid = result.every((s, i) => {
      if (!s.slideNumber || s.slideNumber !== i + 1) return false;
      if (!s.layout) return false;
      if (!s.topic) return false;
      if (!s.factsToInclude || !Array.isArray(s.factsToInclude)) return false;
      if (!s.axis) return false;
      return true;
    });

    if (!allValid) {
      console.error('❌ Some slides missing required fields');
      process.exit(1);
    }
    console.log(`   ✓ All 15 slides have: slideNumber, layout, topic, factsToInclude, axis`);

    // Check slide numbers are 1-15
    const slideNumbers = result.map(s => s.slideNumber);
    const correctSequence = slideNumbers.every((n, i) => n === i + 1);
    if (!correctSequence) {
      console.error(`❌ Slide numbers not sequential: ${slideNumbers.join(', ')}`);
      process.exit(1);
    }
    console.log(`   ✓ Slide numbers: 1-15 sequential`);

    // Check axis balance
    const executeCount = result.filter(s => s.axis === 'Execute').length;
    const visionCount = result.filter(s => s.axis === 'Vision').length;
    console.log(`   ✓ Axis distribution: ${executeCount} Execute, ${visionCount} Vision`);

    // Check layouts are valid
    const validLayouts = ['L1_Executive_Header', 'L2_TwoColumn_Proof', 'L5_Metric_Tiles_3x1', 'L6_Table_2xN', 'L7_Roadmap_Timeline', 'L8_Risk_Mitigation'];
    const allLayoutsValid = result.every(s => validLayouts.includes(s.layout));
    if (!allLayoutsValid) {
      const invalidLayouts = result.filter(s => !validLayouts.includes(s.layout)).map(s => s.layout);
      console.error(`❌ Invalid layouts used: ${[...new Set(invalidLayouts)].join(', ')}`);
      process.exit(1);
    }
    console.log(`   ✓ All layouts valid`);

    console.log('\n🎉 PART FOUR TEST PASSED!\n');
    console.log('Ready for UI test.\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

testPartFour();
