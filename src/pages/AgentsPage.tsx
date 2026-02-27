import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Bot,
  MessageSquare,
  Sun,
  AlertTriangle,
  Cpu,
  Users,
  Database,
  Calendar,
  Mail,
  HardDrive,
} from 'lucide-react';
import { Button, Card, Input, Select, Badge, Modal, Spinner } from '../components/ui';
import type { SelectOption } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type DataSource = 'firestore' | 'calendar' | 'gmail' | 'drive';

interface AgentResponse {
  id: string;
  name: string;
  description: string | null;
  tier: 'ops_traffic' | 'client_based';
  status: 'active' | 'paused' | 'archived';
  client_id: string | null;
  client_name: string | null;
  model: string;
  system_prompt: string | null;
  capabilities: string[];
  document_ids: string[];
  data_sources: DataSource[];
  conversation_count: number;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface AgentListResponse {
  success: boolean;
  data: AgentResponse[];
}

interface AgentSingleResponse {
  success: boolean;
  data: AgentResponse;
}

interface ClientOption {
  id: string;
  name: string;
}

interface ClientListResponse {
  success: boolean;
  data: ClientOption[];
}

interface AlertItem {
  type: string;
  message: string;
  severity: string;
}

interface AlertsResponse {
  success: boolean;
  data: AlertItem[];
}

interface DailySummaryResponse {
  success: boolean;
  data: { summary: string };
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const STATUS_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  paused: 'warning',
  archived: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
};

const TIER_LABELS: Record<string, string> = {
  ops_traffic: 'Tier 1 - Ops',
  client_based: 'Tier 2 - Client',
};

const TIER_BADGE_VARIANT: Record<string, 'primary' | 'default'> = {
  ops_traffic: 'primary',
  client_based: 'default',
};

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku' },
];

const TIER_OPTIONS: SelectOption[] = [
  { value: 'ops_traffic', label: 'Tier 1 - Ops/Traffic' },
  { value: 'client_based', label: 'Tier 2 - Client-Based' },
];

const MODEL_LABELS: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'claude-sonnet-4-6': 'Claude Sonnet',
  'claude-haiku-4-5': 'Claude Haiku',
};

/* -------------------------------------------------------------------------- */
/*  AgentCard                                                                  */
/* -------------------------------------------------------------------------- */

function AgentCard({ agent, onClick }: { agent: AgentResponse; onClick: () => void }) {
  return (
    <Card hover onClick={onClick} className="cursor-pointer">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary-500 shrink-0" />
            <h3 className="font-semibold text-surface-900 truncate">{agent.name}</h3>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[agent.status] ?? 'default'} dot>
            {STATUS_LABELS[agent.status] ?? agent.status}
          </Badge>
        </div>

        {agent.description && (
          <p className="text-sm text-surface-500 line-clamp-2">{agent.description}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={TIER_BADGE_VARIANT[agent.tier] ?? 'default'} size="sm">
            {TIER_LABELS[agent.tier] ?? agent.tier}
          </Badge>
          <Badge variant="default" size="sm">
            {MODEL_LABELS[agent.model] ?? agent.model}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-sm text-surface-500">
          {agent.tier === 'client_based' && agent.client_name && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {agent.client_name}
            </span>
          )}
          {agent.tier !== 'client_based' && <span />}
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {agent.conversation_count} conversation{agent.conversation_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  CreateAgentModal                                                           */
/* -------------------------------------------------------------------------- */

const DATA_SOURCE_OPTIONS: { value: DataSource; label: string; icon: typeof Database }[] = [
  { value: 'firestore', label: 'Firestore', icon: Database },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'gmail', label: 'Gmail', icon: Mail },
  { value: 'drive', label: 'Drive', icon: HardDrive },
];

interface CreateFormState {
  name: string;
  description: string;
  tier: string;
  client_id: string;
  model: string;
  system_prompt: string;
  data_sources: DataSource[];
}

const emptyForm: CreateFormState = {
  name: '',
  description: '',
  tier: 'ops_traffic',
  client_id: '',
  model: 'gpt-4o-mini',
  system_prompt: '',
  data_sources: ['firestore'],
};

function CreateAgentModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<CreateFormState>(emptyForm);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setError('');
    }
  }, [isOpen]);

  // Fetch clients when tier is client_based
  useEffect(() => {
    if (form.tier === 'client_based') {
      apiClient
        .get<ClientListResponse>('/clients')
        .then((res) => setClients(res.data))
        .catch(() => setClients([]));
    }
  }, [form.tier]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        tier: form.tier,
        model: form.model,
        system_prompt: form.system_prompt.trim() || null,
        data_sources: form.data_sources,
      };
      if (form.tier === 'client_based' && form.client_id) {
        body.client_id = form.client_id;
      }

      await apiClient.post<AgentSingleResponse>('/agents', body);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const clientOptions: SelectOption[] = [
    { value: '', label: 'Select a client...' },
    ...clients.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Agent" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        )}

        <Input
          label="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Agent name"
          required
        />

        <div className="w-full">
          <label htmlFor="agent-description" className="block text-label mb-1.5">
            Description
          </label>
          <textarea
            id="agent-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Brief description of the agent's purpose"
            rows={2}
            className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 transition-default"
          />
        </div>

        <Select
          label="Tier"
          value={form.tier}
          onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value, client_id: '' }))}
          options={TIER_OPTIONS}
        />

        {form.tier === 'client_based' && (
          <Select
            label="Client"
            value={form.client_id}
            onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
            options={clientOptions}
          />
        )}

        <Select
          label="Model"
          value={form.model}
          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          options={MODEL_OPTIONS}
        />

        <div className="w-full">
          <label className="block text-label mb-1.5">Data Sources</label>
          <div className="flex flex-wrap gap-2">
            {DATA_SOURCE_OPTIONS.map((ds) => {
              const Icon = ds.icon;
              const checked = form.data_sources.includes(ds.value);
              return (
                <label
                  key={ds.value}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-default ${
                    checked
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => {
                      setForm((f) => ({
                        ...f,
                        data_sources: checked
                          ? f.data_sources.filter((s) => s !== ds.value)
                          : [...f.data_sources, ds.value],
                      }));
                    }}
                  />
                  <Icon className="h-3.5 w-3.5" />
                  {ds.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="w-full">
          <label htmlFor="system-prompt" className="block text-label mb-1.5">
            System Prompt
          </label>
          <textarea
            id="system-prompt"
            value={form.system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            placeholder="Custom instructions for the AI agent..."
            rows={4}
            className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 transition-default"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Create Agent
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  OpsPanel                                                                   */
/* -------------------------------------------------------------------------- */

function OpsPanel() {
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [error, setError] = useState('');

  async function fetchDailySummary() {
    setSummaryLoading(true);
    setError('');
    try {
      const res = await apiClient.get<DailySummaryResponse>('/agents/ops/daily-summary');
      setSummary(res.data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily summary');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchAlerts() {
    setAlertsLoading(true);
    setError('');
    try {
      const res = await apiClient.get<AlertsResponse>('/agents/ops/alerts');
      setAlerts(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setAlertsLoading(false);
    }
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary-500" />
            Ops Command Center
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Sun className="h-3.5 w-3.5" />}
              onClick={fetchDailySummary}
              loading={summaryLoading}
            >
              Daily Summary
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              onClick={fetchAlerts}
              loading={alertsLoading}
            >
              Check Alerts
              {alerts && alerts.length > 0 && (
                <Badge variant="danger" size="sm" className="ml-1">
                  {alerts.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        )}

        {summary && (
          <div className="rounded-lg bg-primary-50 px-4 py-3">
            <p className="text-sm font-medium text-primary-700 mb-1">Daily Summary</p>
            <p className="text-sm text-primary-600 whitespace-pre-wrap">{summary}</p>
          </div>
        )}

        {alerts && alerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-surface-700">Alerts ({alerts.length})</p>
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`rounded-lg px-4 py-3 text-sm ${
                  alert.severity === 'high'
                    ? 'bg-danger-50 text-danger-700'
                    : alert.severity === 'medium'
                      ? 'bg-warning-50 text-warning-700'
                      : 'bg-surface-50 text-surface-700'
                }`}
              >
                <span className="font-medium">{alert.type}:</span> {alert.message}
              </div>
            ))}
          </div>
        )}

        {alerts && alerts.length === 0 && (
          <div className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
            No active alerts. All systems normal.
          </div>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  AgentsPage                                                                 */
/* -------------------------------------------------------------------------- */

export default function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function fetchAgents() {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<AgentListResponse>('/agents');
      setAgents(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  const opsAgents = agents.filter((a) => a.tier === 'ops_traffic');
  const clientAgents = agents.filter((a) => a.tier === 'client_based');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900">AI Agents</h1>
        <Button
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setModalOpen(true)}
        >
          Create Agent
        </Button>
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

      {!loading && (
        <>
          {/* Ops Command Center */}
          <OpsPanel />

          {/* Tier 1: Ops/Traffic Agents */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-surface-900">Ops / Traffic Agents</h2>
              <Badge variant="primary" size="sm">Tier 1</Badge>
              <Badge variant="default" size="sm">{opsAgents.length}</Badge>
            </div>

            {opsAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                <Cpu className="h-8 w-8 mb-2" />
                <p className="text-sm">No Ops/Traffic agents configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {opsAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Tier 2: Client-Based Agents */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-surface-900">Client-Based Agents</h2>
              <Badge variant="default" size="sm">Tier 2</Badge>
              <Badge variant="default" size="sm">{clientAgents.length}</Badge>
            </div>

            {clientAgents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-surface-400">
                <Users className="h-8 w-8 mb-2" />
                <p className="text-sm">No client-based agents configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Agent modal */}
      <CreateAgentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchAgents}
      />
    </div>
  );
}
