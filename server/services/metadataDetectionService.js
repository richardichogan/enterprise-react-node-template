/**
 * Document Metadata Detection Service
 * Auto-detects document type and assigns metadata based on filename + content analysis
 * 
 * Returns: { type, confidence, metadata }
 */

import fs from 'fs/promises';

/**
 * Metadata type definitions
 */
const METADATA_TYPES = {
  RFI_RESPONSE: {
    id: 'rfi_response',
    label: 'RFI Response',
    description: 'Vendor answers to analyst questions (PRIMARY CONTENT)',
    priority: 'CRITICAL',
    source_category: 'fact_sources'
  },
  BRIEFING_DECK: {
    id: 'briefing_deck',
    label: 'Briefing Deck',
    description: 'Presentation structure and agenda (CONSTRAINT)',
    priority: 'HIGH',
    source_category: 'primary_signposts'
  },
  WELCOME_PACK: {
    id: 'welcome_pack',
    label: 'Welcome Pack',
    description: 'Evaluation criteria and guidelines (CONSTRAINT)',
    priority: 'HIGH',
    source_category: 'primary_signposts'
  },
  EXEMPLAR_SUBMISSION: {
    id: 'exemplar_submission',
    label: 'Exemplar Submission',
    description: 'Previous year submission (STYLE EXEMPLAR)',
    priority: 'MEDIUM',
    source_category: 'primary_signposts'
  },
  FACT_SOURCE: {
    id: 'fact_source',
    label: 'Fact Source',
    description: 'Case studies, metrics, whitepapers (SUPPORTING FACTS)',
    priority: 'HIGH',
    source_category: 'fact_sources'
  },
  SECONDARY_CONTEXT: {
    id: 'secondary_context',
    label: 'Secondary Context',
    description: 'Reference material (OPTIONAL CONTEXT)',
    priority: 'LOW',
    source_category: 'secondary_context'
  },
  UNKNOWN: {
    id: 'unknown',
    label: 'Unknown',
    description: 'Document type unclear - needs user input',
    priority: 'LOW',
    source_category: 'secondary_context'
  }
};

/**
 * Filename pattern matching rules (Priority 1: Fastest, Most Reliable)
 * IMPORTANT: Patterns are evaluated in order - first match wins
 * More specific patterns come FIRST to prevent false positives
 */
const FILENAME_PATTERNS = {
  'exemplar_submission': {
    patterns: [
      /^.*\b(2024|2023|2022|2021)\s+(Briefing|briefing|Submission|submission|MQ)\b.*\.(pptx?|pdf)$/,
      /^.*\b(Previous|previous|Last|last)\s+(Year|year|Years|years)\s+(Submission|submission|MQ)\b.*\.(pptx?|pdf)$/
    ],
    confidence: 'high'
  },
  'welcome_pack': {
    patterns: [
      /^.*\b(Welcome|welcome)\s+(Pack|pack)\b.*\.(docx?|pdf)$/,
      /^.*\b(Kick.?off|Kickoff)\s+(Guidelines|guidelines|Kit)\b.*\.(docx?|pdf)$/,
      /^.*\b(Evaluation|evaluation)\s+(Criteria|criteria|Framework|framework)\b.*\.(docx?|pdf)$/
    ],
    confidence: 'high'
  },
  'briefing_deck': {
    patterns: [
      /^.*\b(Briefing|briefing)\s+(Deck|deck)\b.*\.(pptx?|pdf)$/,
      /^.*\b(Briefing|briefing)\s+(Agenda|agenda)\b.*\.(pptx?|pdf)$/,
      /^.*\bAgenda\b.*\.(pptx?|pdf)$/
    ],
    confidence: 'high'
  },
  'fact_source': {
    patterns: [
      /^.*\b(Case|case)\s+(Study|study)\b.*\.(docx?|pdf|xlsx?)$/,
      /^.*\b(Whitepaper|whitepaper)\b.*\.(docx?|pdf|xlsx?)$/,
      /^.*\b(Datasheet|datasheet)\b.*\.(docx?|pdf|xlsx?)$/,
      /^.*\b(Capabilities?|capabilities?)\b.*\.(docx?|pdf|xlsx?)$/
    ],
    confidence: 'high'
  },
  'rfi_response': {
    patterns: [
      /\b(RFI|rfi)\b.*\b(Response|response|Submission|submission)\b.*\.(docx?|pdf|txt)$/,
      /\b(Response|response|Submission|submission)\b.*\.(docx?|pdf|txt)$/,
      /^.*\b(2026|2025).*\b(Response|response|Submission|submission)\b.*\.(docx?|pdf|txt)$/
    ],
    confidence: 'high'
  }
};

/**
 * Content analysis patterns (Priority 2: Fallback if filename unclear)
 */
const CONTENT_PATTERNS = {
  'rfi_response': {
    keywords: ['Question:', 'Response:', 'Answer:', 'RFI', 'Submission', 'We provide', 'Our approach', 'Capability:'],
    sections: ['Executive Summary', 'Methodology', 'Implementation', 'Support'],
    confidence: 'medium'
  },
  'briefing_deck': {
    keywords: ['Agenda', 'Part One:', 'Part Two:', 'Part Three:', 'Slide', 'Duration:', 'Minutes'],
    sections: ['Vision', 'Execution', 'Case Studies', 'Q&A'],
    confidence: 'medium'
  },
  'welcome_pack': {
    keywords: ['Evaluation Criteria', 'Assessment Framework', 'Key Metrics', 'Dimensions', 'Analyst', 'MQ', 'Magic Quadrant'],
    sections: ['Overview', 'Requirements', 'Evaluation', 'Submission'],
    confidence: 'medium'
  },
  'fact_source': {
    keywords: ['Client:', 'Challenge:', 'Solution:', 'Outcome:', 'Results:', 'Case Study', 'Implementation', 'Deployment'],
    sections: ['Background', 'Challenge', 'Approach', 'Results', 'Metrics'],
    confidence: 'low'
  }
};

/**
 * Detect document metadata from filename
 * @param {string} filename - Document filename
 * @returns {object|null} - { type, confidence } or null if no match
 */
function detectByFilename(filename) {
  for (const [docType, config] of Object.entries(FILENAME_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(filename)) {
        return {
          type: docType,
          confidence: config.confidence,
          method: 'filename_pattern'
        };
      }
    }
  }
  return null;
}

/**
 * Detect document metadata from content analysis
 * @param {string} content - First 2000 chars of document content
 * @returns {object|null} - { type, confidence } or null if no match
 */
function detectByContent(content) {
  if (!content || content.length < 100) return null;

  const contentLower = content.toLowerCase();
  const scores = {};

  // Score each document type based on keyword/section presence
  for (const [docType, config] of Object.entries(CONTENT_PATTERNS)) {
    let score = 0;
    const weights = {
      keyword: 2,
      section: 3
    };

    // Check keywords
    for (const keyword of config.keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        score += weights.keyword;
      }
    }

    // Check sections
    for (const section of config.sections) {
      if (contentLower.includes(section.toLowerCase())) {
        score += weights.section;
      }
    }

    if (score > 0) {
      scores[docType] = score;
    }
  }

  // Return highest scoring type if score > threshold
  const highestType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (highestType && highestType[1] >= 5) {
    // Determine confidence based on score
    let confidence = 'low';
    if (highestType[1] >= 15) confidence = 'high';
    else if (highestType[1] >= 10) confidence = 'medium';

    return {
      type: highestType[0],
      confidence: confidence,
      method: 'content_analysis',
      score: highestType[1]
    };
  }

  return null;
}

/**
 * Main detection function
 * @param {string} filename - Document filename
 * @param {Buffer|string} content - Document content (for analysis if needed)
 * @returns {Promise<object>} - { type, confidence, metadata, method, analysis }
 */
export async function detectDocumentMetadata(filename, content = null) {
  // Priority 1: Try filename matching (fastest, most reliable)
  const filenameMatch = detectByFilename(filename);
  if (filenameMatch && filenameMatch.confidence === 'high') {
    const metadata = METADATA_TYPES[filenameMatch.type.toUpperCase()] || METADATA_TYPES.UNKNOWN;
    return {
      type: filenameMatch.type,
      confidence: 'high',
      metadata: metadata,
      method: filenameMatch.method,
      analysis: `Matched filename pattern: ${filename}`
    };
  }

  // Priority 2: Try content analysis if content provided
  if (content) {
    // Convert buffer to string if needed
    let contentStr = content;
    if (Buffer.isBuffer(content)) {
      contentStr = content.toString('utf8', 0, Math.min(2000, content.length));
    }

    const contentMatch = detectByContent(contentStr);
    if (contentMatch && contentMatch.confidence !== 'low') {
      const metadata = METADATA_TYPES[contentMatch.type.toUpperCase()] || METADATA_TYPES.UNKNOWN;
      return {
        type: contentMatch.type,
        confidence: contentMatch.confidence,
        metadata: metadata,
        method: contentMatch.method,
        analysis: `Content analysis score: ${contentMatch.score}`,
        filenameHint: filenameMatch ? `(filename suggested: ${filenameMatch.type})` : ''
      };
    }
  }

  // Priority 3: If we got a medium confidence from filename, use it
  if (filenameMatch && filenameMatch.confidence === 'medium') {
    const metadata = METADATA_TYPES[filenameMatch.type.toUpperCase()] || METADATA_TYPES.UNKNOWN;
    return {
      type: filenameMatch.type,
      confidence: 'medium',
      metadata: metadata,
      method: filenameMatch.method,
      analysis: `Moderate filename pattern match: ${filename}`
    };
  }

  // Priority 4: Unknown - requires user input
  return {
    type: 'unknown',
    confidence: 'low',
    metadata: METADATA_TYPES.UNKNOWN,
    method: 'user_override_required',
    analysis: `Could not auto-detect. Filename: ${filename}`,
    availableTypes: Object.values(METADATA_TYPES).filter(m => m.id !== 'unknown')
  };
}

/**
 * Get all available metadata types
 * @returns {object} - All metadata type definitions
 */
export function getAvailableMetadataTypes() {
  return METADATA_TYPES;
}

export default {
  detectDocumentMetadata,
  getAvailableMetadataTypes,
  METADATA_TYPES
};
