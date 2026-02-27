import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, ToggleLeft, ToggleRight, Search, Upload } from 'lucide-react';
import { Button, Input, Select, Table, Badge, Modal, Spinner } from '../components/ui';
import { BulkImportModal } from '../components/ui/BulkImportModal';
import type { SelectOption } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface ClientResponse {
  id: string;
  name: string;
  partner_group: string;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface ClientListResponse {
  success: boolean;
  data: ClientResponse[];
}

interface ClientSingleResponse {
  success: boolean;
  data: ClientResponse;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const PARTNER_GROUP_LABELS: Record<string, string> = {
  collab: 'Collab',
  edcp: 'EDCP',
  direct_clients: 'Direct Clients',
  separate_businesses: 'Separate Businesses',
};

const PARTNER_GROUP_BADGE_VARIANT: Record<string, 'primary' | 'default' | 'success' | 'warning'> = {
  collab: 'primary',
  edcp: 'default',
  direct_clients: 'success',
  separate_businesses: 'warning',
};

const PARTNER_GROUP_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Partner Groups' },
  { value: 'collab', label: 'Collab' },
  { value: 'edcp', label: 'EDCP' },
  { value: 'direct_clients', label: 'Direct Clients' },
  { value: 'separate_businesses', label: 'Separate Businesses' },
];

const PARTNER_GROUP_FORM_OPTIONS: SelectOption[] = [
  { value: 'collab', label: 'Collab' },
  { value: 'edcp', label: 'EDCP' },
  { value: 'direct_clients', label: 'Direct Clients' },
  { value: 'separate_businesses', label: 'Separate Businesses' },
];

/* -------------------------------------------------------------------------- */
/*  CreateEditClientModal                                                      */
/* -------------------------------------------------------------------------- */

interface ModalFormState {
  name: string;
  partner_group: string;
  contact_email: string;
  contact_phone: string;
  description: string;
}

const emptyForm: ModalFormState = {
  name: '',
  partner_group: 'collab',
  contact_email: '',
  contact_phone: '',
  description: '',
};

function CreateEditClientModal({
  isOpen,
  onClose,
  onSuccess,
  editingClient,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingClient: ClientResponse | null;
}) {
  const [form, setForm] = useState<ModalFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingClient) {
      setForm({
        name: editingClient.name,
        partner_group: editingClient.partner_group,
        contact_email: editingClient.contact_email ?? '',
        contact_phone: editingClient.contact_phone ?? '',
        description: editingClient.description ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setError('');
  }, [editingClient, isOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const body = {
        name: form.name.trim(),
        partner_group: form.partner_group,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        description: form.description.trim() || null,
      };

      if (editingClient) {
        await apiClient.put<ClientSingleResponse>(`/clients/${editingClient.id}`, body);
      } else {
        await apiClient.post<ClientSingleResponse>('/clients', body);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingClient ? 'Edit Client' : 'New Client'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        )}

        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Client name"
          required
        />

        <Select
          label="Partner Group"
          value={form.partner_group}
          onChange={(e) => setForm((f) => ({ ...f, partner_group: e.target.value }))}
          options={PARTNER_GROUP_FORM_OPTIONS}
        />

        <Input
          label="Contact Email"
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
          placeholder="email@example.com"
        />

        <Input
          label="Contact Phone"
          type="tel"
          value={form.contact_phone}
          onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
          placeholder="+27 ..."
        />

        <div className="w-full">
          <label htmlFor="description" className="block text-label mb-1.5">
            Description
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of the client"
            rows={3}
            className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 transition-default"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {editingClient ? 'Save Changes' : 'Create Client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  ClientsPage                                                                */
/* -------------------------------------------------------------------------- */

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [partnerGroupFilter, setPartnerGroupFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientResponse | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  async function fetchClients(partnerGroup?: string) {
    setLoading(true);
    setError('');
    try {
      const queryParam = partnerGroup ? `?partner_group=${partnerGroup}` : '';
      const res = await apiClient.get<ClientListResponse>(`/clients${queryParam}`);
      setClients(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients(partnerGroupFilter || undefined);
  }, [partnerGroupFilter]);

  function handleNewClient() {
    setEditingClient(null);
    setModalOpen(true);
  }

  function handleEditClient(client: ClientResponse) {
    setEditingClient(client);
    setModalOpen(true);
  }

  async function handleToggleActive(client: ClientResponse) {
    try {
      await apiClient.put<ClientSingleResponse>(`/clients/${client.id}`, {
        is_active: !client.is_active,
      });
      fetchClients(partnerGroupFilter || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    }
  }

  // Client-side search filtering
  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">Clients</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setBulkImportOpen(true)}>
            Import
          </Button>
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={handleNewClient}>
            New Client
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-4">
        <div className="w-72">
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-56">
          <Select
            value={partnerGroupFilter}
            onChange={(e) => setPartnerGroupFilter(e.target.value)}
            options={PARTNER_GROUP_OPTIONS}
          />
        </div>
        <Badge variant="default" size="md">
          {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Data table */}
      {!loading && (
        <>
          {filteredClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-400">
              <p className="text-lg font-medium">No clients found</p>
              <p className="mt-1 text-sm">
                {search || partnerGroupFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first client to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Name</Table.HeaderCell>
                  <Table.HeaderCell>Partner Group</Table.HeaderCell>
                  <Table.HeaderCell>Contact Email</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body striped>
                {filteredClients.map((client) => (
                  <Table.Row key={client.id}>
                    <Table.Cell>
                      <Link
                        to={`/clients/${client.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {client.name}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge
                        variant={PARTNER_GROUP_BADGE_VARIANT[client.partner_group] ?? 'default'}
                      >
                        {PARTNER_GROUP_LABELS[client.partner_group] ?? client.partner_group}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{client.contact_email ?? '—'}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={client.is_active ? 'success' : 'default'} dot>
                        {client.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => handleEditClient(client)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={
                            client.is_active ? (
                              <ToggleRight className="h-3.5 w-3.5" />
                            ) : (
                              <ToggleLeft className="h-3.5 w-3.5" />
                            )
                          }
                          onClick={() => handleToggleActive(client)}
                        >
                          {client.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </>
      )}

      {/* Create/Edit modal */}
      <CreateEditClientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchClients(partnerGroupFilter || undefined)}
        editingClient={editingClient}
      />

      {/* Bulk import modal */}
      <BulkImportModal
        isOpen={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSuccess={() => fetchClients(partnerGroupFilter || undefined)}
        title="Import Clients"
        endpoint="/clients/bulk"
        bodyKey="clients"
        columns={[
          { key: 'name', label: 'Name', required: true },
          { key: 'partner_group', label: 'Partner Group', required: true },
          { key: 'contact_email', label: 'Email' },
          { key: 'contact_phone', label: 'Phone' },
          { key: 'description', label: 'Description' },
        ]}
        sampleCsv="name,partner_group,contact_email,contact_phone,description&#10;Acme Corp,direct_clients,acme@example.com,+27123456789,Strategy consulting&#10;Beta Inc,collab,beta@example.com,,Product design"
      />
    </div>
  );
}
