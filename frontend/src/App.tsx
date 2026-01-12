import React, { useState, useEffect } from 'react'
import './App.scss'
import { 
  Tabs, 
  TabList, 
  Tab, 
  TabPanels, 
  TabPanel,
  TextArea,
  Button,
  InlineNotification
} from '@carbon/react'

interface RFIResponse {
  answer: string
  usedDocumentCollection: boolean
  collectionName?: string
  model?: string
  tokensUsed?: number
}

interface ScoreAnalysis {
  analysis: string
  model?: string
  tokensUsed?: number
}

interface OutlineResult {
  outline: string
  model?: string
  tokensUsed?: number
}

interface UploadedDocument {
  name: string
  size: number
  uploadDate: string
  url: string
}

export default function App() {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Generator state
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [generatedResponse, setGeneratedResponse] = useState<RFIResponse | null>(null)
  
  // Scorer state
  const [answerToScore, setAnswerToScore] = useState('')
  const [scoreAnalysis, setScoreAnalysis] = useState<ScoreAnalysis | null>(null)
  
  // Outline state
  const [topic, setTopic] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [audience, setAudience] = useState('')
  const [outline, setOutline] = useState<OutlineResult | null>(null)
  
  // Documents state
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/documents`)
      if (!response.ok) throw new Error('Failed to load documents')
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (err) {
      console.error('Error loading documents:', err)
    }
  }

  const generateResponse = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/rfi/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, useDocumentCollection: true }),
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

  const analyzeScore = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/rfi/analyze-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: answerToScore }),
      })
      if (!response.ok) throw new Error(`API error: ${response.statusText}`)
      const data = await response.json()
      setScoreAnalysis(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateOutline = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/rfi/generate-outline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, keyPoints, audience }),
      })
      if (!response.ok) throw new Error(`API error: ${response.statusText}`)
      const data = await response.json()
      setOutline(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

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
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100
          setUploadProgress(Math.round(percentComplete))
          if (percentComplete >= 100) {
            setUploadStatus('Processing... Uploading to Azure Blob Storage')
          }
        }
      })

      // Handle completion
      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadStatus('Upload complete!')
            resolve()
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

      await loadDocuments()
      
      // Reset file input
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

  const deleteDocument = async (fileName: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/api/documents/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(`Delete failed: ${response.statusText}`)
      await loadDocuments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <h1>RFI-Helper</h1>
          <p>AI-Powered RFI Response Assistant</p>
        </div>
        <div className="app-status">
          <span className="api-status">API: {apiUrl}</span>
        </div>
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
            <Tab>Answer Generator</Tab>
            <Tab>Score Analyzer</Tab>
            <Tab>Presentation Outline</Tab>
            <Tab>Document Manager</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <div className="panel-content">
                <h2>Generate RFI Response</h2>
                <TextArea
                  labelText="RFI Question"
                  placeholder="Enter the RFI question..."
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <TextArea
                  labelText="Additional Context"
                  placeholder="Provide context or requirements..."
                  rows={6}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  style={{ marginTop: '1rem' }}
                />
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
              </div>
            </TabPanel>

            <TabPanel>
              <div className="panel-content">
                <h2>Analyze Response Quality</h2>
                <TextArea
                  labelText="Answer to Analyze"
                  placeholder="Paste the answer to score..."
                  rows={8}
                  value={answerToScore}
                  onChange={(e) => setAnswerToScore(e.target.value)}
                />
                <Button 
                  onClick={analyzeScore} 
                  disabled={loading || !answerToScore}
                  style={{ marginTop: '1rem' }}
                >
                  {loading ? 'Analyzing...' : 'Analyze Score'}
                </Button>

                {scoreAnalysis && (
                  <div className="result-box">
                    <h3>Analysis Results</h3>
                    <p>{scoreAnalysis.analysis}</p>
                    {scoreAnalysis.model && (
                      <div className="metadata">
                        <small>Model: {scoreAnalysis.model} | Tokens: {scoreAnalysis.tokensUsed}</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel>
              <div className="panel-content">
                <h2>Create Presentation Outline</h2>
                <TextArea
                  labelText="Presentation Topic"
                  placeholder="Enter the main topic..."
                  rows={2}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <TextArea
                  labelText="Key Points"
                  placeholder="Enter key points (one per line)..."
                  rows={4}
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                  style={{ marginTop: '1rem' }}
                />
                <TextArea
                  labelText="Target Audience"
                  placeholder="Describe the audience..."
                  rows={2}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  style={{ marginTop: '1rem' }}
                />
                <Button 
                  onClick={generateOutline} 
                  disabled={loading || !topic}
                  style={{ marginTop: '1rem' }}
                >
                  {loading ? 'Generating...' : 'Generate Outline'}
                </Button>

                {outline && (
                  <div className="result-box">
                    <h3>Presentation Outline</h3>
                    <pre>{outline.outline}</pre>
                    {outline.model && (
                      <div className="metadata">
                        <small>Model: {outline.model} | Tokens: {outline.tokensUsed}</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel>
              <div className="panel-content">
                <h2>Manage Documents</h2>
                
                <div className="upload-section">
                  <h3>Upload Briefing Document</h3>
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
                        <div 
                          className="progress-fill" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <small>{uploadStatus} {uploadProgress < 100 ? `${uploadProgress}%` : ''}</small>
                    </div>
                  )}
                </div>

                <div className="documents-section">
                  <h3>Uploaded Documents</h3>
                  {documents.length === 0 ? (
                    <div className="empty-state">
                      <p>No documents uploaded yet</p>
                    </div>
                  ) : (
                    <div className="documents-list">
                      {documents.map((doc) => (
                        <div key={doc.name} className="document-item">
                          <div className="doc-info">
                            <strong>{doc.name}</strong>
                            <small>{(doc.size / (1024 * 1024)).toFixed(2)} MB | {new Date(doc.uploadDate).toLocaleDateString()}</small>
                          </div>
                          <Button 
                            kind="danger--ghost" 
                            size="sm"
                            onClick={() => deleteDocument(doc.name)}
                            disabled={loading}
                          >
                            Delete
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </div>
    </div>
  )
}
