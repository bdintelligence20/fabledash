import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  ToggleLeft,
  ToggleRight,
  ListTodo,
  Clock,
  DollarSign,
  CheckCircle2,
  Activity,
  Timer,
  PieChart,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Card,
  Table,
  Badge,
  StatCard,
  Tabs,
  Modal,
  Spinner,
} from '../components/ui';
import type { SelectOption, Tab } from '../components/ui';
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

interface ClientSingleResponse {
  success: boolean;
  data: ClientResponse;
}

interface TaskResponse {
  id: string;
  title: string;
  description: string | null;
  client_id: string;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface TaskListResponse {
  success: boolean;
  data: TaskResponse[];
}

interface TimeLogResponse {
  id: string;
  date: string;
  client_id: string;
  task_id: string | null;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface TimeLogListResponse {
  success: boolean;
  data: TimeLogResponse[];
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

const PARTNER_GROUP_FORM_OPTIONS: SelectOption[] = [
  { value: 'collab', label: 'Collab' },
  { value: 'edcp', label: 'EDCP' },
  { value: 'direct_clients', label: 'Direct Clients' },
  { value: 'separate_businesses', label: 'Separate Businesses' },
];

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'warning' | 'success' | 'danger'> = {
  todo: 'default',
  in_progress: 'primary',
  in_review: 'warning',
  done: 'success',
  blocked: 'danger',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  blocked: 'Blocked',
};

const PRIORITY_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const TABS: Tab[] = [
  { id: 'tasks', label: 'Tasks', icon: <ListTodo className="h-4 w-4" /> },
  { id: 'time-logs', label: 'Time Logs', icon: <Clock className="h-4 w-4" /> },
  { id: 'financial', label: 'Financial', icon: <DollarSign className="h-4 w-4" /> },
];

/* -------------------------------------------------------------------------- */
/*  EditClientModal                                                            */
/* -------------------------------------------------------------------------- */

interface ModalFormState {
  name: string;
  partner_group: string;
  contact_email: string;
  contact_phone: string;
  description: string;
}

function EditClientModal({
  isOpen,
  onClose,
  onSuccess,
  client,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client: ClientResponse;
}) {
  const [form, setForm] = useState<ModalFormState>({
    name: client.name,
    partner_group: client.partner_group,
    contact_email: client.contact_email ?? '',
    contact_phone: client.contact_phone ?? '',
    description: client.description ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      name: client.name,
      partner_group: client.partner_group,
      contact_email: client.contact_email ?? '',
      contact_phone: client.contact_phone ?? '',
      description: client.description ?? '',
    });
    setError('');
  }, [client, isOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await apiClient.put<ClientSingleResponse>(`/clients/${client.id}`, {
        name: form.name.trim(),
        partner_group: form.partner_group,
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        description: form.description.trim() || null,
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
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Client" size="lg">
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
          <label htmlFor="edit-description" className="block text-label mb-1.5">
            Description
          </label>
          <textarea
            id="edit-description"
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
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  ClientDetailPage                                                           */
/* -------------------------------------------------------------------------- */

export default function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();

  // Data state
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLogResponse[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');
  const [editModalOpen, setEditModalOpen] = useState(false);

  async function fetchData() {
    if (!clientId) return;

    setLoading(true);
    setError('');
    setNotFound(false);

    try {
      const [clientRes, tasksRes, timeLogsRes] = await Promise.all([
        apiClient.get<ClientSingleResponse>(`/clients/${clientId}`),
        apiClient.get<TaskListResponse>(`/tasks?client_id=${clientId}`),
        apiClient.get<TimeLogListResponse>(`/time-logs?client_id=${clientId}`),
      ]);

      setClient(clientRes.data);
      setTasks(tasksRes.data);
      setTimeLogs(timeLogsRes.data);
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load client data');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [clientId]);

  async function handleToggleActive() {
    if (!client) return;
    try {
      await apiClient.put<ClientSingleResponse>(`/clients/${client.id}`, {
        is_active: !client.is_active,
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    }
  }

  // Computed metrics
  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status !== 'done').length;
  const totalHours = timeLogs.reduce((sum, tl) => sum + tl.duration_minutes, 0) / 60;
  const completionRate = totalTasks > 0
    ? Math.round((tasks.filter((t) => t.status === 'done').length / totalTasks) * 100)
    : 0;

  // Tab labels with counts
  const tabsWithCounts: Tab[] = TABS.map((tab) => {
    if (tab.id === 'tasks') return { ...tab, label: `Tasks (${totalTasks})` };
    if (tab.id === 'time-logs') return { ...tab, label: `Time Logs (${timeLogs.length})` };
    return tab;
  });

  /* ---------------------------------------------------------------------- */
  /*  Loading state                                                          */
  /* ---------------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  404 state                                                              */
  /* ---------------------------------------------------------------------- */

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-surface-400">
        <p className="text-lg font-medium">Client not found</p>
        <Link to="/clients" className="mt-4 text-primary-600 hover:text-primary-700 hover:underline">
          &larr; Back to Clients
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Error state                                                            */
  /* ---------------------------------------------------------------------- */

  if (error || !client) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error || 'An unexpected error occurred'}
        </div>
        <Link to="/clients" className="text-primary-600 hover:text-primary-700 hover:underline">
          &larr; Back to Clients
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Main render                                                            */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-primary-600 transition-default"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-surface-900">{client.name}</h1>
          <Badge variant={PARTNER_GROUP_BADGE_VARIANT[client.partner_group] ?? 'default'}>
            {PARTNER_GROUP_LABELS[client.partner_group] ?? client.partner_group}
          </Badge>
          <Badge variant={client.is_active ? 'success' : 'default'} dot>
            {client.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Pencil className="h-3.5 w-3.5" />}
            onClick={() => setEditModalOpen(true)}
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
            onClick={handleToggleActive}
          >
            {client.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      {/* Client info card */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-surface-500">Contact Email</p>
            <p className="font-medium text-surface-900">{client.contact_email ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Contact Phone</p>
            <p className="font-medium text-surface-900">{client.contact_phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Description</p>
            <p className="font-medium text-surface-900">{client.description ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Partner Group</p>
            <p className="font-medium text-surface-900">
              {PARTNER_GROUP_LABELS[client.partner_group] ?? client.partner_group}
            </p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Created</p>
            <p className="font-medium text-surface-900">
              {new Date(client.created_at).toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </Card>

      {/* StatCards row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={totalTasks}
          icon={<ListTodo className="h-5 w-5" />}
        />
        <StatCard
          title="Active Tasks"
          value={activeTasks}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Total Hours"
          value={totalHours.toFixed(1)}
          icon={<Timer className="h-5 w-5" />}
        />
        <StatCard
          title="Completion Rate"
          value={`${completionRate}%`}
          icon={<PieChart className="h-5 w-5" />}
        />
      </div>

      {/* Tabbed content */}
      <Tabs tabs={tabsWithCounts} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tasks tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link to={`/tasks?client_id=${clientId}`}>
              <Button variant="primary" size="sm" icon={<CheckCircle2 className="h-4 w-4" />}>
                New Task
              </Button>
            </Link>
          </div>
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400">
              <ListTodo className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No tasks for this client</p>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Title</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell>Priority</Table.HeaderCell>
                  <Table.HeaderCell>Due Date</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body striped>
                {tasks.map((task) => (
                  <Table.Row key={task.id}>
                    <Table.Cell>
                      <Link
                        to={`/tasks/${task.id}`}
                        className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                      >
                        {task.title}
                      </Link>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATUS_BADGE_VARIANT[task.status] ?? 'default'}>
                        {STATUS_LABELS[task.status] ?? task.status}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Badge variant={PRIORITY_BADGE_VARIANT[task.priority] ?? 'default'}>
                        {PRIORITY_LABELS[task.priority] ?? task.priority}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString('en-ZA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      )}

      {/* Time Logs tab */}
      {activeTab === 'time-logs' && (
        <div>
          {timeLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400">
              <Clock className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No time logs recorded</p>
            </div>
          ) : (
            <Table>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Description</Table.HeaderCell>
                  <Table.HeaderCell>Duration</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body striped>
                {timeLogs.map((tl) => (
                  <Table.Row key={tl.id}>
                    <Table.Cell>
                      {new Date(tl.date + 'T00:00:00').toLocaleDateString('en-ZA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Table.Cell>
                    <Table.Cell>{tl.description}</Table.Cell>
                    <Table.Cell>
                      {(tl.duration_minutes / 60).toFixed(1)}h
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </div>
      )}

      {/* Financial tab */}
      {activeTab === 'financial' && (
        <Card className="min-h-[200px] flex items-center justify-center">
          <div className="text-center text-surface-400">
            <DollarSign className="h-10 w-10 mx-auto mb-3" />
            <p className="text-lg font-medium">Financial summary</p>
            <p className="text-sm mt-1">Will be available after Sage integration (Phase 6)</p>
          </div>
        </Card>
      )}

      {/* Edit modal */}
      {client && (
        <EditClientModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={fetchData}
          client={client}
        />
      )}
    </div>
  );
}
