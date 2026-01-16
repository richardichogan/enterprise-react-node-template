/**
 * Test pptx-automizer with IBM template
 * Verify we can load template and create slides
 */

import pptxAutomizer from 'pptx-automizer';
import path from 'path';
import { fileURLToPath } from 'url';

const Automizer = pptxAutomizer.default || pptxAutomizer;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing pptx-automizer with IBM Template\n');

async function testAutomizer() {
  try {
    const templatePath = path.join(__dirname, 'templates', 'ibm-template.pptx');
    const outputPath = path.join(__dirname, 'output', 'test-briefing.pptx');

    console.log('📄 Template path:', templatePath);
    console.log('📤 Output path:', outputPath);
    console.log('');

    // Initialize automizer
    const automizer = new Automizer({
      templateDir: path.join(__dirname, 'templates'),
      outputDir: path.join(__dirname, 'output'),
      removeExistingSlides: true,  // Start fresh
      cleanup: true,
      compression: 0,
      verbosity: 1
    });

    console.log('✅ Automizer initialized');
    console.log('📋 Loading IBM template and creating test slide...');

    // Load the IBM template as root
    const pres = automizer.loadRoot('ibm-template.pptx');
    
    // Load the same template as a source for slides
    automizer.load('ibm-template.pptx', 'ibm-template.pptx');
    
    // Now add slides from the template
    pres.addSlide('ibm-template.pptx', 1);
    
    console.log('   ✅ Slide 1 added from template');

    console.log('💾 Writing output...');

    // Write to output file
    await pres.write('test-briefing.pptx');

    console.log('✅ SUCCESS! Test presentation created at:', outputPath);
    console.log('\n📊 Next steps:');
    console.log('1. Open the test presentation to verify IBM template is applied');
    console.log('2. Check if title was modified correctly');
    console.log('3. If successful, integrate into briefingDeckService.js');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAutomizer();
