/**
 * Test evaluation criteria for all analyst firms
 * Verifies that Gartner, Forrester, and IDC criteria load correctly
 */

import { getFrameworkCriteria } from './services/analystEvaluatorService.js';

console.log('🧪 Testing Analyst Evaluation Criteria\n');
console.log('=' .repeat(60));

const analysts = ['Gartner', 'Forrester', 'IDC'];

analysts.forEach(analyst => {
  console.log(`\n📊 ${analyst} Evaluation Framework`);
  console.log('-'.repeat(60));
  
  try {
    const criteria = getFrameworkCriteria(analyst);
    
    console.log(`Framework: ${criteria.framework}`);
    console.log(`Total Dimensions: ${criteria.dimensions.length}`);
    console.log('\nDimensions:');
    
    criteria.dimensions.forEach((d, idx) => {
      console.log(`  ${idx + 1}. ${d.name}`);
      console.log(`     Description: ${d.description}`);
      console.log(`     Focus: ${d.evaluationFocus}`);
    });
    
    console.log(`\n✅ ${analyst} criteria loaded successfully`);
    
  } catch (error) {
    console.error(`❌ ${analyst} criteria failed:`, error.message);
  }
});

console.log('\n' + '='.repeat(60));
console.log('✅ All analyst frameworks tested\n');
