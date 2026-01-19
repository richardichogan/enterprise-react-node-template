import React, { useState, useCallback } from 'react';
import './StrategicContext.scss';

export interface StrategicContextData {
  keyMessages: string[];
  positioningFocus: string[]; // Auto-extracted from welcome pack
  toneStyle: string; // Hard-coded to 'Professional & Formal'
  tabooTopics: string[];
  isComplete: boolean;
}

interface StrategicContextProps {
  onStrategicContextChange: (context: StrategicContextData) => void;
  initialData?: StrategicContextData;
}

const StrategicContext: React.FC<StrategicContextProps> = ({
  onStrategicContextChange,
  initialData = {
    keyMessages: ['', '', '', '', ''],
    positioningFocus: [],
    toneStyle: '',
    tabooTopics: [],
    isComplete: false,
  },
}) => {
  const [keyMessages, setKeyMessages] = useState<string[]>(initialData.keyMessages || ['', '', '', '', '']);
  // Positioning focus auto-extracted from welcome pack (read-only)
  const positioningFocus = initialData.positioningFocus || [];
  // Tone/Style hard-coded to analyst standard
  const toneStyle = 'Professional & Formal';
  const [tabooTopics, setTabooTopics] = useState<string[]>(initialData.tabooTopics || []);
  const [tabooInput, setTabooInput] = useState<string>('');

  // Tone/Style options
  const toneOptions = [
    'Professional & Formal',
    'Confident & Bold',
    'Consultative & Collaborative',
    'Technical & Detailed',
    'Customer-Focused & Empathetic',
    'Innovation-Focused & Forward-Looking',
  ];

  // Determine completion status
  const isComplete = useCallback(() => {
    const hasKeyMessages = keyMessages.some((msg) => msg.trim().length > 0);
    // Positioning and tone are auto-set, only check taboos
    const hasTaboos = tabooTopics.length > 0;
    return hasKeyMessages && hasTaboos;
  }, [keyMessages, positioningFocus, toneStyle, tabooTopics]);

  // Update key messages
  const handleKeyMessageChange = (index: number, value: string) => {
    const updated = [...keyMessages];
    updated[index] = value;
    setKeyMessages(updated);
    notifyChange(updated, positioningFocus, toneStyle, tabooTopics);
  };

  // Add taboo topic
  const handleAddTaboo = () => {
    if (tabooInput.trim().length > 0) {
      const updated = [...tabooTopics, tabooInput.trim()];
      setTabooTopics(updated);
      setTabooInput('');
      notifyChange(keyMessages, positioningFocus, toneStyle, updated);
    }
  };

  // Remove taboo topic
  const handleRemoveTaboo = (index: number) => {
    const updated = tabooTopics.filter((_, i) => i !== index);
    setTabooTopics(updated);
    notifyChange(keyMessages, positioningFocus, toneStyle, updated);
  };

  // Notify parent of changes
  const notifyChange = (messages: string[], positioning: string[], tone: string, taboos: string[]) => {
    const contextData: StrategicContextData = {
      keyMessages: messages,
      positioningFocus: positioning,
      toneStyle: tone,
      tabooTopics: taboos,
      isComplete: isComplete(),
    };
    onStrategicContextChange(contextData);
  };

  return (
    <div className="strategic-context">
      {/* Key Messages Section */}
      <div className="context-section">
        <div className="section-header">
          <h3>Key Messages</h3>
          <span className="section-badge">up to 5</span>
        </div>
        <p className="section-description">
          Core messages to emphasize in responses. Leave blank for messages you don't need.
        </p>
        <div className="key-messages-grid">
          {keyMessages.map((message, index) => (
            <div key={index} className="message-input-group">
              <label>Message {index + 1}</label>
              <textarea
                value={message}
                onChange={(e) => handleKeyMessageChange(index, e.target.value)}
                placeholder={`Key message ${index + 1} (optional)`}
                rows={2}
              />
            </div>
          ))}
        </div>
        <div className="message-count">
          {keyMessages.filter((m) => m.trim().length > 0).length} / 5 messages entered
        </div>
      </div>

      {/* Positioning Focus Section - READ-ONLY (from welcome pack) */}
      <div className="context-section">
        <div className="section-header">
          <h3>Positioning Focus</h3>
          <span className="section-badge">Auto-Extracted</span>
        </div>
        <p className="section-description">
          Extracted from welcome pack document
        </p>
        <div className="tag-list">
          {positioningFocus.length === 0 ? (
            <div className="status-missing">Upload welcome pack to auto-extract positioning focus</div>
          ) : (
            positioningFocus.map((focus, index) => (
              <div key={index} className="tag">
                {focus}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tone/Style Section - HARD-CODED */}
      <div className="context-section">
        <div className="section-header">
          <h3>Tone & Style</h3>
          <span className="section-badge">Fixed</span>
        </div>
        <p className="section-description">
          Standard for analyst responses to Gartner, Forrester, etc.
        </p>
        <div className="tone-display">
          <div className="tone-value">Professional & Formal</div>
        </div>
      </div>

      {/* Taboo Topics Section */}
      <div className="context-section">
        <div className="section-header">
          <h3>Taboo Topics</h3>
          <span className="section-badge required">required</span>
        </div>
        <p className="section-description">
          Topics to avoid or downplay in responses (e.g., competitor comparisons, specific pricing).
        </p>
        <div className="taboo-input-group">
          <input
            type="text"
            value={tabooInput}
            onChange={(e) => setTabooInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddTaboo();
              }
            }}
            placeholder="Enter a topic to avoid and press Enter"
          />
          <button onClick={handleAddTaboo} className="btn-add">
            Add Topic
          </button>
        </div>
        <div className="tag-list">
          {tabooTopics.map((topic, index) => (
            <div key={index} className="tag taboo-tag">
              {topic}
              <button
                onClick={() => handleRemoveTaboo(index)}
                className="tag-remove"
                aria-label={`Remove ${topic}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {tabooTopics.length === 0 && (
          <div className="status-missing">No taboo topics defined</div>
        )}
      </div>
    </div>
  );
};

export default StrategicContext;
