/**
 * Presentation Service
 * Creates PowerPoint presentations using pptxgenjs
 */

import pptxgen from 'pptxgenjs';

/**
 * Create a blank presentation with title slide
 * @param {string} title - Presentation title
 * @param {string} subtitle - Presentation subtitle (optional)
 * @returns {Promise<Buffer>} PowerPoint file as buffer
 */
export const createBlankPresentation = async (title, subtitle = '') => {
  console.log('📊 [PRESENTATION] Creating blank presentation...');
  console.log(`   Title: ${title}`);
  if (subtitle) console.log(`   Subtitle: ${subtitle}`);

  try {
    // Create new presentation
    const pres = new pptxgen();

    // Add title slide
    const slide = pres.addSlide();

    // Add title text (centered, large font)
    slide.addText(title, {
      x: 0.5,
      y: 2.5,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      color: '363636',
      align: 'center',
      valign: 'middle'
    });

    // Add subtitle if provided
    if (subtitle) {
      slide.addText(subtitle, {
        x: 0.5,
        y: 4.2,
        w: 9,
        h: 0.75,
        fontSize: 24,
        color: '666666',
        align: 'center',
        valign: 'middle'
      });
    }

    // Generate presentation as buffer
    const buffer = await pres.write({ outputType: 'nodebuffer' });

    console.log('✅ [PRESENTATION] Created successfully');
    console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);

    return buffer;
  } catch (error) {
    console.error('❌ [PRESENTATION] Error creating presentation:', error);
    throw error;
  }
};

export default {
  createBlankPresentation
};
