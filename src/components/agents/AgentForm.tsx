import { useState, useEffect } from 'react';
import { Client } from '../clients/ClientTypes';
import { Agent, ParentAgent } from './AgentTypes';
import { Button, Card, Input, Select } from '../ui';

interface AgentFormProps {
  onSubmit: (agentData: any) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  clients: Client[];
  parentAgents?: Agent[];
  initialData?: Partial<Agent>;
  isChildAgent?: boolean;
}

const AgentForm = ({
  onSubmit,
  onCancel,
  isLoading,
  clients,
  parentAgents = [],
  initialData,
  isChildAgent = false,
}: AgentFormProps) => {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [clientId, setClientId] = useState<number | undefined>(initialData?.client_id);
  const [parentId, setParentId] = useState<number | undefined>(initialData?.parent_id);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const agentData: any = {
      name,
      description,
    };
    
    // If it's a child agent, add parent_id
    if (isChildAgent && parentId) {
      agentData.parent_id = parentId;
      agentData.is_parent = false;
    } else {
      // If it's a parent agent, add client_id
      if (clientId) {
        agentData.client_id = clientId;
      }
      agentData.is_parent = true;
    }
    
    await onSubmit(agentData);
  };
  
  return (
    <Card className="max-w-3xl">
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <Input
            label="Agent Name"
            id="agentName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Document Assistant"
            required
            disabled={isLoading}
            fullWidth
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="agentDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="agentDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Describe what this agent will do..."
            rows={4}
            disabled={isLoading}
          />
        </div>
        
        {isChildAgent ? (
          <div className="mb-6">
            <Select
              label="Parent Agent"
              options={parentAgents.map(agent => ({
                value: agent.id,
                label: agent.name
              }))}
              value={parentId}
              onChange={(e) => setParentId(Number(e.target.value))}
              placeholder="Select a parent agent"
              required
              disabled={isLoading || parentAgents.length === 0}
              fullWidth
            />
            {parentAgents.length === 0 && (
              <p className="mt-1 text-sm text-red-600">
                No parent agents available. Create a parent agent first.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-6">
            <Select
              label="Client (Optional)"
              options={clients.map(client => ({
                value: client.id,
                label: client.name
              }))}
              value={clientId}
              onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Select a client"
              disabled={isLoading}
              fullWidth
            />
          </div>
        )}
        
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !name.trim() || (isChildAgent && !parentId)}
          >
            {isLoading ? 'Saving...' : initialData?.id ? 'Update Agent' : 'Create Agent'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default AgentForm;
