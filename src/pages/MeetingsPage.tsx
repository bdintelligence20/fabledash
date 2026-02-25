import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Search,
  FileText,
  Users,
  Calendar,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Table,
  Badge,
  Modal,
  Spinner,
} from '../components/ui';
import type { SelectOption } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface MeetingResponse {
  id: string;
  title: string;
  date: string;
  duration_minutes: number | null;
  participants: string[];
  source: 'read_ai' | 'fireflies' | 'manual';
  source_id: string | null;
  client_id: string | null;
  client_name: string | null;
  task_ids: string[];
  notes: string | null;
  has_transcript: boolean;
  action_items: string[];
  key_topics: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

interface MeetingListResponse {
  success: boolean;
  data: MeetingResponse[];
}

interface MeetingSingleResponse {
  success: boolean;
  data: MeetingResponse;
}

interface IntegrationStatus {
  readai_configured: boolean;
  fireflies_configured: boolean;
  last_sync: string | null;
}

interface StatusResponse {
  success: boolean;
  data: IntegrationStatus;
}

interface SyncResponse {
  success: boolean;
  data: {
    total_synced: number;
    total_errors: number;
  };
}

interface ClientResponse {
  id: string;
  name: string;
}

interface ClientListResponse {
  success: boolean;
  data: ClientResponse[];
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const SOURCE_BADGE_VARIANT: Record<string, 'primary' | 'success' | 'default'> = {
  read_ai: 'primary',
  fireflies: 'success',
  manual: 'default',
};

const SOURCE_LABELS: Record<string, string> = {
  read_ai: 'Read AI',
  fireflies: 'Fireflies',
  manual: 'Manual',
};

const SOURCE_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Sources' },
  { value: 'read_ai', label: 'Read AI' },
  { value: 'fireflies', label: 'Fireflies' },
  { value: 'manual', label: 'Manual' },
];

/* -------------------------------------------------------------------------- */
/*  CreateMeetingModal                                                         */
/* -------------------------------------------------------------------------- */

interface CreateMeetingFormState {
  title: string;
  date: string;
  participants: string;
  client_id: string;
  notes: string;
}

const emptyForm: CreateMeetingFormState = {
  title: '',
  date: new Date().toISOString().split('T')[0],
  participants: '',
  client_id: '',
  notes: '',
};

function CreateMeetingModal({
  isOpen,
  onClose,
  onSuccess,
  clients,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clients: ClientResponse[];
}) {
  const [form, setForm] = useState<CreateMeetingFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setError('');
    }
  }, [isOpen]);

  const clientOptions: SelectOption[] = [
    { value: '', label: 'No Client' },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Title is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const participants = form.participants
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      await apiClient.post<MeetingSingleResponse>('/meetings', {
        title: form.title.trim(),
        date: form.date,
        participants,
        source: 'manual',
        client_id: form.client_id || null,
        notes: form.notes.trim() || null,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Meeting" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        )}

        <Input
          label="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Meeting title"
          required
        />

        <Input
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          required
        />

        <Input
          label="Participants"
          value={form.participants}
          onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))}
          placeholder="Comma-separated names"
        />

        <Select
          label="Client"
          value={form.client_id}
          onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
          options={clientOptions}
        />

        <div className="w-full">
          <label htmlFor="meeting-notes" className="block text-label mb-1.5">
            Notes
          </label>
          <textarea
            id="meeting-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Meeting notes or transcript"
            rows={4}
            className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 transition-default"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Create Meeting
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  MeetingsPage                                                               */
/* -------------------------------------------------------------------------- */

export default function MeetingsPage() {
  const navigate = useNavigate();

  // Data state
  const [meetings, setMeetings] = useState<MeetingResponse[]>([]);
  const [clients, setClients] = useState<ClientResponse[]>([]);
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  /* ---- Fetch helpers ---- */

  async function fetchMeetings() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (sourceFilter) params.set('source', sourceFilter);
      if (clientFilter) params.set('client_id', clientFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const qs = params.toString();

      const res = await apiClient.get<MeetingListResponse>(`/meetings${qs ? `?${qs}` : ''}`);
      setMeetings(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }

  async function fetchIntegrationStatus() {
    try {
      const res = await apiClient.get<StatusResponse>('/meetings/status');
      setIntegrationStatus(res.data);
    } catch {
      // Non-critical — silently ignore
    }
  }

  async function fetchClients() {
    try {
      const res = await apiClient.get<ClientListResponse>('/clients');
      setClients(res.data);
    } catch {
      // Non-critical
    }
  }

  useEffect(() => {
    Promise.all([fetchMeetings(), fetchIntegrationStatus(), fetchClients()]);
  }, []);

  // Re-fetch meetings when filters change
  useEffect(() => {
    fetchMeetings();
  }, [sourceFilter, clientFilter, dateFrom, dateTo]);

  /* ---- Sync ---- */

  async function handleSync() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await apiClient.post<SyncResponse>('/meetings/sync');
      setSyncMessage(
        `Synced ${res.data.total_synced} meeting${res.data.total_synced !== 1 ? 's' : ''}${res.data.total_errors > 0 ? ` (${res.data.total_errors} errors)` : ''}`,
      );
      fetchMeetings();
      fetchIntegrationStatus();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  /* ---- Client-side search filter ---- */

  const filteredMeetings = meetings.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.client_name ?? '').toLowerCase().includes(q) ||
      m.participants.some((p) => p.toLowerCase().includes(q))
    );
  });

  /* ---- Client filter options ---- */

  const clientFilterOptions: SelectOption[] = [
    { value: '', label: 'All Clients' },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  /* ---- Helpers ---- */

  function formatDuration(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return '--';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function formatDate(isoDate: string): string {
    try {
      return new Date(isoDate).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoDate;
    }
  }

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">Meeting Intelligence</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
            onClick={handleSync}
            loading={syncing}
          >
            Sync Meetings
          </Button>
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setModalOpen(true)}
          >
            Add Meeting
          </Button>
        </div>
      </div>

      {/* Sync feedback */}
      {syncMessage && (
        <div className="rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
          {syncMessage}
        </div>
      )}

      {/* Integration status bar */}
      {integrationStatus && (
        <div className="flex items-center gap-4 rounded-lg border border-surface-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-surface-600">Integrations:</span>
          <Badge
            variant={integrationStatus.readai_configured ? 'success' : 'default'}
            dot
          >
            Read AI
          </Badge>
          <Badge
            variant={integrationStatus.fireflies_configured ? 'success' : 'default'}
            dot
          >
            Fireflies
          </Badge>
          {integrationStatus.last_sync && (
            <span className="text-xs text-surface-400 ml-auto">
              Last sync: {formatDate(integrationStatus.last_sync)}
            </span>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-72">
          <Input
            placeholder="Search meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="w-44">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
          />
        </div>
        <div className="w-44">
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
          />
        </div>
        <div className="w-44">
          <Select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            options={SOURCE_FILTER_OPTIONS}
          />
        </div>
        <div className="w-48">
          <Select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            options={clientFilterOptions}
          />
        </div>
        <Badge variant="default" size="md">
          {filteredMeetings.length} meeting{filteredMeetings.length !== 1 ? 's' : ''}
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
          {filteredMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-surface-400">
              <Calendar className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No meetings found</p>
              <p className="mt-1 text-sm">
                {search || sourceFilter || clientFilter || dateFrom || dateTo
                  ? 'Try adjusting your filters'
                  : 'Sync from your integrations or add a meeting manually'}
              </p>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Title</Table.HeaderCell>
                  <Table.HeaderCell>Source</Table.HeaderCell>
                  <Table.HeaderCell>Client</Table.HeaderCell>
                  <Table.HeaderCell>Duration</Table.HeaderCell>
                  <Table.HeaderCell>Participants</Table.HeaderCell>
                  <Table.HeaderCell>Transcript</Table.HeaderCell>
                  <Table.HeaderCell>Actions</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body striped>
                {filteredMeetings.map((meeting) => (
                  <Table.Row key={meeting.id}>
                    <Table.Cell>{formatDate(meeting.date)}</Table.Cell>
                    <Table.Cell>
                      <Link
                        to={`/meetings/${meeting.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {meeting.title}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={SOURCE_BADGE_VARIANT[meeting.source] ?? 'default'}>
                        {SOURCE_LABELS[meeting.source] ?? meeting.source}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {meeting.client_name ? (
                        <Link
                          to={`/clients/${meeting.client_id}`}
                          className="text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          {meeting.client_name}
                        </Link>
                      ) : (
                        <span className="text-surface-400">--</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>{formatDuration(meeting.duration_minutes)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-surface-400" />
                        <span>{meeting.participants.length}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {meeting.has_transcript ? (
                        <FileText className="h-4 w-4 text-success-500" />
                      ) : (
                        <span className="text-surface-300">--</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/meetings/${meeting.id}`)}
                      >
                        View
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </>
      )}

      {/* Create meeting modal */}
      <CreateMeetingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchMeetings()}
        clients={clients}
      />
    </div>
  );
}
