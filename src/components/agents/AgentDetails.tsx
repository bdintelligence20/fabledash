import { useState } from 'react';
import { Bot, FileText, Trash2, Upload, Plus } from 'lucide-react';
import { Agent, Document } from './AgentTypes';
import { Client } from '../clients/ClientTypes';
import { Button, Card } from '../ui';

interface AgentDetailsProps {
  agent: Agent;
  documents: Document[];
  childAgents: Agent[];
  clients: Client[];
  isLoading: boolean;
  onUploadDocument: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDeleteDocument: (documentId: number) => Promise<void>;
  onSelectAgent: (agent: Agent) => void;
  onCreateChildAgent: () => void;
}

const AgentDetails = ({
  agent,
  documents,
  childAgents,
  clients,
  isLoading,
  onUploadDocument,
  onDeleteDocument,
  onSelectAgent,
  onCreateChildAgent,
}: AgentDetailsProps) => {
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  
  // Get client name by ID
  const getClientName = (clientId: number | null | undefined) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : null;
  };
  
  return (
    <>
      <Card className="mb-6">
        <h2 className="text-lg font-medium mb-4">Agent Details</h2>
        <p className="text-gray-600 mb-4">{agent.description || "No description provided."}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {agent.client_id && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              Client: {getClientName(agent.client_id)}
            </span>
          )}
          {agent.is_parent && (
            <span className="text-xs bg-primary-100 text-primary-600 px-2 py-1 rounded-full">
              Parent Agent
            </span>
          )}
          {agent.parent_id && (
            <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-1 rounded-full">
              Child Agent
            </span>
          )}
        </div>
        
        <p className="text-sm text-gray-500">Created: {new Date(agent.created_at).toLocaleDateString()}</p>
      </Card>
      
      {agent.is_parent && (
        <Card className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Child Agents</h2>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={onCreateChildAgent}
              disabled={isLoading}
            >
              Add Child Agent
            </Button>
          </div>
          
          {childAgents.length > 0 ? (
            <div className="space-y-3">
              {childAgents.map(childAgent => (
                <div 
                  key={childAgent.id}
                  className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={() => onSelectAgent(childAgent)}
                >
                  <div className="flex items-center">
                    <div className="bg-secondary-100 p-2 rounded-xl mr-3">
                      <Bot className="h-5 w-5 text-secondary-700" />
                    </div>
                    <div>
                      <h3 className="font-medium">{childAgent.name}</h3>
                      {childAgent.description && (
                        <p className="text-sm text-gray-600 line-clamp-1">{childAgent.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Bot className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No child agents created yet</p>
            </div>
          )}
        </Card>
      )}
      
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Documents</h2>
          <label className={`${isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}>
            <Button
              variant="outline"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              disabled={isLoading}
            >
              Upload Document
            </Button>
            <input
              type="file"
              className="hidden"
              onChange={onUploadDocument}
              accept=".pdf,.txt,.csv,.doc,.docx"
              disabled={isLoading}
              key={fileInputKey}
            />
          </label>
        </div>
        
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
                  onClick={() => onDeleteDocument(doc.id)}
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
      </Card>
    </>
  );
};

export default AgentDetails;
