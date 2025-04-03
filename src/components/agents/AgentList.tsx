import { Bot, Plus } from 'lucide-react';
import { Agent } from './AgentTypes';
import { Client } from '../clients/ClientTypes';
import { Button, Card } from '../ui';

interface AgentListProps {
  agents: Agent[];
  clients: Client[];
  isLoading: boolean;
  onSelectAgent: (agent: Agent) => void;
  onCreateAgent: () => void;
}

const AgentList = ({
  agents,
  clients,
  isLoading,
  onSelectAgent,
  onCreateAgent,
}: AgentListProps) => {
  // Get client name by ID
  const getClientName = (clientId: number | null | undefined) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : null;
  };
  
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">AI Agents</h1>
        <Button 
          onClick={onCreateAgent}
          variant="primary"
          icon={<Plus className="h-5 w-5" />}
          disabled={isLoading}
        >
          Create Agent
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <Card 
            key={agent.id}
            className="cursor-pointer hover:shadow-card-hover transition-shadow"
            onClick={() => onSelectAgent(agent)}
          >
            <div className="flex items-center mb-4">
              <div className={`${agent.is_parent ? 'bg-primary-100' : 'bg-secondary-100'} p-3 rounded-xl mr-4`}>
                <Bot className={`h-6 w-6 ${agent.is_parent ? 'text-primary-500' : 'text-secondary-700'}`} />
              </div>
              <div>
                <h2 className="text-lg font-medium">{agent.name}</h2>
                <div className="flex mt-1 flex-wrap gap-2">
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
                </div>
              </div>
            </div>
            <p className="text-gray-600 mb-4 line-clamp-2">{agent.description || "No description provided."}</p>
            <p className="text-sm text-gray-500">Created: {new Date(agent.created_at).toLocaleDateString()}</p>
          </Card>
        ))}
        
        {agents.length === 0 && (
          <Card className="col-span-full text-center py-12">
            <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">No AI Agents Yet</h3>
            <p className="text-gray-500 mb-6">Create your first AI agent to get started</p>
            <Button 
              onClick={onCreateAgent}
              variant="primary"
              icon={<Plus className="h-5 w-5" />}
            >
              Create Agent
            </Button>
          </Card>
        )}
      </div>
    </>
  );
};

export default AgentList;
