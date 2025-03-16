import { useState, useEffect } from 'react';
import { Plus, X, Trash2, UserCircle } from 'lucide-react';
import { Client } from '../clients/ClientTypes';
import ClientDetailPage from '../clients/ClientDetailPage';

const ClientsPage = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  
  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, []);
  
  // Fetch clients from API
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/clients/list`);
      const data = await response.json();
      
      if (data.success) {
        setClients(data.clients);
      } else {
        setError(data.message || 'Failed to fetch clients');
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      setError('Network error while fetching clients');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a new client
  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newClientName.trim()) {
      setError('Client name is required');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/clients/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newClientName,
          contact_email: newClientEmail || null,
          contact_phone: newClientPhone || null,
          notes: newClientNotes || null,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Reset form
        setNewClientName('');
        setNewClientEmail('');
        setNewClientPhone('');
        setNewClientNotes('');
        setShowCreateForm(false);
        
        // Refresh clients list
        fetchClients();
      } else {
        setError(data.message || 'Failed to create client');
      }
    } catch (error) {
      console.error("Error creating client:", error);
      setError('Network error while creating client');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a client
  const deleteClient = async (clientId: number) => {
    if (!confirm('Are you sure you want to delete this client? This will also delete all tasks associated with this client.')) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`${apiUrl}/clients/${clientId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // If the deleted client was selected, deselect it
        if (selectedClient && selectedClient.id === clientId) {
          setSelectedClient(null);
        }
        
        // Refresh clients list
        fetchClients();
      } else {
        setError(data.message || 'Failed to delete client');
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      setError('Network error while deleting client');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Select a client
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
  };
  
  // Handle client update
  const handleClientUpdated = () => {
    fetchClients();
  };
  
  // Render client detail page
  if (selectedClient) {
    return (
      <ClientDetailPage 
        client={selectedClient} 
        onBack={() => setSelectedClient(null)} 
        onClientUpdated={handleClientUpdated}
      />
    );
  }
  
  // Render create client form
  if (showCreateForm) {
    return (
      <div className="p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold">Add New Client</h1>
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
        
        <div className="max-w-3xl">
          <form onSubmit={createClient} className="bg-white rounded-lg shadow p-6">
            <div className="mb-6">
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-2">
                Client Name *
              </label>
              <input
                type="text"
                id="clientName"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Acme Corporation"
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="clientEmail"
                value={newClientEmail}
                onChange={(e) => setNewClientEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="contact@example.com"
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="text"
                id="clientPhone"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(123) 456-7890"
                disabled={isLoading}
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="clientNotes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                id="clientNotes"
                value={newClientNotes}
                onChange={(e) => setNewClientNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional information about this client..."
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
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center"
                disabled={isLoading || !newClientName.trim()}
              >
                {isLoading ? 'Creating...' : 'Create Client'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  
  // Render clients list
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center"
          disabled={isLoading}
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Client
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
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div 
              key={client.id}
              className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleSelectClient(client)}
            >
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-medium">{client.name}</h2>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteClient(client.id);
                  }}
                  className="text-red-500 hover:text-red-700"
                  aria-label={`Delete ${client.name}`}
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              
              {client.contact_email && (
                <p className="text-gray-600 mb-2">
                  <span className="font-medium">Email:</span> {client.contact_email}
                </p>
              )}
              
              {client.contact_phone && (
                <p className="text-gray-600 mb-2">
                  <span className="font-medium">Phone:</span> {client.contact_phone}
                </p>
              )}
              
              {client.notes && (
                <p className="text-gray-600 mb-4 line-clamp-2">
                  <span className="font-medium">Notes:</span> {client.notes}
                </p>
              )}
              
              <p className="text-sm text-gray-500">Created: {new Date(client.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          
          {clients.length === 0 && (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
              <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Clients Yet</h3>
              <p className="text-gray-500 mb-6">Create your first client to get started</p>
              <button 
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg inline-flex items-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Client
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientsPage;
