import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge, Button, Card, Input, Select, Spinner, Table } from '../components/ui';
import type { SelectOption } from '../components/ui';
import apiClient from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface TimeLog {
  id: string;
  date: string;
  client_id: string;
  task_id: string | null;
  description: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface Client {
  id: string;
  name: string;
  partner_group: string;
  is_active: boolean;
}

interface Task {
  id: string;
  name: string;
  client_id: string;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(iso: string): string {
  return format(new Date(iso), 'dd MMM yyyy');
}

function getFirstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/* -------------------------------------------------------------------------- */
/*  Partner group options                                                       */
/* -------------------------------------------------------------------------- */

const PARTNER_GROUP_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Groups' },
  { value: 'collab', label: 'Collab' },
  { value: 'edcp', label: 'EDCP' },
  { value: 'direct_clients', label: 'Direct Clients' },
  { value: 'separate_businesses', label: 'Separate Businesses' },
];

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function TimeLogListPage() {
  /* ---- Reference data ---- */
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  /* ---- Filter state ---- */
  const [dateFrom, setDateFrom] = useState(getFirstDayOfMonth);
  const [dateTo, setDateTo] = useState(getToday);
  const [clientId, setClientId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [partnerGroup, setPartnerGroup] = useState('');

  /* ---- Data state ---- */
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---- Lookup maps ---- */
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.name);
    return m;
  }, [clients]);

  const clientGroupMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.partner_group);
    return m;
  }, [clients]);

  const taskMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, t.name);
    return m;
  }, [tasks]);

  /* ---- Derived: task options filtered by selected client ---- */
  const taskOptions = useMemo<SelectOption[]>(() => {
    const filtered = clientId
      ? tasks.filter((t) => t.client_id === clientId)
      : tasks;
    return [
      { value: '', label: 'All Tasks' },
      ...filtered.map((t) => ({ value: t.id, label: t.name })),
    ];
  }, [tasks, clientId]);

  /* ---- Client select options ---- */
  const clientOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'All Clients' },
      ...clients.map((c) => ({ value: c.id, label: c.name })),
    ],
    [clients],
  );

  /* ---- Fetch reference data on mount ---- */
  useEffect(() => {
    async function loadReferenceData() {
      try {
        const [clientsRes, tasksRes] = await Promise.all([
          apiClient.get<{ success: boolean; data: Client[] }>('/clients/'),
          apiClient.get<{ success: boolean; data: Task[] }>('/tasks/'),
        ]);
        if (clientsRes.success) setClients(clientsRes.data);
        if (tasksRes.success) setTasks(tasksRes.data);
      } catch (err) {
        console.error('Failed to load reference data', err);
      }
    }
    loadReferenceData();
  }, []);

  /* ---- Fetch time logs ---- */
  const fetchTimeLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (clientId) params.set('client_id', clientId);
      if (taskId) params.set('task_id', taskId);

      const qs = params.toString();
      const url = `/time-logs/${qs ? `?${qs}` : ''}`;
      const res = await apiClient.get<{ success: boolean; data: TimeLog[] }>(url);
      if (res.success) setTimeLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch time logs', err);
    } finally {
      setLoading(false);
    }
  };

  /* ---- Initial fetch ---- */
  useEffect(() => {
    fetchTimeLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Apply partner group filter client-side ---- */
  const filteredLogs = useMemo(() => {
    if (!partnerGroup) return timeLogs;
    return timeLogs.filter(
      (log) => clientGroupMap.get(log.client_id) === partnerGroup,
    );
  }, [timeLogs, partnerGroup, clientGroupMap]);

  /* ---- Summary stats ---- */
  const stats = useMemo(() => {
    const totalEntries = filteredLogs.length;
    const totalMinutes = filteredLogs.reduce((sum, l) => sum + l.duration_minutes, 0);
    const billableMinutes = filteredLogs
      .filter((l) => l.task_id !== null)
      .reduce((sum, l) => sum + l.duration_minutes, 0);
    const nonBillableMinutes = totalMinutes - billableMinutes;
    return {
      totalEntries,
      totalHours: (totalMinutes / 60).toFixed(1),
      billableHours: (billableMinutes / 60).toFixed(1),
      nonBillableHours: (nonBillableMinutes / 60).toFixed(1),
    };
  }, [filteredLogs]);

  /* ---- Handle apply ---- */
  const handleApply = () => {
    fetchTimeLogs();
  };

  /* ---- Reset task filter when client changes ---- */
  const handleClientChange = (value: string) => {
    setClientId(value);
    setTaskId('');
  };

  return (
    <div>
      {/* Page header */}
      <div className="animate-up">
        <h1 className="text-2xl font-bold text-heading">Time Logs</h1>
        <p className="text-body mt-1">
          View and filter recorded time entries across clients and date ranges.
        </p>
      </div>

      {/* Filter bar */}
      <div className="mt-6 animate-up" style={{ animationDelay: '100ms' }}>
        <Card padding="md">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="w-40">
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                label="Client"
                options={clientOptions}
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                label="Task"
                options={taskOptions}
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select
                label="Partner Group"
                options={PARTNER_GROUP_OPTIONS}
                value={partnerGroup}
                onChange={(e) => setPartnerGroup(e.target.value)}
              />
            </div>
            <Button onClick={handleApply}>Apply</Button>
          </div>
        </Card>
      </div>

      {/* Data table */}
      <div className="mt-6 animate-up" style={{ animationDelay: '200ms' }}>
        <Card padding="none">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-lg font-medium text-surface-600">
                No time entries found
              </p>
              <p className="mt-1 text-sm text-surface-400">
                Try adjusting your filters or log a new time entry.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Date</Table.HeaderCell>
                    <Table.HeaderCell>Client</Table.HeaderCell>
                    <Table.HeaderCell>Task</Table.HeaderCell>
                    <Table.HeaderCell>Description</Table.HeaderCell>
                    <Table.HeaderCell>Start</Table.HeaderCell>
                    <Table.HeaderCell>End</Table.HeaderCell>
                    <Table.HeaderCell>Duration</Table.HeaderCell>
                    <Table.HeaderCell>Billable</Table.HeaderCell>
                  </Table.Row>
                </Table.Head>
                <Table.Body striped>
                  {filteredLogs.map((log) => (
                    <Table.Row key={log.id}>
                      <Table.Cell className="whitespace-nowrap">
                        {formatDate(log.date)}
                      </Table.Cell>
                      <Table.Cell>
                        {clientMap.get(log.client_id) || log.client_id}
                      </Table.Cell>
                      <Table.Cell>
                        {log.task_id
                          ? taskMap.get(log.task_id) || log.task_id
                          : '\u2014'}
                      </Table.Cell>
                      <Table.Cell className="max-w-xs truncate">
                        {log.description}
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        {log.start_time}
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        {log.end_time}
                      </Table.Cell>
                      <Table.Cell className="whitespace-nowrap">
                        {formatDuration(log.duration_minutes)}
                      </Table.Cell>
                      <Table.Cell>
                        {log.task_id ? (
                          <Badge variant="success" dot>
                            Billable
                          </Badge>
                        ) : (
                          <Badge variant="default" dot>
                            Non-billable
                          </Badge>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>

              {/* Summary row */}
              <div className="border-t border-surface-200 px-4 py-3 flex flex-wrap gap-6 text-sm text-surface-600">
                <span>
                  <span className="font-medium text-surface-900">
                    {stats.totalEntries}
                  </span>{' '}
                  entries
                </span>
                <span>
                  <span className="font-medium text-surface-900">
                    {stats.totalHours}h
                  </span>{' '}
                  total
                </span>
                <span>
                  <span className="font-medium text-success-600">
                    {stats.billableHours}h
                  </span>{' '}
                  billable
                </span>
                <span>
                  <span className="font-medium text-surface-500">
                    {stats.nonBillableHours}h
                  </span>{' '}
                  non-billable
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
