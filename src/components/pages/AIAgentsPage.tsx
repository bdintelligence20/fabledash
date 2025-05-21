import { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { Agent, Message, Document, Chat } from '../agents/AgentTypes';
import { Client } from '../clients/ClientTypes';
import AgentList from '../agents/AgentList';
import AgentForm from '../agents/AgentForm';
import AgentDetails from '../agents/AgentDetails';
import AgentChat from '../agents/AgentChat';
import ChatHistory from '../agents/ChatHistory';
import { Card, Modal } from '../ui';

const AIAgentsPage = () => {
  // State for agents and related data
  const [agents, setAgents] = useState<Agent[]>([]);
  const [childAgents, setChildAgents] = useState<Agent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  // UI state
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showChildAgentForm, setShowChildAgentForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  
  // Chat state
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [agentChats, setAgentChats] = useState<Chat[]>([]);
  const [childAgentChats, setChildAgentChats] = useState<Chat[]>([]);
  const [parentAgentChats, setParentAgentChats] = useState<Chat[]>([]);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Fetch agents and clients on component mount
  useEffect(() => {
    fetchAgents();
    fetchClients();
  }, []);
  
  // Fetch agents from API
  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching all agents');
      // Fetch all agents
      const response = await fetch(`${apiUrl}/agents`);
      console.log('All agents response:', response);
      
      const data = await response.json();
      console.log('All agents data:', data);
      
      if (data.success) {
        // Filter to only parent agents for the main list
        const parentAgents = data.agents.filter((agent: Agent) => agent.is_parent);
        console.log('Filtered parent agents:', parentAgents);
        setAgents(parentAgents);
      } else {
        setError(data.message || 'Failed to fetch agents');
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
      setError('Network error while fetching agents');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch clients from API
  const fetchClients = async () => {
    try {
      const response = await fetch(`${apiUrl}/clients`);
      const data = await response.json();
      
      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };
  
  // Fetch child agents for a parent agent
  const fetchChildAgents = async (parentId: number) => {
    try {
      setIsLoading(true);
      
      console.log(`Fetching child agents for parent ID: ${parentId}`);
      const response = await fetch(`${apiUrl}/agents/parent/${parentId}/children`);
      console.log('Child agents response:', response);
      
      const data = await response.json();
      console.log('Child agents data:', data);
      
      if (data.success) {
        setChildAgents(data.agents);
      } else {
        console.error('Failed to fetch child agents:', data.message);
        setError(data.message || 'Failed to fetch child agents');
      }
    } catch (error) {
      console.error("Error fetching child agents:", error);
      setError('Network error while fetching child agents');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch documents for a specific agent
  const fetchDocuments = async (agentId: number) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${apiUrl}/documents?agent_id=${agentId}`);
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.documents);
      } else {
        setError(data.message || 'Failed to fetch documents');
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      setError('Network error while fetching documents');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a new agent
  const createAgent = async (agentData: any) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (agentData.parent_id) {
          // If it's a child agent, refresh child agents
          fetchChildAgents(agentData.parent_id);
        } else {
          // If it's a parent agent, refresh all agents
          fetchAgents();
        }
        
        setShowCreateForm(false);
        setShowChildAgentForm(false);
      } else {
        setError(data.message || 'Failed to create agent');
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      setError('Network error while creating agent');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a document
  const deleteDocument = async (documentId: number) => {
    if (!selectedAgent) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh documents list
        fetchDocuments(selectedAgent.id);
      } else {
        setError(data.message || 'Failed to delete document');
      }
    } catch (error) {
      console.error("Error deleting document:", error);
      setError('Network error while deleting document');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Upload document to an agent
  const uploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAgent) return;
    
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setIsLoading(true);
      setUploadError(null);
      
      // Use FormData instead of JSON for file uploads
      const formData = new FormData();
      formData.append('agent_id', selectedAgent.id.toString());
      formData.append('file', file);
      
      console.log('Uploading file using FormData:', file.name);
      
      // Use the documents/formdata endpoint for FormData uploads
      const response = await fetch(`${apiUrl}/documents/formdata`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Refresh documents list
        fetchDocuments(selectedAgent.id);
      } else {
        setUploadError(data.message || 'Failed to upload document');
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadError('Error processing file');
    } finally {
      setIsLoading(false);
      // Reset the file input
      setFileInputKey(Date.now());
    }
  };
  
  // Create a new chat
  const createChat = async (parentChatId?: number) => {
    if (!selectedAgent) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Ensure we're only using primitive values to avoid circular references
      const chatData: { agent_id: number; parent_chat_id?: number } = {
        agent_id: selectedAgent.id,
      };
      
      // If parent_chat_id is provided, add it to the request
      // Make sure it's a number to avoid any circular reference issues
      if (parentChatId && typeof parentChatId === 'number') {
        chatData.parent_chat_id = parentChatId;
      }
      
      console.log('Creating chat with data:', chatData);
      
      const response = await fetch(`${apiUrl}/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chatData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentChatId(data.chat.id);
        setChatMessages([]);
      } else {
        setError(data.message || 'Failed to create chat');
      }
    } catch (error) {
      console.error("Error creating chat:", error);
      setError('Network error while creating chat');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Send a message in a chat
  const sendMessage = async (message: string) => {
    if (!currentChatId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Add user message to UI immediately
      const userMessage: Message = {
        id: Date.now(),
        chat_id: currentChatId,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      };
      
      setChatMessages([...chatMessages, userMessage]);
      
      const response = await fetch(`${apiUrl}/chats/${currentChatId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChatMessages(data.messages);
      } else {
        setError(data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError('Network error while sending message');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch chat history for an agent
  const fetchAgentChatHistory = async (agentId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Fetching chat history for agent ID: ${agentId}`);
      const response = await fetch(`${apiUrl}/chats/agent/${agentId}/chat-history`);
      const data = await response.json();
      
      if (data.success) {
        setAgentChats(data.agentChats || []);
        setChildAgentChats(data.childAgentChats || []);
        setParentAgentChats(data.parentAgentChats || []);
      } else {
        console.error('Failed to fetch chat history:', data.message);
        setError(data.message || 'Failed to fetch chat history');
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setError('Network error while fetching chat history');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch chat by ID with messages
  const fetchChatMessages = async (chatId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Fetching messages for chat ID: ${chatId}`);
      const response = await fetch(`${apiUrl}/chats/${chatId}`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentChatId(chatId);
        setChatMessages(data.messages || []);
      } else {
        console.error('Failed to fetch chat messages:', data.message);
        setError(data.message || 'Failed to fetch chat messages');
      }
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      setError('Network error while fetching chat messages');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle selecting a chat from the chat history
  const handleSelectChat = (chat: Chat) => {
    fetchChatMessages(chat.id);
  };
  
  // Select an agent and fetch its documents and chat history
  const handleSelectAgent = (agent: Agent) => {
    console.log('Agent selected:', agent);
    setSelectedAgent(agent);
    fetchDocuments(agent.id);
    fetchAgentChatHistory(agent.id);
    setCurrentChatId(null);
    setChatMessages([]);
    
    // If this is a parent agent, fetch its child agents
    if (agent.is_parent) {
      console.log('This is a parent agent, fetching child agents');
      fetchChildAgents(agent.id);
    } else {
      console.log('This is not a parent agent, clearing child agents');
      setChildAgents([]);
    }
  };
  
  // Handle form cancel
  const handleFormCancel = () => {
    setShowCreateForm(false);
    setShowChildAgentForm(false);
  };
  
  // If there's an error, show it
  if (error) {
    return (
      <Card className="mb-6 bg-red-50 border border-red-200 text-red-700 relative">
        <div className="flex justify-between items-start">
          <span>{error}</span>
          <button 
            className="text-red-500 hover:text-red-700"
            onClick={() => setError(null)}
            aria-label="Close error message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </Card>
    );
  }
  
  // If upload error, show it
  if (uploadError) {
    return (
      <Card className="mb-6 bg-red-50 border border-red-200 text-red-700 relative">
        <div className="flex justify-between items-start">
          <span>{uploadError}</span>
          <button 
            className="text-red-500 hover:text-red-700"
            onClick={() => setUploadError(null)}
            aria-label="Close error message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </Card>
    );
  }
  
  // Debug render conditions
  console.log('Render conditions:', {
    selectedAgent: !!selectedAgent,
    showCreateForm,
    showChildAgentForm,
    renderingAgentList: !selectedAgent && !showCreateForm,
    renderingAgentForm: showCreateForm || showChildAgentForm,
    renderingAgentDetails: selectedAgent && !showCreateForm && !showChildAgentForm
  });

  return (
    <div>
      {/* Show agent list if no agent is selected and not creating a new agent */}
      {!selectedAgent && !showCreateForm ? (
        <AgentList
          agents={agents}
          clients={clients}
          isLoading={isLoading}
          onSelectAgent={handleSelectAgent}
          onCreateAgent={() => setShowCreateForm(true)}
        />
      ) : showCreateForm || showChildAgentForm ? (
        /* Show agent form if creating a new agent */
        <div>
          <div className="flex items-center mb-8">
            <button
              onClick={() => {
                setShowCreateForm(false);
                setShowChildAgentForm(false);
                setSelectedAgent(null);
              }}
              className="mr-4 text-gray-500 hover:text-gray-700"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-800">
              {showChildAgentForm ? 'Create Child Agent' : 'Create New Agent'}
            </h1>
          </div>
          
          <AgentForm
            onSubmit={createAgent}
            onCancel={handleFormCancel}
            isLoading={isLoading}
            clients={clients}
            parentAgents={agents.filter(a => a.is_parent)}
            isChildAgent={showChildAgentForm}
            initialData={showChildAgentForm && selectedAgent ? { parent_id: selectedAgent.id } : undefined}
          />
        </div>
      ) : selectedAgent && (
        /* Show agent details and chat if an agent is selected */
        <div>
          <div className="flex items-center mb-6">
            <button
              onClick={() => setSelectedAgent(null)}
              className="mr-4 text-gray-500 hover:text-gray-700"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-800">{selectedAgent.name}</h1>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent details and documents */}
            <div className="lg:col-span-1">
              <AgentDetails
                agent={selectedAgent}
                documents={documents}
                childAgents={childAgents}
                clients={clients}
                isLoading={isLoading}
                onUploadDocument={uploadDocument}
                onDeleteDocument={deleteDocument}
                onSelectAgent={handleSelectAgent}
                onCreateChildAgent={() => {
                  setShowChildAgentForm(true);
                }}
              />
              
              {/* Chat History */}
              <div className="mt-6">
                <ChatHistory
                  agent={selectedAgent}
                  chats={agentChats}
                  childAgentChats={childAgentChats}
                  parentAgentChats={parentAgentChats}
                  isLoading={isLoading}
                  onSelectChat={handleSelectChat}
                  onCreateChat={createChat}
                  currentChatId={currentChatId}
                />
              </div>
            </div>
            
            {/* Chat with agent */}
            <div className="lg:col-span-2">
              <AgentChat
                agent={selectedAgent}
                currentChatId={currentChatId}
                messages={chatMessages}
                isLoading={isLoading}
                onSendMessage={sendMessage}
                onCreateChat={createChat}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentsPage;
