import { useState, useEffect } from 'react';
import { Edit, X, Bot } from 'lucide-react';
import { Client } from './ClientTypes';
import ClientTasks from './ClientTasks';
import CalendarView from './CalendarView';
import KanbanView from './KanbanView';
import ClientAgents from './ClientAgents';
import { apiUrl, apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';

interface ClientDetailPageProps {
  client: Client;
  onBack: () => void;
  onClientUpdated: () => void;
}

const ClientDetailPage = ({ 
  client, 
  onBack, 
  onClientUpdated 
}: ClientDetailPageProps) => {
  // Initialize activeTab from localStorage or default to 'tasks'
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem(`client_${client.id}_activeTab`);
    return savedTab || 'tasks';
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState<Client>({ ...client });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`client_${client.id}_activeTab`, activeTab);
  }, [activeTab, client.id]);
  
  // We'll use the apiUrl from our utility instead
  
  // Update client
  const updateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editedClient.name.trim()) {
      setError('Client name is required');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use apiPut utility instead of direct fetch
      const data = await apiPut(`/clients/${client.id}`, {
        name: editedClient.name,
        contact_email: editedClient.contact_email || null,
        contact_phone: editedClient.contact_phone || null,
        notes: editedClient.notes || null,
      });
      
      if (data.success) {
        setIsEditing(false);
        onClientUpdated();
      } else {
        setError(data.message || 'Failed to update client');
      }
    } catch (error) {
      console.error("Error updating client:", error);
      setError('Network error while updating client');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render the current tab based on state
  const renderTab = () => {
    switch (activeTab) {
      case 'tasks':
        return <ClientTasks clientId={client.id} />;
      case 'calendar':
        return <CalendarView clientId={client.id} />;
      case 'kanban':
        return <KanbanView clientId={client.id} />;
      case 'agents':
        return <ClientAgents client={client} />;
      default:
        return <ClientTasks clientId={client.id} />;
    }
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 text-gray-500 hover:text-gray-700"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold">{client.name}</h1>
        </div>
        
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-gray-500 hover:text-gray-700"
          aria-label="Edit client"
        >
          <Edit className="h-5 w-5" />
        </button>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError(null)}
            aria-label="Close error message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {isEditing ? (
        <div className="mb-8">
          <form onSubmit={updateClient} className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <label htmlFor="editClientName" className="block text-sm font-medium text-gray-700 mb-2">
                Client Name *
              </label>
              <input
                type="text"
                id="editClientName"
                value={editedClient.name}
                onChange={(e) => setEditedClient({ ...editedClient, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="editClientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="editClientEmail"
                value={editedClient.contact_email || ''}
                onChange={(e) => setEditedClient({ ...editedClient, contact_email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="editClientPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="text"
                id="editClientPhone"
                value={editedClient.contact_phone || ''}
                onChange={(e) => setEditedClient({ ...editedClient, contact_phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="editClientNotes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="editClientNotes"
                value={editedClient.notes || ''}
                onChange={(e) => setEditedClient({ ...editedClient, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                disabled={isLoading}
              />
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditedClient({ ...client });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center"
                disabled={isLoading || !editedClient.name.trim()}
              >
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {client.contact_email && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                <p className="text-gray-800">{client.contact_email}</p>
              </div>
            )}
            
            {client.contact_phone && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
                <p className="text-gray-800">{client.contact_phone}</p>
              </div>
            )}
          </div>
          
          {client.notes && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Notes</h3>
              <p className="text-gray-800 whitespace-pre-line">{client.notes}</p>
            </div>
          )}
          
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
            <p className="text-gray-800">{new Date(client.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <div className="flex border-b">
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'tasks' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'calendar' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`px-4 py-2 font-medium ${activeTab === 'kanban' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('kanban')}
          >
            Kanban
          </button>
          <button
            className={`px-4 py-2 font-medium flex items-center ${activeTab === 'agents' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('agents')}
          >
            <Bot className="h-4 w-4 mr-1" />
            AI Agents
          </button>
        </div>
      </div>
      
      {renderTab()}
    </div>
  );
};

export default ClientDetailPage;
