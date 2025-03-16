import { useState, useEffect } from 'react';
import { 
  Home, 
  CheckSquare, 
  DollarSign, 
  Bot, 
  Menu, 
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

// Dashboard Page Component
function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2">Tasks</h2>
          <p className="text-gray-600 mb-4">You have 5 tasks due today</p>
          <div className="h-2 bg-blue-100 rounded-full">
            <div className="h-2 bg-blue-500 rounded-full w-2/3"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2">Finances</h2>
          <p className="text-gray-600 mb-4">Monthly budget: $3,450</p>
          <div className="h-2 bg-green-100 rounded-full">
            <div className="h-2 bg-green-500 rounded-full w-1/2"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-medium mb-2">AI Agents</h2>
          <p className="text-gray-600 mb-4">3 active agents</p>
          <div className="h-2 bg-purple-100 rounded-full">
            <div className="h-2 bg-purple-500 rounded-full w-3/4"></div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-start">
            <div className="bg-blue-100 p-2 rounded-full mr-4">
              <CheckSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-medium">Task Completed</p>
              <p className="text-sm text-gray-600">Website redesign project</p>
              <p className="text-xs text-gray-500 mt-1">2 hours ago</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-green-100 p-2 rounded-full mr-4">
              <DollarSign className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Invoice Paid</p>
              <p className="text-sm text-gray-600">Client XYZ Corp</p>
              <p className="text-xs text-gray-500 mt-1">Yesterday</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-purple-100 p-2 rounded-full mr-4">
              <Bot className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="font-medium">New AI Agent Created</p>
              <p className="text-sm text-gray-600">Document Assistant</p>
              <p className="text-xs text-gray-500 mt-1">2 days ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tasks Page Component
function TasksPage() {
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Add Task
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center">
            <input type="checkbox" className="h-5 w-5 mr-3" />
            <div>
              <h3 className="font-medium">Complete project proposal</h3>
              <p className="text-sm text-gray-600">Due today</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center">
            <input type="checkbox" className="h-5 w-5 mr-3" defaultChecked />
            <div>
              <h3 className="font-medium line-through text-gray-500">Research competitors</h3>
              <p className="text-sm text-gray-500">Completed yesterday</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-b">
          <div className="flex items-center">
            <input type="checkbox" className="h-5 w-5 mr-3" />
            <div>
              <h3 className="font-medium">Client meeting preparation</h3>
              <p className="text-sm text-gray-600">Due tomorrow</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-b">
          <div className="flex items-center">
            <input type="checkbox" className="h-5 w-5 mr-3" />
            <div>
              <h3 className="font-medium">Update website content</h3>
              <p className="text-sm text-gray-600">Due in 3 days</p>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          <div className="flex items-center">
            <input type="checkbox" className="h-5 w-5 mr-3" />
            <div>
              <h3 className="font-medium">Quarterly report</h3>
              <p className="text-sm text-gray-600">Due next week</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Finances Page Component
function FinancesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Finances</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-600 uppercase mb-2">Total Income</h2>
          <p className="text-3xl font-bold text-green-500">$12,450</p>
          <p className="text-sm text-gray-600 mt-2">+8% from last month</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-600 uppercase mb-2">Total Expenses</h2>
          <p className="text-3xl font-bold text-red-500">$8,320</p>
          <p className="text-sm text-gray-600 mt-2">-3% from last month</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm text-gray-600 uppercase mb-2">Net Profit</h2>
          <p className="text-3xl font-bold text-blue-500">$4,130</p>
          <p className="text-sm text-gray-600 mt-2">+15% from last month</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="p-6 border-b">
          <h2 className="text-lg font-medium">Recent Transactions</h2>
        </div>
        <div className="divide-y">
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Client Payment - XYZ Corp</p>
              <p className="text-sm text-gray-600">Invoice #1234</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-green-500">+$3,500</p>
              <p className="text-xs text-gray-500">May 12, 2025</p>
            </div>
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Office Supplies</p>
              <p className="text-sm text-gray-600">Staples Inc.</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-red-500">-$250</p>
              <p className="text-xs text-gray-500">May 10, 2025</p>
            </div>
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Software Subscription</p>
              <p className="text-sm text-gray-600">Adobe Creative Cloud</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-red-500">-$52.99</p>
              <p className="text-xs text-gray-500">May 8, 2025</p>
            </div>
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">Client Payment - ABC Inc.</p>
              <p className="text-sm text-gray-600">Invoice #1233</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-green-500">+$2,750</p>
              <p className="text-xs text-gray-500">May 5, 2025</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// AI Agents Page Component
function AIAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const [backendAvailable, setBackendAvailable] = useState(true);
  
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
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size exceeds 10MB limit");
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
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agent_id', agentId.toString());
      
      const response = await fetch(`${apiUrl}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh documents list
        fetchDocuments(agentId);
      } else {
        setUploadError(data.message || "Failed to upload document");
        console.error("Error uploading document:", data.message);
      }
    } catch (error) {
      setUploadError("Network error while uploading document");
      console.error("Error uploading document:", error);
    } finally {
      setIsLoading(false);
      // Reset the file input
      setFileInputKey(Date.now());
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

// Main App Component
function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };
  
  // Render the current page based on state
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'tasks':
        return <TasksPage />;
      case 'finances':
        return <FinancesPage />;
      case 'agents':
        return <AIAgentsPage />;
      default:
        return <DashboardPage />;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:flex-col md:w-64 bg-white shadow">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold text-purple-600">WorkflowAI</h1>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'dashboard'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home className="h-5 w-5 mr-3" />
                Dashboard
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('tasks')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'tasks'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <CheckSquare className="h-5 w-5 mr-3" />
                Tasks
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('finances')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'finances'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <DollarSign className="h-5 w-5 mr-3" />
                Finances
              </button>
            </li>
            
            <li>
              <button
                onClick={() => setCurrentPage('agents')}
                className={`w-full flex items-center px-4 py-3 rounded-lg ${
                  currentPage === 'agents'
                    ? 'bg-purple-100 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Bot className="h-5 w-5 mr-3" />
                AI Agents
              </button>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-600 font-semibold mr-3">
              JD
            </div>
            <div>
              <p className="font-medium">John Doe</p>
              <p className="text-xs text-gray-500">john@example.com</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu Button and Header */}
      <div className="flex flex-col flex-1">
        <header className="bg-white shadow md:hidden">
          <div className="flex justify-between items-center p-4">
            <h1 className="text-xl font-bold text-purple-600">WorkflowAI</h1>
            <button onClick={toggleMobileMenu} className="text-gray-600">
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
          
          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <nav className="p-4 border-t">
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('dashboard');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'dashboard'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Home className="h-5 w-5 mr-3" />
                    Dashboard
                  </button>
                </li>
                
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('tasks');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'tasks'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <CheckSquare className="h-5 w-5 mr-3" />
                    Tasks
                  </button>
                </li>
                
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('finances');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'finances'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <DollarSign className="h-5 w-5 mr-3" />
                    Finances
                  </button>
                </li>
                
                <li>
                  <button
                    onClick={() => {
                      setCurrentPage('agents');
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg ${
                      currentPage === 'agents'
                        ? 'bg-purple-100 text-purple-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Bot className="h-5 w-5 mr-3" />
                    AI Agents
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </header>
        
        {/* Main Content */}
        <main className="flex-1">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
