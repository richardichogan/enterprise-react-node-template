import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import './App.scss'
import './styles/documentsTable.scss'
import StrategicContext, { StrategicContextData } from './StrategicContext'
import { 
  Tabs, 
  TabList, 
  Tab, 
  TabPanels, 
  TabPanel,
  TextArea,
  TextInput,
  Button,
  Select,
  SelectItem,
  InlineNotification,
  RadioButtonGroup,
  RadioButton
} from '@carbon/react'
import { TrashCan } from '@carbon/icons-react'

interface Project {
  id: string
  name: string
  analyst: string
  category: string
  technologyFocus: string
  partner: string
  documents: UploadedDocument[]
  createdAt: string
  updatedAt: string
}

interface UploadedDocument {
  name: string
  size: number
  uploadDate: string
  url: string
  metadata?: {
    documentType: string
    confidence: 'high' | 'medium' | 'low'
    priority: string
    sourceCategory: string
    isPrimaryContent: boolean
    retrievalWeight: number
    detectionMethod: string
    analysis: string
  }
}

interface RFIResponse {
  answer: string
  usedDocumentCollection: boolean
  usedDocuments?: string[]
  collectionName?: string
  model?: string
  tokensUsed?: number
  characterLimitExceeded?: boolean
  characterCount?: number
  characterLimit?: number
  evaluation?: {
    framework: string
    totalDimensions: number
    dimensions: Array<{
      name: string
      score: number
      evidence: string[]
      reasoning: string
      gaps: string[]
    }>
    totalScore: number
    verdict: string
    gapAnalysis: string[]
    rewriteSuggestions: string[]
    complianceNotes: string
  }
}

const ANALYSTS = ['Gartner', 'Forrester', 'IDC', 'Magic Quadrant', 'Custom']
const ANSWER_TYPES = ['Single', 'Multi-Section']

export default function App() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const [loading, setLoading] = useState(false)
  const [loadingStage, setLoadingStage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [availableDocuments, setAvailableDocuments] = useState<UploadedDocument[]>([])
  
  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  // Project setup fields
  const [analyst, setAnalyst] = useState('')
  const [category, setCategory] = useState('')
  const [technologyFocus, setTechnologyFocus] = useState('')
  const [partner, setPartner] = useState('')

  // Question/Answer fields
  const [question, setQuestion] = useState('')
  const [guidance, setGuidance] = useState('')
  const [characterLimit, setCharacterLimit] = useState<number | ''>('')
  const [answerType, setAnswerType] = useState('Single')
  const [generatedResponse, setGeneratedResponse] = useState<RFIResponse | null>(null)
  
  // Score Analyzer fields
  const [evaluationResponse, setEvaluationResponse] = useState('')
  const [evaluationResult, setEvaluationResult] = useState<any>(null)

  // Presentation state
  const [presentationTitle, setPresentationTitle] = useState('')
  const [presentationSubtitle, setPresentationSubtitle] = useState('')
  const [presentationMode, setPresentationMode] = useState<'blank' | 'briefing'>('blank')
  
  // Briefing Deck state
  const [briefingPack, setBriefingPack] = useState('')
  const [briefingInstructions, setBriefingInstructions] = useState('')
  const [briefingResponse, setBriefingResponse] = useState('')
  const [ibmSupportingMaterials, setIbmSupportingMaterials] = useState<string[]>([])  // Multi-select for example decks/slides
  const [briefingAnalystFirm, setBriefingAnalystFirm] = useState('Gartner')
  const [briefingModel, setBriefingModel] = useState('global/gpt-4o')
  const [deckStructure, setDeckStructure] = useState<any>(null)
  const [analyzedStructure, setAnalyzedStructure] = useState<any>(null)
  const [sectionConfig, setSectionConfig] = useState<Record<string, 'content' | 'break' | 'skip'>>({})
  const [generatingDeck, setGeneratingDeck] = useState(false)

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [projectDocuments, setProjectDocuments] = useState<UploadedDocument[]>([])
  const [detectedMetadata, setDetectedMetadata] = useState<any>(null)
  const [metadataOverride, setMetadataOverride] = useState<string | null>(null)
  const [validationPassed, setValidationPassed] = useState(false)
  const [strategicContext, setStrategicContext] = useState<StrategicContextData>({
    keyMessages: [],
    positioningFocus: [],
    toneStyle: '',
    tabooTopics: [],
    isComplete: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Load projects from localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('rfi_projects')
    if (!savedProjects) return

    try {
      const parsed = JSON.parse(savedProjects)
      if (!Array.isArray(parsed)) {
        // Clear invalid data to avoid runtime errors
        localStorage.removeItem('rfi_projects')
        return
      }

      // Ensure documents field exists
      const normalised: Project[] = parsed.map((p: Project) => ({
        ...p,
        documents: Array.isArray(p.documents) ? p.documents : []
      }))

      setProjects(normalised)
      if (normalised.length > 0) {
        setCurrentProjectId(normalised[0].id)
      }
    } catch (e) {
      console.error('Failed to load projects:', e)
      localStorage.removeItem('rfi_projects')
    }
  }, [])

  // Update project fields when current project changes
  useEffect(() => {
    const current = projects.find(p => p.id === currentProjectId)
    if (current) {
      setAnalyst(current.analyst)
      setCategory(current.category)
      setTechnologyFocus(current.technologyFocus)
      setPartner(current.partner)
      setProjectDocuments(current.documents)
    }
  }, [currentProjectId, projects])

  // Load available documents from API (pre-uploaded)
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const resp = await fetch(`${apiUrl}/api/documents`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (Array.isArray(data.documents)) {
          const docs: UploadedDocument[] = data.documents.map((doc: any) => ({
            name: doc.blobName || doc.name,
            size: doc.size ?? 0,
            uploadDate: doc.uploadDate || doc.createdOn || new Date().toISOString(),
            url: doc.url || doc.blobUrl || '',
            analyst: doc.analyst || 'Unknown',
            metadata: doc.metadata || { documentType: 'secondary_context' }
          }))
          // Sort by analyst (current project analyst first), then by date descending
          docs.sort((a, b) => {
            if (a.analyst === analyst && b.analyst !== analyst) return -1
            if (a.analyst !== analyst && b.analyst === analyst) return 1
            if (a.analyst !== b.analyst) return a.analyst.localeCompare(b.analyst)
            return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
          })
          setAvailableDocuments(docs)
        }
      } catch (err) {
        console.warn('Failed to load available documents', err)
      }
    }

    loadDocuments()
  }, [apiUrl])

  // Persist projects to server JSON (and localStorage fallback)
  const persistProjects = async (projectsToSave: Project[], nextCurrentId?: string | null) => {
    setProjects(projectsToSave)
    if (nextCurrentId !== undefined) {
      setCurrentProjectId(nextCurrentId)
    }

    localStorage.setItem('rfi_projects', JSON.stringify(projectsToSave))

    try {
      await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: projectsToSave })
      })
    } catch (err) {
      console.error('Failed to save projects to server', err)
      setError('Failed to save projects to server. Changes may not persist.')
    }
  }

  // Create new project
  const createProject = () => {
    if (!newProjectName.trim()) {
      setError('Project name is required')
      return
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: newProjectName,
      analyst: '',
      category: '',
      technologyFocus: '',
      partner: '',
      documents: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const updated = [...projects, newProject]
    persistProjects(updated, newProject.id)
    setNewProjectName('')
    setShowNewProject(false)
    setError(null)
  }

  // Update current project
  const updateCurrentProject = (updates: Partial<Project>) => {
    if (!currentProjectId) return

    const updated = projects.map(p =>
      p.id === currentProjectId
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    )
    persistProjects(updated)
  }

  // Save project setup
  const saveProjectSetup = async () => {
    if (!currentProjectId) return

    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const updated = projects.map(p =>
        p.id === currentProjectId
          ? {
              ...p,
              analyst,
              category,
              technologyFocus,
              partner,
              updatedAt: new Date().toISOString()
            }
          : p
      )

      console.log('📝 Saving project setup:', { analyst, category, technologyFocus, partner })
      console.log('📦 Updated projects:', JSON.stringify(updated, null, 2))

      setProjects(updated)
      localStorage.setItem('rfi_projects', JSON.stringify(updated))

      const resp = await fetch(`${apiUrl}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: updated })
      })

      console.log('✅ Server response:', resp.status)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const data = await resp.json()
      console.log('📨 Server saved:', data)

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('❌ Failed to save project setup:', err)
      setError(`Failed to save project: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Upload document
  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    setUploading(true)
    setUploadProgress(0)
    setUploadStatus('Uploading to server...')
    setLoading(true)
    setError(null)
    setDetectedMetadata(null)
    setMetadataOverride(null)

    try {
      const formData = new FormData()
      formData.append('document', file)
      formData.append('analyst', analyst || 'Unknown')

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(Math.round(percentComplete))
          if (percentComplete >= 100) {
            setUploadStatus('Processing... Detecting document type')
          }
        }
      })

      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              
              // Capture metadata from response
              if (response.document.metadata) {
                setDetectedMetadata(response.document.metadata)
                setUploadStatus(`Detected: ${response.document.metadata.documentType} (${response.document.metadata.confidence})`)
              }
              
              const doc: UploadedDocument = {
                name: response.document.blobName,
                size: response.document.size,
                uploadDate: response.document.uploadDate,
                url: response.document.url,
                analyst: analyst || 'Unknown',
                metadata: response.document.metadata
              }
              setProjectDocuments(prev => [...prev, doc])
              updateCurrentProject({
                documents: [...projectDocuments, doc]
              })
              setUploadStatus('Upload complete!')
              
              // Keep UI visible for 3 seconds to show metadata
              setTimeout(() => {
                setDetectedMetadata(null)
              }, 3000)
              resolve()
            } catch (e) {
              reject(new Error('Invalid response from server'))
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText)
              reject(new Error(errorData.error || 'Upload failed'))
            } catch {
              reject(new Error(`Upload failed: ${xhr.statusText}`))
            }
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.open('POST', `${apiUrl}/api/documents/upload`)
        xhr.send(formData)
      })

      event.target.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploadStatus('Upload failed')
    } finally {
      setLoading(false)
      setUploading(false)
      setTimeout(() => {
        setUploadProgress(0)
        if (!detectedMetadata) {
          setUploadStatus('')
        }
      }, 2000)
    }
  }

  // Delete document from project
  const deleteDocument = (docName: string) => {
    const updated = projectDocuments.filter(d => d.name !== docName)
    setProjectDocuments(updated)
    updateCurrentProject({ documents: updated })
  }

  const toggleExistingDocument = (doc: UploadedDocument, attach: boolean) => {
    if (!currentProjectId) return

    const exists = projectDocuments.some(d => d.name === doc.name)
    if (attach && !exists) {
      const updated = [...projectDocuments, doc]
      setProjectDocuments(updated)
      updateCurrentProject({ documents: updated })
    } else if (!attach && exists) {
      const updated = projectDocuments.filter(d => d.name !== doc.name)
      setProjectDocuments(updated)
      updateCurrentProject({ documents: updated })
    }
  }

  // Generate RFI response
  const generateResponse = async () => {
    if (!question.trim()) {
      setError('Question is required')
      return
    }

    setLoading(true)
    setLoadingStage('📥 [1/6] Retrieving documents from project...')
    setError(null)
    try {
      setLoadingStage('📚 [2/6] Extracting text from documents...')
      setLoadingStage('🔍 [3/6] Scoring relevance of chunks...')
      setLoadingStage('⚙️  [4/6] Building system prompt...')
      setLoadingStage('🤖 [5/6] Generating response with AI...')
      
      const response = await fetch(`${apiUrl}/api/rfi/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analyst,
          category,
          technologyFocus,
          partner,
          question,
          guidance,
          characterLimit: characterLimit ? parseInt(characterLimit.toString()) : null,
          answerType,
          useDocumentCollection: true,
          documents: availableDocuments.map(doc => doc.name),  // Send ALL documents for RAG search
          documentMetadata: availableDocuments.reduce((acc, doc) => {
            acc[doc.name] = {
              analyst: doc.analyst || 'Unknown',
              documentType: doc.metadata?.documentType || 'secondary_context'
            }
            return acc
          }, {} as Record<string, any>)  // Send analyst + type for AI filtering priority
        })
      })
      if (!response.ok) throw new Error(`API error: ${response.statusText}`)
      
      setLoadingStage('✨ [6/6] Finalizing response...')
      const data = await response.json()
      setGeneratedResponse(data)
      setLoadingStage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoadingStage('')
    } finally {
      setLoading(false)
    }
  }

  // Analyze Briefing Structure
  const analyzeBriefingStructure = async () => {
    // Auto-detect documents based on metadata if user hasn't selected manually
    // Fallback provided for manual overrides
    const briefingPackContent = await getBriefingPackContent();
    const briefingInstructionsContent = await getBriefingInstructionsContent();

    if (!briefingPackContent || !briefingInstructionsContent) {
      setError('Briefing pack and instructions are required. Please ensure documents are uploaded to the project.')
      return
    }

    setGeneratingDeck(true)
    setError(null)
    setLoadingStage('Analyzing briefing structure...')

    try {
      const response = await fetch(`${apiUrl}/api/presentations/analyze-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefingPack: briefingPackContent,
          briefingInstructions: briefingInstructionsContent,
          analystFirm: briefingAnalystFirm
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to analyze structure: ${response.statusText}`)
      }

      const structure = await response.json()
      setAnalyzedStructure(structure)
      
      // Initialize section config - default all to 'content'
      const initialConfig: Record<string, 'content' | 'break' | 'skip'> = {}
      if (structure.sections && Array.isArray(structure.sections)) {
        structure.sections.forEach((section: any) => {
          // Heuristic: Default Q&A to 'break' (header only)
          const isQA = section.name?.toLowerCase().includes('q&a') || section.name?.toLowerCase().includes('questions');
          initialConfig[section.name] = isQA ? 'break' : 'content';
        })
      }
      setSectionConfig(initialConfig)
      
      setLoadingStage('✅ Structure analyzed successfully! Please review sections below.')
      setTimeout(() => setLoadingStage(''), 3000)
    } catch (err) {
      console.error('Structure analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze structure')
    } finally {
      setGeneratingDeck(false)
    }
  }

  // Helper to get content for briefing pack (either manual or auto-detected)
  const getBriefingPackContent = async () => {
    if (briefingPack) return briefingPack;
    
    // Auto-detect from project documents
    // Priority: metadata.documentType === 'briefing_pack' -> filename includes 'briefing'
    const doc = availableDocuments.find(d => 
      d.metadata?.documentType === 'briefing_deck' || 
      d.name.toLowerCase().includes('briefing')
    );
    
    if (doc) {
      const resp = await fetch(`${apiUrl}/api/documents/download/${doc.name}`);
      if (resp.ok) return await resp.text();
    }
    return null;
  }

  const getBriefingInstructionsContent = async () => {
    if (briefingInstructions) return briefingInstructions;
    
    // Auto-detect
    // Priority: metadata.documentType === 'primary_signposts' -> filename includes 'welcome' or 'instructions'
    const doc = availableDocuments.find(d => 
      d.metadata?.documentType === 'welcome_pack' || 
      d.metadata?.documentType === 'primary_signposts' ||
      d.name.toLowerCase().includes('welcome') ||
      d.name.toLowerCase().includes('instruction')
    );
    
    if (doc) {
      const resp = await fetch(`${apiUrl}/api/documents/download/${doc.name}`);
      if (resp.ok) return await resp.text();
    }
    return null;
  }

  // Generate Briefing Deck Structure
  const generateBriefingDeck = async () => {
    const briefingPackContent = await getBriefingPackContent();
    const briefingInstructionsContent = await getBriefingInstructionsContent();

    if (!briefingPackContent || !briefingInstructionsContent) {
      setError('Briefing pack and instructions are required')
      return
    }

    setGeneratingDeck(true)
    setError(null)
    setLoadingStage('Step 1/4: Parsing briefing pack structure...')

    try {
      const response = await fetch(`${apiUrl}/api/presentations/generate-briefing-deck-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefingPack: briefingPackContent,
          briefingInstructions: briefingInstructionsContent,
          vendorResponse: briefingResponse,
          analystFirm: briefingAnalystFirm,
          model: briefingModel,
          sectionConfig // Pass user configuration
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to generate deck: ${response.statusText}`)
      }

      // Handle Server-Sent Events stream
      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.error) {
                throw new Error(data.error)
              }
              if (data.complete) {
                result = data
              } else if (data.message) {
                setLoadingStage(data.message)
              }
            } catch (parseErr) {
              console.error('Failed to parse SSE message:', parseErr)
            }
          }
        }
      }

      if (result) {
        setDeckStructure(result.deck)
        setLoadingStage('✅ Deck structure generated successfully!')
        setTimeout(() => setLoadingStage(''), 3000)
      }
    } catch (err) {
      console.error('Deck generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate deck structure')
    } finally {
      setGeneratingDeck(false)
    }
  }

  // Download PowerPoint from Deck Structure
  const downloadPresentation = async () => {
    if (!deckStructure) return

    setLoading(true)
    setError(null)
    setLoadingStage('Creating PowerPoint file...')

    try {
      const response = await fetch(`${apiUrl}/api/presentations/create-from-deck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deckStructure,
          filename: presentationTitle || 'Briefing_Deck'
        })
      })

      if (!response.ok) {
        // Try to get detailed error from JSON response
        try {
          const errorData = await response.json()
          throw new Error(errorData.details || errorData.error || `Failed to create presentation: ${response.statusText}`)
        } catch (jsonErr) {
          throw new Error(`Failed to create presentation: ${response.statusText}`)
        }
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(presentationTitle || 'Briefing_Deck').replace(/[^a-z0-9]/gi, '_')}.pptx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setLoadingStage('✅ Presentation downloaded successfully!')
      setTimeout(() => setLoadingStage(''), 3000)
    } catch (err) {
      console.error('Presentation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create presentation')
    } finally {
      setLoading(false)
    }
  }

  const currentProject = projects.find(p => p.id === currentProjectId)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>RFI-Helper</h1>
          <p>AI-Powered RFI Response Assistant</p>
        </div>
        {currentProject && (
          <div className="project-info">
            <strong>{currentProject.name}</strong>
            <small>{currentProject.partner ? `${currentProject.partner} • ${currentProject.category}` : 'Project'}</small>
          </div>
        )}
      </header>

      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          style={{ margin: '1rem 2rem', maxWidth: 'none' }}
        />
      )}

      <div className="app-content">
        <Tabs>
          <TabList aria-label="RFI Helper tools" contained>
            <Tab>Projects</Tab>
            <Tab>Project Setup</Tab>
            <Tab>Generate Response</Tab>
            <Tab>Score Analyzer</Tab>
            <Tab>Presentation Outline</Tab>
          </TabList>

          <TabPanels>
            {/* Projects Tab */}
            <TabPanel>
              <div className="panel-content">
                <h2>Manage Projects</h2>
                
                {!showNewProject ? (
                  <Button onClick={() => setShowNewProject(true)} style={{ marginBottom: '1.5rem' }}>
                    New Project
                  </Button>
                ) : (
                  <div className="new-project-form" style={{ marginBottom: '1.5rem' }}>
                    <TextInput
                      labelText="Project Name"
                      placeholder="e.g., Microsoft D365 Response"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      style={{ marginBottom: '1rem' }}
                    />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <Button onClick={createProject}>Create</Button>
                      <Button kind="secondary" onClick={() => setShowNewProject(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {projects.length === 0 ? (
                  <div className="empty-state">
                    <p>No projects yet. Create one to get started!</p>
                  </div>
                ) : (
                  <div className="project-list">
                    {projects.map(p => (
                      <div key={p.id} className={`project-item ${p.id === currentProjectId ? 'active' : ''}`}>
                        <div className="project-details">
                          <strong>{p.name}</strong>
                          <small>{p.partner ? `${p.partner} • ${p.category}` : 'Unconfigured'}</small>
                          <small style={{ marginTop: '0.25rem' }}>
                            Created: {new Date(p.createdAt).toLocaleDateString()}
                          </small>
                        </div>
                        <div className="project-actions">
                          <Button
                            kind={p.id === currentProjectId ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => setCurrentProjectId(p.id)}
                          >
                            {p.id === currentProjectId ? 'Active' : 'Switch'}
                          </Button>
                          <Button
                            kind="danger--ghost"
                            size="sm"
                            onClick={() => {
                              const updated = projects.filter(x => x.id !== p.id)
                              const nextId = p.id === currentProjectId && updated.length > 0 ? updated[0].id : null
                              persistProjects(updated, nextId)
                            }}
                          >
                            <TrashCan size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabPanel>

            {/* Project Setup Tab */}
            <TabPanel>
              <div className="panel-content">
                <h2>Project Setup</h2>
                {!currentProject ? (
                  <div className="empty-state">
                    <p>Create or select a project first</p>
                  </div>
                ) : (
                  <Tabs>
                    <TabList aria-label="Project setup sections">
                      <Tab>Project Info</Tab>
                      <Tab>Documents</Tab>
                    </TabList>

                    <TabPanels>
                      {/* Project Info Tab */}
                      <TabPanel>
                        <div style={{ padding: '1rem 0' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <Select
                              labelText="Analyst"
                              value={analyst}
                              onChange={(e) => setAnalyst(e.target.value)}
                            >
                              <SelectItem value="" text="Select analyst..." />
                              {ANALYSTS.map(a => (
                                <SelectItem key={a} value={a} text={a} />
                              ))}
                            </Select>

                            <TextInput
                              labelText="Category"
                              placeholder="e.g., MQ Cloud ERP"
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                            />

                            <TextInput
                              labelText="Technology Focus"
                              placeholder="e.g., D365"
                              value={technologyFocus}
                              onChange={(e) => setTechnologyFocus(e.target.value)}
                            />

                            <TextInput
                              labelText="Partner"
                              placeholder="e.g., Microsoft"
                              value={partner}
                              onChange={(e) => setPartner(e.target.value)}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Button 
                              onClick={saveProjectSetup} 
                              disabled={isSaving}
                            >
                              {isSaving ? 'Saving...' : 'Save Project Setup'}
                            </Button>
                            {saveSuccess && (
                              <small style={{ color: '#24a148', fontWeight: 'bold' }}>✓ Saved successfully</small>
                            )}
                          </div>
                        </div>
                      </TabPanel>

                      {/* Documents Tab */}
                      <TabPanel>
                        <div style={{ padding: '1rem 0' }}>
                          <h3 style={{ marginBottom: '1rem' }}>Upload New Document</h3>
                          <div className="upload-section">
                            <input
                              type="file"
                              accept=".pdf,.docx,.pptx"
                              onChange={uploadDocument}
                              disabled={uploading}
                            />
                            {uploading && (
                              <div className="upload-progress">
                                <div className="progress-bar">
                                  <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                                </div>
                                <small>{uploadStatus} {uploadProgress < 100 ? `${uploadProgress}%` : ''}</small>
                              </div>
                            )}
                          </div>

                          <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Available Documents ({availableDocuments.length})</h3>
                          {availableDocuments.length === 0 ? (
                            <div className="empty-state">
                              <p>No documents in Azure storage</p>
                            </div>
                          ) : (
                            <table className="doc-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                                  <th style={{ padding: '0.5rem 0.5rem', width: '35%' }}>Document Name</th>
                                  <th style={{ padding: '0.5rem 0.5rem', width: '12%' }}>Analyst</th>
                                  <th style={{ padding: '0.5rem 0.5rem', width: '13%' }}>Upload Date</th>
                                  <th style={{ padding: '0.5rem 0.5rem', width: '10%' }}>Size</th>
                                  <th style={{ padding: '0.5rem 0.5rem', width: '22%' }}>Type</th>
                                  <th style={{ padding: '0.5rem 0.5rem', width: '8%' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {availableDocuments.map(doc => (
                                  <tr key={doc.name} style={{ borderBottom: '1px solid #e0e0e0', backgroundColor: doc.analyst === analyst ? '#e8f5e9' : 'transparent' }}>
                                    <td style={{ padding: '0.5rem 0.5rem' }}>
                                      <strong style={{ fontSize: '0.875rem' }}>{doc.name}</strong>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.5rem' }}>
                                      <span style={{ 
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: doc.analyst === analyst ? '#4caf50' : '#9e9e9e',
                                        color: 'white',
                                        borderRadius: '3px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold'
                                      }}>
                                        {doc.analyst}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.875rem' }}>
                                      {new Date(doc.uploadDate).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.5rem' }}>
                                      {(doc.size / (1024 * 1024)).toFixed(2)} MB
                                    </td>
                                    <td className="type-cell" style={{ padding: '0.5rem 0.5rem', verticalAlign: 'middle', height: '40px' }}>
                                      <Select
                                        id={`doc-type-${doc.name}`}
                                        labelText=""
                                        hideLabel
                                        className="doc-type-select"
                                        value={doc.metadata?.documentType || 'secondary_context'}
                                          onChange={async (e) => {
                                            const newType = e.target.value
                                            // Update local state immediately
                                            const updated = availableDocuments.map(d => 
                                              d.name === doc.name 
                                                ? { ...d, metadata: { ...d.metadata, documentType: newType } as any }
                                                : d
                                            )
                                            setAvailableDocuments(updated)
                                            
                                            // Save to backend
                                            try {
                                              const response = await fetch(`${apiUrl}/api/documents/${encodeURIComponent(doc.name)}/metadata`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ documentType: newType })
                                              })
                                              if (!response.ok) {
                                                console.error('Failed to save document type')
                                              }
                                            } catch (err) {
                                              console.error('Error saving document type:', err)
                                            }
                                          }}
                                          size="sm"
                                        >
                                          <SelectItem value="rfi_response" text="RFI Response" />
                                          <SelectItem value="briefing_deck" text="Briefing Deck" />
                                          <SelectItem value="welcome_pack" text="Welcome Pack" />
                                          <SelectItem value="exemplar_submission" text="Exemplar Submission" />
                                          <SelectItem value="fact_source" text="Fact Source" />
                                          <SelectItem value="secondary_context" text="Secondary Context" />
                                          <SelectItem value="unknown" text="Unknown" />
                                        </Select>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                                      <Button
                                        kind="danger--ghost"
                                        size="sm"
                                        onClick={() => deleteDocument(doc.name)}
                                        hasIconOnly
                                        iconDescription="Delete"
                                      >
                                        <TrashCan size={16} />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </TabPanel>

                      
                    </TabPanels>
                  </Tabs>
                )}
              </div>
            </TabPanel>

            {/* Generate Response Tab */}
            <TabPanel>
              <div className="panel-content">
                <h2>Generate RFI Response</h2>
                {!currentProject ? (
                  <div className="empty-state">
                    <p>Create or select a project first</p>
                  </div>
                ) : (
                  <>
                    <div style={{ backgroundColor: '#f4f4f4', padding: '1rem', borderRadius: '4px', marginBottom: '2rem' }}>
                      <small>
                        <strong>Project Context:</strong> {analyst || 'Not set'} • {partner || 'No partner'} • {category || 'No category'}
                      </small>
                    </div>

                    <TextArea
                      labelText="Question"
                      placeholder="Enter the RFI question..."
                      rows={4}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />

                    <TextArea
                      labelText="Guidance (Optional)"
                      placeholder="Specific guidance or constraints for this question..."
                      rows={3}
                      value={guidance}
                      onChange={(e) => setGuidance(e.target.value)}
                      style={{ marginTop: '1rem' }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                      <TextInput
                        labelText="Character Limit (Optional)"
                        type="number"
                        placeholder="e.g., 2000"
                        value={characterLimit}
                        onChange={(e) => setCharacterLimit(e.target.value ? parseInt(e.target.value) : '')}
                      />

                      <Select
                        labelText="Answer Type"
                        value={answerType}
                        onChange={(e) => setAnswerType(e.target.value)}
                      >
                        {ANSWER_TYPES.map(t => (
                          <SelectItem key={t} value={t} text={t} />
                        ))}
                      </Select>
                    </div>

                    <Button
                      onClick={generateResponse}
                      disabled={loading || !question}
                      style={{ marginTop: '1rem' }}
                    >
                      {loading ? 'Generating...' : 'Generate Response'}
                    </Button>

                    {loading && loadingStage && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        backgroundColor: '#e3f2fd',
                        border: '1px solid #90caf9',
                        borderRadius: '4px',
                        color: '#1976d2',
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }}>
                        {loadingStage}
                      </div>
                    )}

                    {generatedResponse && (
                      <div className="result-box">
                        <h3>Generated Response</h3>
                        {generatedResponse.usedDocuments && generatedResponse.usedDocuments.length > 0 && (
                          <div className="used-documents">
                            <strong>📄 Documents Used:</strong> {generatedResponse.usedDocuments.join(', ')}
                          </div>
                        )}
                        <div className="markdown-content">
                          <ReactMarkdown>{generatedResponse.answer}</ReactMarkdown>
                        </div>
                        {generatedResponse.model && (
                          <div className="metadata">
                            <small>Model: {generatedResponse.model} | Tokens: {generatedResponse.tokensUsed}</small>
                            {generatedResponse.characterLimitExceeded && (
                              <small> | ⚠️ Character limit exceeded - response truncated</small>
                            )}
                            {generatedResponse.characterLimit && (
                              <small> | {generatedResponse.characterCount}/{generatedResponse.characterLimit} characters</small>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabPanel>

            {/* Score Analyzer Tab */}
            <TabPanel>
              <div className="panel-content">
                <h2>Analyze Response Quality</h2>
                
                <div className="form-section">
                  <label>Analyst Framework</label>
                  <Select
                    id="evaluation-analyst"
                    labelText=""
                    value={analyst || 'Gartner'}
                    onChange={(e) => setAnalyst(e.target.value)}
                  >
                    <SelectItem value="Gartner" text="Gartner Magic Quadrant" />
                    <SelectItem value="Forrester" text="Forrester Wave" />
                    <SelectItem value="IDC" text="IDC MarketScape" />
                  </Select>
                </div>

                <div className="form-section">
                  <label htmlFor="analyst-question">Analyst Question</label>
                  <TextArea
                    id="analyst-question"
                    placeholder="Paste the exact analyst question here..."
                    rows={4}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                </div>

                <div className="form-section">
                  <label htmlFor="vendor-response">Your Response to Evaluate</label>
                  <TextArea
                    id="vendor-response"
                    placeholder="Paste your vendor response here..."
                    rows={12}
                    value={evaluationResponse}
                    onChange={(e) => setEvaluationResponse(e.target.value)}
                  />
                </div>

                <Button
                  kind="primary"
                  onClick={async () => {
                    if (!question || !evaluationResponse) {
                      setError('Both question and response are required for evaluation')
                      return
                    }

                    setLoading(true)
                    setError(null)
                    setLoadingStage('Evaluating response against analyst criteria...')

                    try {
                      const response = await fetch(`${apiUrl}/api/rfi/evaluate-analyst`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          question,
                          response: evaluationResponse,
                          analyst: analyst || 'Gartner'
                        })
                      })

                      if (!response.ok) {
                        throw new Error(`Evaluation failed: ${response.statusText}`)
                      }

                      const data = await response.json()
                      setEvaluationResult(data)
                    } catch (err) {
                      console.error('Evaluation error:', err)
                      setError(err instanceof Error ? err.message : 'Failed to evaluate response')
                    } finally {
                      setLoading(false)
                      setLoadingStage('')
                    }
                  }}
                  disabled={loading || !question || !evaluationResponse}
                >
                  {loading ? 'Evaluating...' : 'Evaluate Response'}
                </Button>

                {loadingStage && (
                  <div className="progress-box">
                    <p>{loadingStage}</p>
                  </div>
                )}

                {error && (
                  <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error}
                    onCloseButtonClick={() => setError(null)}
                  />
                )}

                {evaluationResult?.evaluation && (
                  <div className="evaluation-results">
                    <h3>Evaluation Results</h3>
                    
                    <div className="score-summary">
                      <h4>{evaluationResult.evaluation.framework}</h4>
                      <div className="total-score">
                        <span className="score-value">{evaluationResult.evaluation.totalScore}</span>
                        <span className="score-max">/ {evaluationResult.evaluation.totalDimensions * 5}</span>
                      </div>
                    </div>

                    <div className="verdict">
                      <h4>Overall Verdict</h4>
                      <p>{evaluationResult.evaluation.verdict}</p>
                    </div>

                    <div className="dimensions">
                      <h4>Dimension Scores</h4>
                      {evaluationResult.evaluation.dimensions.map((dim: any, idx: number) => (
                        <div key={idx} className="dimension-card">
                          <div className="dimension-header">
                            <h5>{dim.name}</h5>
                            <span className="dimension-score">{dim.score}/5</span>
                          </div>
                          <p className="dimension-reasoning">{dim.reasoning}</p>
                          
                          {dim.evidence && dim.evidence.length > 0 && (
                            <div className="dimension-evidence">
                              <strong>Evidence:</strong>
                              <ul>
                                {dim.evidence.map((quote: string, qIdx: number) => (
                                  <li key={qIdx}>"{quote}"</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {dim.gaps && dim.gaps.length > 0 && (
                            <div className="dimension-gaps">
                              <strong>Gaps:</strong>
                              <ul>
                                {dim.gaps.map((gap: string, gIdx: number) => (
                                  <li key={gIdx}>{gap}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {evaluationResult.evaluation.gapAnalysis && evaluationResult.evaluation.gapAnalysis.length > 0 && (
                      <div className="gap-analysis">
                        <h4>Gap Analysis</h4>
                        <ul>
                          {evaluationResult.evaluation.gapAnalysis.map((gap: string, idx: number) => (
                            <li key={idx}>{gap}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluationResult.evaluation.rewriteSuggestions && evaluationResult.evaluation.rewriteSuggestions.length > 0 && (
                      <div className="rewrite-suggestions">
                        <h4>Rewrite Suggestions</h4>
                        <ul>
                          {evaluationResult.evaluation.rewriteSuggestions.map((suggestion: string, idx: number) => (
                            <li key={idx}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluationResult.evaluation.complianceNotes && (
                      <div className="compliance-notes">
                        <h4>Compliance Notes</h4>
                        <p>{evaluationResult.evaluation.complianceNotes}</p>
                      </div>
                    )}

                    <div className="evaluation-meta">
                      <small>Model: {evaluationResult.model} | Tokens: {evaluationResult.tokensUsed?.toLocaleString()}</small>
                    </div>
                  </div>
                )}
              </div>
            </TabPanel>

            {/* Presentation Outline Tab */}
            <TabPanel>
              <div className="panel-content">
                <h2>Create PowerPoint Presentation</h2>
                
                {/* Mode Selector */}
                <div className="presentation-mode-selector">
                  <Button
                    kind={presentationMode === 'blank' ? 'primary' : 'tertiary'}
                    onClick={() => setPresentationMode('blank')}
                  >
                    Blank Presentation
                  </Button>
                  <Button
                    kind={presentationMode === 'briefing' ? 'primary' : 'tertiary'}
                    onClick={() => setPresentationMode('briefing')}
                  >
                    Briefing Deck Builder
                  </Button>
                </div>

                {/* Blank Presentation Mode */}
                {presentationMode === 'blank' && (
                  <>
                    <div className="form-section">
                      <label htmlFor="pres-title">Presentation Title</label>
                      <TextInput
                        id="pres-title"
                        placeholder="e.g., IBM Cloud ERP Services Overview"
                        value={presentationTitle}
                        onChange={(e) => setPresentationTitle(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Briefing Deck Builder Mode */}
                {presentationMode === 'briefing' && (
                  <>
                    {!analyzedStructure && (
                      <div className="input-config">
                        <div className="project-docs-summary" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f4f4f4', borderRadius: '4px' }}>
                          <h4>📄 Project Documents (Auto-Detected)</h4>
                          <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5rem' }}>
                            {availableDocuments.some(d => d.metadata?.documentType === 'briefing_deck' || d.name.toLowerCase().includes('briefing')) ? (
                              <li style={{ color: '#24a148' }}>✅ Briefing Pack found</li>
                            ) : (
                              <li style={{ color: '#da1e28' }}>❌ No Briefing Pack detected (upload one with 'briefing' in name)</li>
                            )}
                            {availableDocuments.some(d => d.metadata?.documentType === 'welcome_pack' || d.name.toLowerCase().includes('welcome')) ? (
                              <li style={{ color: '#24a148' }}>✅ Welcome/Instructions found</li>
                            ) : (
                              <li style={{ color: '#da1e28' }}>❌ No Instructions detected (upload one with 'welcome' in name)</li>
                            )}
                          </ul>
                          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#666' }}>
                            Files are automatically pulled from the current project.
                          </p>
                        </div>
                        
                        <Button
                          kind="primary"
                          onClick={analyzeBriefingStructure}
                          disabled={generatingDeck}
                        >
                          {generatingDeck ? 'Analyzing...' : 'Analyze Structure'}
                        </Button>
                      </div>
                    )}

                    {/* Structure Review Section */}
                    {analyzedStructure && !deckStructure && (
                      <div className="structure-review" style={{ marginTop: '2rem' }}>
                        <h3>Review Presentation Structure</h3>
                        <p style={{ marginBottom: '1.5rem' }}>
                          Select action for each section. Uncheck "Generate Content" for sections where you lack source data.
                        </p>

                        <div className="sections-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {analyzedStructure.sections.map((section: any, idx: number) => (
                            <div key={idx} className="section-config-card" style={{ 
                              padding: '1rem', 
                              border: '1px solid #e0e0e0', 
                              borderRadius: '4px',
                              background: '#fff',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div className="section-info">
                                <h4 style={{ margin: 0, fontSize: '1rem' }}>{section.name}</h4>
                                <small style={{ color: '#666' }}>{section.duration} • {section.slideTopics?.length || 0} topics planned</small>
                              </div>
                              
                              <div className="section-actions">
                                <RadioButtonGroup
                                  name={`action-${idx}`}
                                  legendText="Action"
                                  defaultSelected={sectionConfig[section.name] || 'content'}
                                  onChange={(value) => {
                                    setSectionConfig(prev => ({
                                      ...prev,
                                      [section.name]: value as 'content' | 'break' | 'skip'
                                    }))
                                  }}
                                  orientation="horizontal"
                                >
                                  <RadioButton value="content" labelText="Generate Content" />
                                  <RadioButton value="break" labelText="Section Break Only" />
                                  <RadioButton value="skip" labelText="Skip" />
                                </RadioButtonGroup>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="generation-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                          <Button
                            kind="primary"
                            onClick={generateBriefingDeck}
                            disabled={generatingDeck}
                          >
                            {generatingDeck ? 'Generating Deck...' : 'Generate Deck Content'}
                          </Button>
                          <Button
                            kind="secondary"
                            onClick={() => setAnalyzedStructure(null)}
                            disabled={generatingDeck}
                          >
                            Back
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Status Bar */}
                    {(loadingStage || generatingDeck) && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        backgroundColor: generatingDeck ? '#e8f4f8' : '#e6ffed',
                        borderLeft: `4px solid ${generatingDeck ? '#0043ce' : '#24a148'}`,
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem'
                      }}>
                        {loadingStage ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {generatingDeck && (
                                <span style={{
                                  display: 'inline-block',
                                  width: '0.75rem',
                                  height: '0.75rem',
                                  backgroundColor: '#0043ce',
                                  borderRadius: '50%',
                                  animation: 'pulse 1.5s infinite'
                                }} />
                              )}
                              <span>{loadingStage}</span>
                            </div>
                          </>
                        ) : (
                          <span>Initializing...</span>
                        )}
                      </div>
                    )}

                    {/* Deck Structure Results */}
                    {deckStructure && (
                      <div className="deck-results">
                        <h3>Generated Deck Structure</h3>

                        {/* Extracted Structure */}
                        {deckStructure.extractedStructure && (
                          <div className="extracted-structure">
                            <h4>📋 Extracted Briefing Pack Structure</h4>
                            <div className="structure-details">
                              {deckStructure.extractedStructure.agendaTimings && (
                                <div>
                                  <strong>Agenda Timings:</strong>
                                  <ul>
                                    {deckStructure.extractedStructure.agendaTimings.map((item: any, idx: number) => (
                                      <li key={idx}>{item.time}: {item.topic}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {deckStructure.extractedStructure.constraints && (
                                <div>
                                  <strong>Constraints:</strong>
                                  <ul>
                                    {Object.entries(deckStructure.extractedStructure.constraints).map(([key, value]) => (
                                      <li key={key}>{key}: {String(value)}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )}


                        {/* Slides Preview */}
                        <div className="slides-preview">
                          <h4>📊 Slides ({deckStructure.slides?.length || 0})</h4>
                          {deckStructure.slides?.map((slide: any, idx: number) => (
                            <div key={idx} className="slide-card">
                              <div className="slide-header">
                                <strong>Slide {slide.number}: {slide.title}</strong>
                                {slide.complianceFlags && slide.complianceFlags.length > 0 && (
                                  <span className="compliance-warning">⚠️ {slide.complianceFlags.length} compliance flags</span>
                                )}
                              </div>
                              <p className="slide-purpose"><em>{slide.purpose}</em></p>
                              {slide.content && slide.content.length > 0 && (
                                <ul className="slide-content">
                                  {slide.content.map((bullet: string, bidx: number) => (
                                    <li key={bidx}>{bullet}</li>
                                  ))}
                                </ul>
                              )}
                              {slide.evidenceCitations && slide.evidenceCitations.length > 0 && (
                                <div className="evidence-citations">
                                  <strong>Evidence:</strong> {slide.evidenceCitations.join('; ')}
                                </div>
                              )}
                              {slide.complianceFlags && slide.complianceFlags.length > 0 && (
                                <div className="compliance-flags">
                                  <strong>⚠️ Compliance Issues:</strong>
                                  <ul>
                                    {slide.complianceFlags.map((flag: string, fidx: number) => (
                                      <li key={fidx}>{flag}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {slide.speakerNotes && (
                                <details className="speaker-notes">
                                  <summary>Speaker Notes</summary>
                                  <p>{slide.speakerNotes}</p>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Traceability Matrix */}
                        {deckStructure.traceabilityMatrix && deckStructure.traceabilityMatrix.length > 0 && (
                          <div className="traceability-matrix">
                            <h4>🔗 Traceability Matrix</h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>Slide</th>
                                  <th>Pack Requirement</th>
                                  <th>Response Source</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {deckStructure.traceabilityMatrix.map((item: any, idx: number) => (
                                  <tr key={idx}>
                                    <td>{item.slideNumber}</td>
                                    <td>{item.packRequirement}</td>
                                    <td>{item.responseSource}</td>
                                    <td className={`status-${item.status}`}>{item.status}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Gap List */}
                        {deckStructure.gapList && deckStructure.gapList.length > 0 && (
                          <div className="gap-list">
                            <h4>⚠️ Identified Gaps ({deckStructure.gapList.length})</h4>
                            <ul>
                              {deckStructure.gapList.map((gap: any, idx: number) => (
                                <li key={idx}>
                                  <strong>{gap.requirement}</strong>: {gap.description}
                                  {gap.mitigation && <div className="mitigation">Mitigation: {gap.mitigation}</div>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Q&A Bank */}
                        {deckStructure.qaBank && deckStructure.qaBank.length > 0 && (
                          <div className="qa-bank">
                            <h4>💬 Q&A Bank ({deckStructure.qaBank.length})</h4>
                            {deckStructure.qaBank.map((qa: any, idx: number) => (
                              <details key={idx} className="qa-item">
                                <summary><strong>Q{idx + 1}:</strong> {qa.question}</summary>
                                <p><strong>A:</strong> {qa.answer}</p>
                                {qa.evidenceSource && <p className="evidence-source"><em>Source: {qa.evidenceSource}</em></p>}
                              </details>
                            ))}
                          </div>
                        )}

                        {/* Download Button */}
                        <Button
                          kind="primary"
                          onClick={downloadPresentation}
                          disabled={loading}
                          style={{ marginTop: '1.5rem' }}
                        >
                          {loading ? 'Creating PowerPoint...' : 'Download PowerPoint'}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {loadingStage && (
                  <div className="progress-box">
                    <p>{loadingStage}</p>
                  </div>
                )}

                {error && (
                  <InlineNotification
                    kind="error"
                    title="Error"
                    subtitle={error}
                    onCloseButtonClick={() => setError(null)}
                  />
                )}
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  )
}
