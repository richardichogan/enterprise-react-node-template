import React, { useState, useEffect } from 'react'
import './App.scss'
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
  InlineNotification
} from '@carbon/react'
import { Download, Upload, Trash } from '@carbon/icons-react'

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
}

interface RFIResponse {
  answer: string
  usedDocumentCollection: boolean
  collectionName?: string
  model?: string
  tokensUsed?: number
}

const ANALYSTS = ['Gartner', 'Forrester', 'IDC', 'Magic Quadrant', 'Custom']
const ANSWER_TYPES = ['Single', 'Categorised']

export default function App() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
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

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [projectDocuments, setProjectDocuments] = useState<UploadedDocument[]>([])

  // Load projects from localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('rfi_projects')
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects)
        setProjects(parsed)
        if (parsed.length > 0) {
          setCurrentProjectId(parsed[0].id)
        }
      } catch (e) {
        console.error('Failed to load projects:', e)
      }
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

  // Save projects to localStorage
  const saveProjects = (projectsToSave: Project[]) => {
    localStorage.setItem('rfi_projects', JSON.stringify(projectsToSave))
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
    setProjects(updated)
    saveProjects(updated)
    setCurrentProjectId(newProject.id)
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
    setProjects(updated)
    saveProjects(updated)
  }

  // Save project setup
  const saveProjectSetup = () => {
    updateCurrentProject({
      analyst,
      category,
      technologyFocus,
      partner
    })
    setError(null)
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

    try {
      const formData = new FormData()
      formData.append('document', file)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(Math.round(percentComplete))
          if (percentComplete >= 100) {
            setUploadStatus('Processing... Uploading to Azure Blob Storage')
          }
        }
      })

      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText)
              const doc: UploadedDocument = {
                name: response.document.blobName,
                size: response.document.size,
                uploadDate: response.document.uploadDate,
                url: response.document.url
              }
              setProjectDocuments(prev => [...prev, doc])
              updateCurrentProject({
                documents: [...projectDocuments, doc]
              })
              setUploadStatus('Upload complete!')
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
        setUploadStatus('')
      }, 2000)
    }
  }

  // Delete document from project
  const deleteDocument = (docName: string) => {
    const updated = projectDocuments.filter(d => d.name !== docName)
    setProjectDocuments(updated)
    updateCurrentProject({ documents: updated })
  }

  // Generate RFI response
  const generateResponse = async () => {
    if (!question.trim()) {
      setError('Question is required')
      return
    }

    setLoading(true)
    setError(null)
    try {
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
          documentCount: projectDocuments.length
        })
      })
      if (!response.ok) throw new Error(`API error: ${response.statusText}`)
      const data = await response.json()
      setGeneratedResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
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
                              setProjects(updated)
                              saveProjects(updated)
                              if (p.id === currentProjectId && updated.length > 0) {
                                setCurrentProjectId(updated[0].id)
                              }
                            }}
                          >
                            <Trash size={16} />
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
                  <>
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

                    <Button onClick={saveProjectSetup} style={{ marginBottom: '2rem' }}>
                      Save Project Setup
                    </Button>

                    <h3>Project Documents</h3>
                    <div className="upload-section">
                      <input
                        type="file"
                        accept=".pdf,.docx,.pptx"
                        onChange={uploadDocument}
                        disabled={uploading}
                        style={{ marginTop: '0.5rem' }}
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

                    {projectDocuments.length === 0 ? (
                      <div className="empty-state" style={{ marginTop: '1rem' }}>
                        <p>No documents uploaded for this project</p>
                      </div>
                    ) : (
                      <div className="documents-list" style={{ marginTop: '1.5rem' }}>
                        {projectDocuments.map(doc => (
                          <div key={doc.name} className="document-item">
                            <div className="doc-info">
                              <strong>{doc.name}</strong>
                              <small>{(doc.size / (1024 * 1024)).toFixed(2)} MB | {new Date(doc.uploadDate).toLocaleDateString()}</small>
                            </div>
                            <Button
                              kind="danger--ghost"
                              size="sm"
                              onClick={() => deleteDocument(doc.name)}
                            >
                              <Trash size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
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

                    {generatedResponse && (
                      <div className="result-box">
                        <h3>Generated Response</h3>
                        <p>{generatedResponse.answer}</p>
                        {generatedResponse.model && (
                          <div className="metadata">
                            <small>Model: {generatedResponse.model} | Tokens: {generatedResponse.tokensUsed}</small>
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
                <p>Coming soon...</p>
              </div>
            </TabPanel>

            {/* Presentation Outline Tab */}
            <TabPanel>
              <div className="panel-content">
                <h2>Create Presentation Outline</h2>
                <p>Coming soon...</p>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  )
}
