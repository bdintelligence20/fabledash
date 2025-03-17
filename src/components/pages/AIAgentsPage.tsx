import { useState, useEffect } from 'react';
import { 
  Bot, 
  X, 
  Plus,
  Upload,
  MessageSquare,
  FileText,
  Trash2
} from 'lucide-react';

// Define types
interface Agent {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

interface Document {
  id: number;
  agent_id: number;
  file_name: string;
  created_at: string;
}

interface Chat {
  id: number;
  agent_id: number;
  created_at: string;
}

interface Message {
  id: number;
  role: string;
  content: string;
  created_at: string;
}

// AI Agents Page Component
function AIAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  
  // Initialize selectedAgent from localStorage or default to null
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(() => {
    const savedAgent = localStorage.getItem('selectedAgent');
    return savedAgent ? JSON.parse(savedAgent) : null;
  });
  
  // Initialize showCreateForm from localStorage or default to false
  const [showCreateForm, setShowCreateForm] = useState(() => {
    const savedShowCreateForm = localStorage.getItem('showCreateForm');
    return savedShowCreateForm === 'true';
  });
  
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  
  // Initialize currentChatId from localStorage or default to null
  const [currentChatId, setCurrentChatId] = useState<number | null>(() => {
    const savedChatId = localStorage.getItem('currentChatId');
    return savedChatId ? parseInt(savedChatId) : null;
  });
  
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [backendAvailable, setBackendAvailable] = useState(true);
  
  // Save selectedAgent to localStorage whenever it changes
  useEffect(() => {
    if (selectedAgent) {
      localStorage.setItem('selectedAgent', JSON.stringify(selectedAgent));
    } else {
      localStorage.removeItem('selectedAgent');
    }
  }, [selectedAgent]);
  
  // Save showCreateForm to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('showCreateForm', showCreateForm.toString());
  }, [showCreateForm]);
  
  // Save currentChatId to localStorage whenever it changes
  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem('currentChatId', currentChatId.toString());
    } else {
      localStorage.removeItem('currentChatId');
    }
  }, [currentChatId]);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Check if backend is available
  useEffect(() => {
    const checkBackendAvailability = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        await fetch(`${apiUrl}/agents/list`, { signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendAvailable(true);
      } catch (error) {
        console.error("Backend connection error:", error);
        setBackendAvailable(false);
      }
    };
    
    checkBackendAvailability();
    const interval = setInterval(checkBackendAvailability, 30000);
    
    return () => clearInterval(interval);
  }, [apiUrl]);
  
  // Fetch agents on component mount
  useEffect(() => {
    if (backendAvailable) {
      fetchAgents();
    }
  }, [backendAvailable]);
  
  // Fetch agents from API
  const fetchAgents = async () => {
    try {
      const response = await fetch(`${apiUrl}/agents/list`);
      const data = await response.json();
      
      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
    }
  };
  
  // Fetch documents for a specific agent
  const fetchDocuments = async (agentId: number) => {
    try {
      const response = await fetch(`${apiUrl}/documents/list?agent_id=${agentId}`);
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  };
  
  // Create a new agent
  const createAgent = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${apiUrl}/agents/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newAgentName,
          description: newAgentDescription,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAgents([...agents, data.agent]);
        setNewAgentName('');
        setNewAgentDescription('');
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error("Error creating agent:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a document
  const deleteDocument = async (documentId: number) => {
    if (!selectedAgent) return;
    
    try {
      setIsLoading(true);
      
      const response = await fetch(`${apiUrl}/documents/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_id: documentId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh documents list
        fetchDocuments(selectedAgent.id);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Upload document to an agent
  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>, agentId: number) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check file size (1GB limit)
    if (file.size > 1024 * 1024 * 1024) {
      setUploadError("File size exceeds 1GB limit");
      setFileInputKey(Date.now()); // Reset file input
      return;
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
      setUploadError("Unsupported file type. Please upload PDF, TXT, CSV, or DOCX files.");
      setFileInputKey(Date.now()); // Reset file input
      return;
    }
    
    try {
      setIsLoading(true);
      setUploadError(null);
      
      // For larger files, we'll use a different approach with timeout handling
      if (file.size > 5 * 1024 * 1024) {
        // Create a blob slice function
        const sliceFile = (file: File, start: number, end: number): Promise<string> => {
          return new Promise((resolve, reject) => {
            const slice = file.slice(start, end);
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(slice);
          });
        };
        
        // Process in chunks of 2MB for better reliability
        const chunkSize = 2 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / chunkSize);
        
        // Read the first chunk to get the file type and start processing
        const firstChunk = await sliceFile(file, 0, Math.min(chunkSize, file.size));
        
        try {
          // Set a longer timeout for large files
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
          
          // Send to API with timeout handling
          const response = await fetch(`${apiUrl}/documents/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agent_id: agentId,
              file_data: firstChunk,
              file_name: file.name,
              content_type: file.type,
              total_size: file.size,
              is_large_file: true
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          
          const data = await response.json();
          
          if (data.success) {
            // Refresh documents list
            fetchDocuments(agentId);
          } else {
            setUploadError(data.message || "Failed to upload document");
            console.error("Error uploading document:", data.message);
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            setUploadError("Upload timed out. The file may be too large or the server is busy.");
          } else {
            setUploadError(`Network error: ${error.message}`);
          }
          console.error("Error uploading document:", error);
        }
      } else {
        // For smaller files, use the original approach
        const reader = new FileReader();
        
        reader.onload = async (e) => {
          try {
            const base64Data = e.target?.result as string;
            
            // Send to API
            const response = await fetch(`${apiUrl}/documents/upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                agent_id: agentId,
                file_data: base64Data,
                file_name: file.name,
                content_type: file.type
              }),
            });
            
            const data = await response.json();
            
            if (data.success) {
              // Refresh documents list
              fetchDocuments(agentId);
            } else {
              setUploadError(data.message || "Failed to upload document");
              console.error("Error uploading document:", data.message);
            }
          } catch (error: any) {
            if (error.toString().includes("too large")) {
              setUploadError("File is too large for upload. Please try a smaller file or compress this one.");
            } else {
              setUploadError("Error processing file: " + error.toString());
              console.error("Error processing file:", error);
            }
          } finally {
            setIsLoading(false);
            // Reset the file input
            setFileInputKey(Date.now());
          }
        };
        
        reader.onerror = () => {
          setUploadError("Error reading file");
          setIsLoading(false);
          setFileInputKey(Date.now());
        };
        
        // Start reading the file
        reader.readAsDataURL(file);
      }
    } catch (error: any) {
      if (error.toString().includes("too large")) {
        setUploadError("File is too large for upload. Please try a smaller file or compress this one.");
      } else {
        setUploadError("Network error while uploading document: " + error.toString());
        console.error("Error uploading document:", error);
      }
      setIsLoading(false);
      setFileInputKey(Date.now());
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a new chat
  const createChat = async (agentId: number) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${apiUrl}/chats/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentChatId(data.chat.id);
        setChatMessages([]);
      }
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send a message in a chat
  const sendMessage = async () => {
    if (!currentChatId || !messageInput.trim()) return;
    
    try {
      setIsLoading(true);
      
      // Add user message to UI immediately
      const userMessage: Message = {
        id: Date.now(), // Temporary ID
        role: 'user',
        content: messageInput,
        created_at: new Date().toISOString(),
      };
      
      setChatMessages([...chatMessages, userMessage]);
      setMessageInput('');
      
      const response = await fetch(`${apiUrl}/chats/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: currentChatId,
          message: userMessage.content,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChatMessages(data.messages);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Select an agent and fetch its documents
  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    fetchDocuments(agent.id);
    setCurrentChatId(null);
    setChatMessages([]);
  };
  
  // Handle agent creation form submission
  const handleCreateAgentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAgent();
  };
  
  // Handle message input submission
  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };
  
  // If backend is not available, show connection error
  if (!backendAvailable) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <Bot className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-red-700 mb-2">Backend Connection Error</h2>
          <p className="text-red-600 mb-6">
            Unable to connect to the AI backend service. Please make sure the backend server is running.
          </p>
          <button
            onClick={() => setBackendAvailable(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      {!selectedAgent && !showCreateForm ? (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold">AI Agents</h1>
            <button 
              onClick={() => setShowCreateForm(true)}
              className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center"
              disabled={isLoading}
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Agent
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div 
                key={agent.id}
                className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleSelectAgent(agent)}
              >
                <div className="flex items-center mb-4">
                  <div className="bg-purple-100 p-3 rounded-full mr-4">
                    <Bot className="h-6 w-6 text-purple-500" />
                  </div>
                  <h2 className="text-lg font-medium">{agent.name}</h2>
                </div>
                <p className="text-gray-600 mb-4 line-clamp-2">{agent.description || "No description provided."}</p>
                <p className="text-sm text-gray-500">Created: {new Date(agent.created_at).toLocaleDateString()}</p>
              </div>
            ))}
            
            {agents.length === 0 && (
              <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
                <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No AI Agents Yet</h3>
                <p className="text-gray-500 mb-6">Create your first AI agent to get started</p>
                <button 
                  onClick={() => setShowCreateForm(true)}
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg inline-flex items-center"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Agent
                </button>
              </div>
            )}
          </div>
        </>
      ) : showCreateForm ? (
        <div>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-semibold">Create New AI Agent</h1>
          </div>
          <div className="max-w-3xl">
            <p className="text-gray-600 mb-8">Configure your custom AI agent with the settings below</p>
            
            <form onSubmit={handleCreateAgentSubmit} className="bg-white rounded-lg shadow p-6">
              <div className="mb-6">
                <label htmlFor="agentName" className="block text-sm font-medium text-gray-700 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  id="agentName"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="e.g., Document Assistant"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="agentDescription" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="agentDescription"
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe what this agent will do..."
                  rows={4}
                  disabled={isLoading}
                />
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center"
                  disabled={isLoading || !newAgentName.trim()}
                >
                  {isLoading ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : selectedAgent && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button
                onClick={() => setSelectedAgent(null)}
                className="mr-4 text-gray-500 hover:text-gray-700"
                aria-label="Go back"
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold">{selectedAgent.name}</h1>
            </div>
            
            <div className="flex space-x-2">
              <label className={`${isLoading ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-500 hover:bg-purple-600 cursor-pointer'} text-white px-4 py-2 rounded-lg flex items-center`}>
                <Upload className="h-5 w-5 mr-2" />
                Upload Document
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => uploadDocument(e, selectedAgent.id)}
                  accept=".pdf,.txt,.csv,.doc,.docx"
                  disabled={isLoading}
                  key={fileInputKey}
                />
              </label>
              
              <button
                onClick={() => createChat(selectedAgent.id)}
                className={`${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-lg flex items-center`}
                disabled={isLoading}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                New Chat
              </button>
            </div>
          </div>
          
          {uploadError && (
            <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{uploadError}</span>
              <button 
                className="absolute top-0 bottom-0 right-0 px-4 py-3"
                onClick={() => setUploadError(null)}
                aria-label="Close error message"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-medium mb-4">Agent Details</h2>
                <p className="text-gray-600 mb-4">{selectedAgent.description || "No description provided."}</p>
                <p className="text-sm text-gray-500">Created: {new Date(selectedAgent.created_at).toLocaleDateString()}</p>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium mb-4">Documents</h2>
                
                {documents.length > 0 ? (
                  <div className="space-y-4">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-500 mr-3" />
                          <span className="text-gray-800">{doc.file_name}</span>
                        </div>
                        <button 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => deleteDocument(doc.id)}
                          disabled={isLoading}
                          aria-label={`Delete ${doc.file_name}`}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No documents uploaded yet</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="lg:col-span-2">
              {currentChatId ? (
                <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-medium">Chat with {selectedAgent.name}</h2>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {chatMessages.length > 0 ? (
                      chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <div
                            className={`max-w-3/4 rounded-lg p-4 ${
                              message.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                          <p className="text-gray-500">Start a conversation with your AI agent</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 border-t">
                    <form onSubmit={handleMessageSubmit} className="flex space-x-2">
                      <input
                        type="text"
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Type your message..."
                        disabled={isLoading}
                      />
                      <button
                        type="submit"
                        className={`${isLoading || !messageInput.trim() ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white px-4 py-2 rounded-lg`}
                        disabled={isLoading || !messageInput.trim()}
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center h-[600px]">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-gray-700 mb-2">No Active Chat</h3>
                    <p className="text-gray-500 mb-6">Start a new chat to interact with this agent</p>
                    <button
                      onClick={() => createChat(selectedAgent.id)}
                      className={`${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} text-white px-6 py-3 rounded-lg flex items-center mx-auto`}
                      disabled={isLoading}
                    >
                      <MessageSquare className="h-5 w-5 mr-2" />
                      Start New Chat
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIAgentsPage;
