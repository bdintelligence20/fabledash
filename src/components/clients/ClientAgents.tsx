import { useState, useEffect } from 'react';
import { Bot, Plus, MessageSquare } from 'lucide-react';
import { Client } from './ClientTypes';
import { Agent } from '../agents/AgentTypes';
import { Button, Card } from '../ui';
import { apiGet } from '../../utils/api';

interface ClientAgentsProps {
  client: Client;
}

const ClientAgents = ({ client }: ClientAgentsProps) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch agents for this client
  useEffect(() => {
    fetchAgents();
  }, [client.id]);
  
  const fetchAgents = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use apiGet utility instead of direct fetch
      const data = await apiGet(`/agents?client_id=${client.id}&is_parent=true`);
      
      if (data.success) {
        setAgents(data.agents);
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
  
  // Navigate to agent details page
  const handleAgentClick = (agent: Agent) => {
    window.location.href = `/ai-agents?agent=${agent.id}`;
  };
  
  // Navigate to create agent page
  const handleCreateAgent = () => {
    window.location.href = `/ai-agents?client=${client.id}&create=true`;
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">AI Agents</h2>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="h-4 w-4" />}
          onClick={handleCreateAgent}
        >
          Create Agent
        </Button>
      </div>
      
      {error && (
        <Card className="mb-6 bg-red-50 border border-red-200 text-red-700">
          {error}
        </Card>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <Card 
            key={agent.id}
            className="cursor-pointer hover:shadow-card-hover transition-shadow"
            onClick={() => handleAgentClick(agent)}
          >
            <div className="flex items-center mb-3">
              <div className="bg-primary-100 p-2 rounded-lg mr-3">
                <Bot className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <h3 className="font-medium">{agent.name}</h3>
                <p className="text-xs text-gray-500">
                  Created: {new Date(agent.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {agent.description || "No description provided."}
            </p>
            <div className="flex justify-end">
              <Button
                variant="text"
                size="sm"
                icon={<MessageSquare className="h-4 w-4" />}
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `/ai-agents?agent=${agent.id}&chat=new`;
                }}
              >
                Chat
              </Button>
            </div>
          </Card>
        ))}
        
        {agents.length === 0 && !isLoading && (
          <Card className="col-span-full py-8 text-center">
            <Bot className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No AI agents for this client yet</p>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleCreateAgent}
            >
              Create First Agent
            </Button>
          </Card>
        )}
        
        {isLoading && (
          <div className="col-span-full py-8 text-center">
            <p className="text-gray-500">Loading agents...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientAgents;
