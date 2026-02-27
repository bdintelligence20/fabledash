import { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  MessageSquare,
  FileText,
  Activity,
  Upload,
  Trash2,
  Plus,
  Bot,
  Zap,
  BarChart2,
} from 'lucide-react';
import { Button, Card, Badge, Tabs, Spinner } from '../components/ui';
import type { Tab } from '../components/ui';
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

const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  firestore: 'Firestore',
  calendar: 'Calendar',
  gmail: 'Gmail',
  drive: 'Drive',
};

interface AgentSingleResponse {
  success: boolean;
  data: AgentResponse;
}

interface ConversationResponse {
  id: string;
  agent_id: string;
  agent_name: string | null;
  title: string | null;
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  created_by: string;
}

interface ConversationListResponse {
  success: boolean;
  data: ConversationResponse[];
}

interface ConversationSingleResponse {
  success: boolean;
  data: ConversationResponse;
}

interface DocumentResponse {
  id: string;
  filename: string;
  file_type: string | null;
  file_size: number;
  status: string;
  agent_id: string | null;
  client_id: string | null;
  chunk_count: number;
  error_message: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

interface DocumentListResponse {
  success: boolean;
  data: DocumentResponse[];
}

interface DocumentSingleResponse {
  success: boolean;
  data: DocumentResponse;
}

interface ExecuteResponse {
  success: boolean;
  data: { result: string };
}

interface ReportResponse {
  success: boolean;
  data: { report: string; report_type: string };
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

const MODEL_LABELS: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'claude-sonnet-4-6': 'Claude Sonnet',
  'claude-haiku-4-5': 'Claude Haiku',
};

/* -------------------------------------------------------------------------- */
/*  AgentDetailPage                                                            */
/* -------------------------------------------------------------------------- */

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  // Data state
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('conversations');
  const [statusLoading, setStatusLoading] = useState(false);

  // Activity state (Tier 2)
  const [taskDescription, setTaskDescription] = useState('');
  const [taskResult, setTaskResult] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchAgent() {
    if (!agentId) return;
    try {
      const res = await apiClient.get<AgentSingleResponse>(`/agents/${agentId}`);
      setAgent(res.data);
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load agent');
      }
    }
  }

  async function fetchConversations() {
    if (!agentId) return;
    try {
      const res = await apiClient.get<ConversationListResponse>(`/chats?agent_id=${agentId}`);
      setConversations(res.data);
    } catch {
      // Non-critical: conversations tab will show empty
    }
  }

  async function fetchDocuments() {
    if (!agentId) return;
    try {
      const res = await apiClient.get<DocumentListResponse>(`/documents?agent_id=${agentId}`);
      setDocuments(res.data);
    } catch {
      // Non-critical: documents tab will show empty
    }
  }

  async function fetchData() {
    setLoading(true);
    setError('');
    setNotFound(false);
    await Promise.all([fetchAgent(), fetchConversations(), fetchDocuments()]);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [agentId]);

  async function handleActivate() {
    if (!agentId) return;
    setStatusLoading(true);
    try {
      const res = await apiClient.post<AgentSingleResponse>(`/agents/${agentId}/activate`);
      setAgent(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate agent');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handlePause() {
    if (!agentId) return;
    setStatusLoading(true);
    try {
      const res = await apiClient.post<AgentSingleResponse>(`/agents/${agentId}/pause`);
      setAgent(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause agent');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleNewConversation() {
    if (!agentId) return;
    try {
      const res = await apiClient.post<ConversationSingleResponse>('/chats', {
        agent_id: agentId,
      });
      navigate(`/agents/${agentId}/chat/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !agentId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('agent_id', agentId);
      await apiClient.post<DocumentSingleResponse>(`/documents?agent_id=${agentId}`, formData);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteDocument(docId: string) {
    try {
      await apiClient.delete(`/documents/${docId}`);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  }

  async function handleExecuteTask() {
    if (!agentId || !taskDescription.trim()) return;
    setTaskLoading(true);
    setTaskResult(null);
    try {
      const res = await apiClient.post<ExecuteResponse>(`/agents/${agentId}/execute`, {
        task_description: taskDescription.trim(),
      });
      setTaskResult(res.data.result);
    } catch (err) {
      setTaskResult(`Error: ${err instanceof Error ? err.message : 'Failed to execute task'}`);
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleGenerateReport() {
    if (!agentId) return;
    setReportLoading(true);
    setReportResult(null);
    try {
      const res = await apiClient.post<ReportResponse>(`/agents/${agentId}/report`, {
        report_type: 'status',
      });
      setReportResult(res.data.report);
    } catch (err) {
      setReportResult(`Error: ${err instanceof Error ? err.message : 'Failed to generate report'}`);
    } finally {
      setReportLoading(false);
    }
  }

  // Tab definitions
  const tabs: Tab[] = [
    { id: 'conversations', label: `Conversations (${conversations.length})`, icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'documents', label: `Documents (${documents.length})`, icon: <FileText className="h-4 w-4" /> },
    ...(agent?.tier === 'client_based'
      ? [{ id: 'activity', label: 'Activity', icon: <Activity className="h-4 w-4" /> }]
      : []),
  ];

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
        <p className="text-lg font-medium">Agent not found</p>
        <Link to="/agents" className="mt-4 text-primary-600 hover:text-primary-700 hover:underline">
          &larr; Back to Agents
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Error state                                                            */
  /* ---------------------------------------------------------------------- */

  if (error && !agent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
        <Link to="/agents" className="text-primary-600 hover:text-primary-700 hover:underline">
          &larr; Back to Agents
        </Link>
      </div>
    );
  }

  if (!agent) return null;

  /* ---------------------------------------------------------------------- */
  /*  Main render                                                            */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-primary-600 transition-default"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Agents
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <Bot className="h-6 w-6 text-primary-500" />
          <h1 className="text-2xl font-bold text-surface-900">{agent.name}</h1>
          <Badge variant={TIER_BADGE_VARIANT[agent.tier] ?? 'default'}>
            {TIER_LABELS[agent.tier] ?? agent.tier}
          </Badge>
          <Badge variant={STATUS_BADGE_VARIANT[agent.status] ?? 'default'} dot>
            {STATUS_LABELS[agent.status] ?? agent.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {agent.status !== 'active' && (
            <Button
              variant="primary"
              size="sm"
              icon={<Play className="h-3.5 w-3.5" />}
              onClick={handleActivate}
              loading={statusLoading}
            >
              Activate
            </Button>
          )}
          {agent.status === 'active' && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Pause className="h-3.5 w-3.5" />}
              onClick={handlePause}
              loading={statusLoading}
            >
              Pause
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      {/* Config card */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-surface-500">Model</p>
            <p className="font-medium text-surface-900">
              {MODEL_LABELS[agent.model] ?? agent.model}
            </p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Conversations</p>
            <p className="font-medium text-surface-900">{agent.conversation_count}</p>
          </div>
          <div>
            <p className="text-sm text-surface-500">Documents</p>
            <p className="font-medium text-surface-900">{agent.document_ids.length}</p>
          </div>
          {agent.client_name && (
            <div>
              <p className="text-sm text-surface-500">Client</p>
              <p className="font-medium text-surface-900">{agent.client_name}</p>
            </div>
          )}
          {agent.data_sources && agent.data_sources.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-sm text-surface-500 mb-1">Data Sources</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.data_sources.map((ds) => (
                  <Badge key={ds} variant="primary" size="sm">
                    {DATA_SOURCE_LABELS[ds] ?? ds}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {agent.capabilities.length > 0 && (
            <div className="md:col-span-2">
              <p className="text-sm text-surface-500 mb-1">Capabilities</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.map((cap) => (
                  <Badge key={cap} variant="primary" size="sm">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {agent.system_prompt && (
            <div className="md:col-span-2">
              <p className="text-sm text-surface-500 mb-1">System Prompt</p>
              <div className="rounded-lg bg-surface-50 px-4 py-3 text-sm text-surface-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {agent.system_prompt}
              </div>
            </div>
          )}
          {agent.description && (
            <div className="md:col-span-2">
              <p className="text-sm text-surface-500 mb-1">Description</p>
              <p className="text-sm text-surface-700">{agent.description}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Tabbed content */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Conversations tab */}
      {activeTab === 'conversations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={handleNewConversation}
            >
              New Conversation
            </Button>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400">
              <MessageSquare className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No conversations yet</p>
              <p className="text-sm mt-1">Start a conversation with this agent</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <Card
                  key={conv.id}
                  hover
                  padding="sm"
                  className="cursor-pointer"
                  onClick={() => navigate(`/agents/${agentId}/chat/${conv.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-surface-900 truncate">
                        {conv.title || 'Untitled Conversation'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
                        <span>{conv.message_count} message{conv.message_count !== 1 ? 's' : ''}</span>
                        {conv.last_message_at && (
                          <span>
                            Last message{' '}
                            {new Date(conv.last_message_at).toLocaleDateString('en-ZA', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    <MessageSquare className="h-4 w-4 text-surface-400 shrink-0 ml-4" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept=".txt,.pdf,.md,.csv,.json,.doc,.docx"
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
            >
              Upload Document
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-surface-400">
              <FileText className="h-10 w-10 mb-3" />
              <p className="text-lg font-medium">No documents uploaded</p>
              <p className="text-sm mt-1">Upload documents to give this agent knowledge</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card key={doc.id} padding="sm">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-surface-900 truncate">{doc.filename}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
                        <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                        <span>{doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}</span>
                        <Badge
                          variant={doc.status === 'ready' ? 'success' : doc.status === 'processing' ? 'warning' : 'danger'}
                          size="sm"
                        >
                          {doc.status}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-danger-500 hover:text-danger-600 hover:bg-danger-50"
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity tab (Tier 2 only) */}
      {activeTab === 'activity' && agent.tier === 'client_based' && (
        <div className="space-y-6">
          {/* Execute Task */}
          <Card>
            <div className="space-y-3">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary-500" />
                Execute Task
              </h3>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Describe the task for the agent to execute..."
                rows={3}
                className="w-full rounded-lg border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 transition-default"
              />
              <Button
                variant="primary"
                size="sm"
                icon={<Zap className="h-3.5 w-3.5" />}
                onClick={handleExecuteTask}
                loading={taskLoading}
                disabled={!taskDescription.trim()}
              >
                Execute Task
              </Button>
              {taskResult && (
                <div className="rounded-lg bg-surface-50 px-4 py-3 text-sm text-surface-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {taskResult}
                </div>
              )}
            </div>
          </Card>

          {/* Generate Report */}
          <Card>
            <div className="space-y-3">
              <h3 className="font-semibold text-surface-900 flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary-500" />
                Generate Report
              </h3>
              <Button
                variant="primary"
                size="sm"
                icon={<BarChart2 className="h-3.5 w-3.5" />}
                onClick={handleGenerateReport}
                loading={reportLoading}
              >
                Generate Status Report
              </Button>
              {reportResult && (
                <div className="rounded-lg bg-surface-50 px-4 py-3 text-sm text-surface-700 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {reportResult}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
