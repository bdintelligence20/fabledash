import { useState, useEffect, useRef } from 'react';
import { Plus, X, Trash2, UserCircle, Search, Mail, Phone, FileText, Calendar, Filter, ChevronDown } from 'lucide-react';
import { Client } from '../clients/ClientTypes';
import ClientDetailPage from '../clients/ClientDetailPage';
import { apiUrl, apiGet, apiPost, apiPut, apiDelete } from '../../utils/api';

// Define client categories for organization
type ClientCategory = 'all' | 'active' | 'inactive' | 'new';

const ClientsPage = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  
  // Initialize selectedClient from localStorage or default to null
  const [selectedClient, setSelectedClient] = useState<Client | null>(() => {
    const savedClient = localStorage.getItem('selectedClient');
    return savedClient ? JSON.parse(savedClient) : null;
  });
  
  // Initialize showCreateForm from localStorage or default to false
  const [showCreateForm, setShowCreateForm] = useState(() => {
    const savedShowCreateForm = localStorage.getItem('showCreateForm');
    return savedShowCreateForm === 'true';
  });
  
  // Form state
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ClientCategory>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  
  // Refs
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  
  // Save selectedClient to localStorage whenever it changes
  useEffect(() => {
    if (selectedClient) {
      localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
    } else {
      localStorage.removeItem('selectedClient');
    }
  }, [selectedClient]);
  
  // Save showCreateForm to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('showCreateForm', showCreateForm.toString());
  }, [showCreateForm]);
  
  // We'll use the apiUrl from our utility instead
  
  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, []);
  
  // Filter clients when search query or category changes
  useEffect(() => {
    filterClients();
  }, [clients, searchQuery, activeCategory]);
  
  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Fetch clients from API
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use apiGet utility instead of direct fetch
      const data = await apiGet('/clients');
      
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
  
  // Filter clients based on search query and active category
  const filterClients = () => {
    let filtered = [...clients];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(client => 
        client.name.toLowerCase().includes(query) || 
        (client.contact_email && client.contact_email.toLowerCase().includes(query)) ||
        (client.contact_phone && client.contact_phone.toLowerCase().includes(query)) ||
        (client.notes && client.notes.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (activeCategory !== 'all') {
      const currentDate = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      switch (activeCategory) {
        case 'new':
          filtered = filtered.filter(client => 
            new Date(client.created_at) >= oneMonthAgo
          );
          break;
        case 'active':
          // This would ideally be based on recent task activity
          // For now, just a placeholder implementation
          filtered = filtered.filter(client => 
            client.notes !== null && client.notes.length > 0
          );
          break;
        case 'inactive':
          // This would ideally be based on lack of recent task activity
          // For now, just a placeholder implementation
          filtered = filtered.filter(client => 
            !client.notes || client.notes.length === 0
          );
          break;
      }
    }
    
    setFilteredClients(filtered);
  };
  
  // Validate form fields
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!newClientName.trim()) {
      errors.name = 'Client name is required';
    }
    
    if (newClientEmail && !/^\S+@\S+\.\S+$/.test(newClientEmail)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (newClientPhone && !/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(newClientPhone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Create a new client
  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use apiPost utility instead of direct fetch
      const data = await apiPost('/clients', {
        name: newClientName,
        contact_email: newClientEmail || null,
        contact_phone: newClientPhone || null,
        notes: newClientNotes || null,
      });
      
      if (data.success) {
        // Reset form
        setNewClientName('');
        setNewClientEmail('');
        setNewClientPhone('');
        setNewClientNotes('');
        setFormErrors({});
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
      
      // Use apiDelete utility instead of direct fetch
      const data = await apiDelete(`/clients/${clientId}`);
      
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
  
  // Handle input change with validation
  const handleInputChange = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    field: string,
    value: string,
    validator?: (val: string) => boolean
  ) => {
    setter(value);
    
    // Clear the error when user starts typing
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: ''
      });
    }
    
    // Validate on change if validator provided
    if (validator && value) {
      const isValid = validator(value);
      if (!isValid) {
        setFormErrors({
          ...formErrors,
          [field]: `Invalid ${field}`
        });
      }
    }
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
          <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative">
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
          <form onSubmit={createClient} className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-2">
                Client Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="clientName"
                  value={newClientName}
                  onChange={(e) => handleInputChange(setNewClientName, 'name', e.target.value)}
                  className={`w-full px-4 py-3 border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors`}
                  placeholder="e.g., Acme Corporation"
                  required
                  disabled={isLoading}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="clientEmail"
                  value={newClientEmail}
                  onChange={(e) => handleInputChange(
                    setNewClientEmail, 
                    'email', 
                    e.target.value, 
                    (val) => /^\S+@\S+\.\S+$/.test(val)
                  )}
                  className={`w-full pl-10 px-4 py-3 border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors`}
                  placeholder="contact@example.com"
                  disabled={isLoading}
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <label htmlFor="clientPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="clientPhone"
                  value={newClientPhone}
                  onChange={(e) => handleInputChange(
                    setNewClientPhone, 
                    'phone', 
                    e.target.value,
                    (val) => /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(val)
                  )}
                  className={`w-full pl-10 px-4 py-3 border ${formErrors.phone ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors`}
                  placeholder="(123) 456-7890"
                  disabled={isLoading}
                />
                {formErrors.phone && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <label htmlFor="clientNotes" className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 top-3 flex items-start pl-3 pointer-events-none">
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <textarea
                  id="clientNotes"
                  value={newClientNotes}
                  onChange={(e) => setNewClientNotes(e.target.value)}
                  className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                  placeholder="Additional information about this client..."
                  rows={4}
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormErrors({});
                }}
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg flex items-center transition-colors"
                disabled={isLoading || !newClientName.trim()}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  'Create Client'
                )}
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64"
            />
          </div>
          
          {/* Filter Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 w-full sm:w-auto"
            >
              <div className="flex items-center">
                <Filter className="h-5 w-5 text-gray-500 mr-2" />
                <span>
                  {activeCategory === 'all' ? 'All Clients' : 
                   activeCategory === 'active' ? 'Active Clients' :
                   activeCategory === 'inactive' ? 'Inactive Clients' : 
                   'New Clients'}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 ml-2" />
            </button>
            
            {showFilterDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200">
                <ul className="py-1">
                  <li>
                    <button
                      onClick={() => {
                        setActiveCategory('all');
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeCategory === 'all' ? 'bg-purple-50 text-purple-700' : ''}`}
                    >
                      All Clients
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setActiveCategory('active');
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeCategory === 'active' ? 'bg-purple-50 text-purple-700' : ''}`}
                    >
                      Active Clients
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setActiveCategory('inactive');
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeCategory === 'inactive' ? 'bg-purple-50 text-purple-700' : ''}`}
                    >
                      Inactive Clients
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setActiveCategory('new');
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${activeCategory === 'new' ? 'bg-purple-50 text-purple-700' : ''}`}
                    >
                      New Clients
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => setShowCreateForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center transition-colors"
            disabled={isLoading}
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Client
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative">
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
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <>
          {/* Results summary */}
          <div className="mb-4 text-sm text-gray-500">
            {filteredClients.length === 0 ? (
              <p>No clients found</p>
            ) : (
              <p>Showing {filteredClients.length} {filteredClients.length === 1 ? 'client' : 'clients'}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <div 
                key={client.id}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-all border border-gray-100 hover:border-purple-200"
                onClick={() => handleSelectClient(client)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold mr-3">
                      {client.name.substring(0, 2).toUpperCase()}
                    </div>
                    <h2 className="text-lg font-medium">{client.name}</h2>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClient(client.id);
                    }}
                    className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-colors"
                    aria-label={`Delete ${client.name}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="pl-13">
                  {client.contact_email && (
                    <div className="flex items-center text-gray-600 mb-2">
                      <Mail className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{client.contact_email}</span>
                    </div>
                  )}
                  
                  {client.contact_phone && (
                    <div className="flex items-center text-gray-600 mb-2">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{client.contact_phone}</span>
                    </div>
                  )}
                  
                  {client.notes && (
                    <div className="flex text-gray-600 mb-4">
                      <FileText className="h-4 w-4 text-gray-400 mr-2 mt-1 flex-shrink-0" />
                      <p className="line-clamp-2">{client.notes}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-500 mt-4">
                    <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                    <span>Created: {new Date(client.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          
            {filteredClients.length === 0 && (
              <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                <UserCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                {searchQuery ? (
                  <>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Matching Clients</h3>
                    <p className="text-gray-500 mb-6">Try adjusting your search or filters</p>
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setActiveCategory('all');
                      }}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg inline-flex items-center transition-colors"
                    >
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Clients Yet</h3>
                    <p className="text-gray-500 mb-6">Create your first client to get started</p>
                    <button 
                      onClick={() => setShowCreateForm(true)}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg inline-flex items-center transition-colors"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Client
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ClientsPage;
