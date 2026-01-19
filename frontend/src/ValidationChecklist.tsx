/**
 * Phase 4: Validation Checklist Component
 * Ensures all required documents and strategic context are in place before generation
 */

import React, { useState, useMemo } from 'react'
import { Checkbox } from '@carbon/react'
import './ValidationChecklist.scss'

interface ValidationChecklistProps {
  projectDocuments: Array<{
    name: string
    metadata?: {
      documentType: string
    }
  }>
  hasStrategicContext: boolean
  onValidationChange?: (isValid: boolean) => void
}

interface ChecklistState {
  briefingDeck: boolean
  welcomePack: boolean
  rfiResponse: boolean
  exemplar: boolean
  factSources: boolean
  strategicContext: boolean
  allDocumentsCurrentVersion: boolean
  confirmReady: boolean
}

export default function ValidationChecklist({
  projectDocuments,
  hasStrategicContext,
  onValidationChange
}: ValidationChecklistProps) {
  // Detect document types from project
  const documentsByType = useMemo(() => {
    return {
      briefingDeck: projectDocuments.some(d => d.metadata?.documentType === 'briefing_deck'),
      welcomePack: projectDocuments.some(d => d.metadata?.documentType === 'welcome_pack'),
      rfiResponse: projectDocuments.some(d => d.metadata?.documentType === 'rfi_response'),
      exemplar: projectDocuments.some(d => d.metadata?.documentType === 'exemplar_submission'),
      factSources: projectDocuments.some(d => d.metadata?.documentType === 'fact_source')
    }
  }, [projectDocuments])

  const [checklist, setChecklist] = useState<ChecklistState>({
    briefingDeck: documentsByType.briefingDeck,
    welcomePack: documentsByType.welcomePack,
    rfiResponse: documentsByType.rfiResponse,
    exemplar: documentsByType.exemplar,
    factSources: documentsByType.factSources,
    strategicContext: hasStrategicContext,
    allDocumentsCurrentVersion: false,
    confirmReady: false
  })

  // Update checklist when documents change
  React.useEffect(() => {
    setChecklist(prev => ({
      ...prev,
      briefingDeck: documentsByType.briefingDeck,
      welcomePack: documentsByType.welcomePack,
      rfiResponse: documentsByType.rfiResponse,
      exemplar: documentsByType.exemplar,
      factSources: documentsByType.factSources,
      strategicContext: hasStrategicContext
    }))
  }, [projectDocuments, hasStrategicContext])

  // Validate all required items
  const isValid = useMemo(() => {
    const requiredMet = (
      checklist.briefingDeck &&
      checklist.welcomePack &&
      checklist.rfiResponse &&
      checklist.factSources &&
      checklist.strategicContext &&
      checklist.allDocumentsCurrentVersion &&
      checklist.confirmReady
    )
    return requiredMet
  }, [checklist])

  // Notify parent of validation state
  React.useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid])

  const updateChecklist = (field: keyof ChecklistState, value: boolean) => {
    setChecklist(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="validation-checklist">
      <h3>📋 Project Setup Validation</h3>
      <p className="validation-note">
        Complete all items below before generating briefing deck
      </p>

      {/* Primary Signposts Section */}
      <div className="checklist-section">
        <h4 className="section-title">PRIMARY SIGNPOSTS (Required)</h4>
        <div className="section-description">
          Document structure and evaluation criteria
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="briefing-deck"
              checked={checklist.briefingDeck}
              disabled
              readOnly
              label="Briefing Deck uploaded"
            />
            {checklist.briefingDeck && (
              <span className="status-badge ready">✓ Ready</span>
            )}
            {!checklist.briefingDeck && (
              <span className="status-badge missing">✗ Missing</span>
            )}
          </div>
          <small className="item-note">Structure and agenda constraint</small>
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="welcome-pack"
              checked={checklist.welcomePack}
              disabled
              readOnly
              label="Welcome Pack uploaded"
            />
            {checklist.welcomePack && (
              <span className="status-badge ready">✓ Ready</span>
            )}
            {!checklist.welcomePack && (
              <span className="status-badge missing">✗ Missing</span>
            )}
          </div>
          <small className="item-note">Evaluation criteria and guidelines</small>
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="exemplar-submission"
              checked={checklist.exemplar}
              onChange={e => updateChecklist('exemplar', e.target.checked)}
              label="Exemplar Submission uploaded (optional)"
            />
            {checklist.exemplar && (
              <span className="status-badge ready">✓ Ready</span>
            )}
          </div>
          <small className="item-note">Previous year submission for style reference</small>
        </div>
      </div>

      {/* Fact Sources Section */}
      <div className="checklist-section">
        <h4 className="section-title">FACT SOURCES (Required)</h4>
        <div className="section-description">
          Primary content and supporting materials
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="rfi-response"
              checked={checklist.rfiResponse}
              disabled
              readOnly
              label="RFI Response uploaded"
            />
            {checklist.rfiResponse && (
              <span className="status-badge critical">⚠ CRITICAL</span>
            )}
            {!checklist.rfiResponse && (
              <span className="status-badge missing">✗ Missing</span>
            )}
          </div>
          <small className="item-note">Primary content - vendor response to RFI questions</small>
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="fact-sources"
              checked={checklist.factSources}
              disabled
              readOnly
              label="Supporting documents uploaded"
            />
            {checklist.factSources && (
              <span className="status-badge ready">✓ Ready</span>
            )}
            {!checklist.factSources && (
              <span className="status-badge missing">✗ Missing</span>
            )}
          </div>
          <small className="item-note">Case studies, metrics, whitepapers, capabilities</small>
          {checklist.factSources && (
            <div className="item-detail">
              Documents: {projectDocuments.filter(d => d.metadata?.documentType === 'fact_source').length}
            </div>
          )}
        </div>
      </div>

      {/* Strategic Context Section */}
      <div className="checklist-section">
        <h4 className="section-title">STRATEGIC CONTEXT (Required)</h4>
        <div className="section-description">
          Positioning and tone guidance
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="strategic-context"
              checked={checklist.strategicContext}
              disabled
              readOnly
              label="Strategic context completed"
            />
            {checklist.strategicContext && (
              <span className="status-badge ready">✓ Ready</span>
            )}
            {!checklist.strategicContext && (
              <span className="status-badge missing">✗ Missing</span>
            )}
          </div>
          <small className="item-note">Key messages, positioning focus, tone guidance</small>
        </div>
      </div>

      {/* Version Control Section */}
      <div className="checklist-section">
        <h4 className="section-title">VERSION CONTROL (Required)</h4>
        <div className="section-description">
          Ensure all documents are current
        </div>

        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="version-check"
              checked={checklist.allDocumentsCurrentVersion}
              onChange={e => updateChecklist('allDocumentsCurrentVersion', e.target.checked)}
              label="All documents are current versions"
            />
          </div>
          <small className="item-note">RFI is FINAL, briefing deck matches event, welcome pack is current</small>
        </div>
      </div>

      {/* Confirmation Section */}
      <div className="checklist-section confirmation">
        <div className="checklist-item">
          <div className="item-check">
            <Checkbox
              id="confirm-ready"
              checked={checklist.confirmReady}
              onChange={e => updateChecklist('confirmReady', e.target.checked)}
              label="I confirm all items above are complete and ready for generation"
            />
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className={`checklist-summary ${isValid ? 'valid' : 'invalid'}`}>
        <div className="summary-status">
          {isValid ? (
            <>
              <div className="status-icon">✓</div>
              <div className="status-text">
                <strong>Ready for generation</strong>
                <small>All requirements met</small>
              </div>
            </>
          ) : (
            <>
              <div className="status-icon">⚠</div>
              <div className="status-text">
                <strong>Not ready</strong>
                <small>Complete missing items to proceed</small>
              </div>
              <div className="missing-items">
                {!checklist.briefingDeck && <div>• Briefing Deck</div>}
                {!checklist.welcomePack && <div>• Welcome Pack</div>}
                {!checklist.rfiResponse && <div>• RFI Response</div>}
                {!checklist.factSources && <div>• Fact Sources</div>}
                {!checklist.strategicContext && <div>• Strategic Context</div>}
                {!checklist.allDocumentsCurrentVersion && <div>• Version Control Confirmation</div>}
                {!checklist.confirmReady && <div>• Final Confirmation</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
