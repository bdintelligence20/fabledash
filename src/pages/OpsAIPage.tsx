import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Send,
  User,
  ChevronDown,
  Database,
  Trash2,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  Calendar,
  Mail,
  Bot,
} from 'lucide-react';
import { Button, Badge, Spinner, Prose } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface OpsAIStatus {
  configured: boolean;
  ai_provider?: string;
  data_sources?: string[];
  available_tools?: string[];
}

interface AskResponse {
  success: boolean;
  data: {
    answer: string;
    sources: string[];
    tools_used: string[];
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  tools_used?: string[];
  timestamp: Date;
}

/* -------------------------------------------------------------------------- */
/*  Tool label helpers                                                         */
/* -------------------------------------------------------------------------- */

const TOOL_ICON_MAP: Record<string, React.ReactNode> = {
  get_utilization: <Clock className="h-3 w-3" />,
  get_revenue: <TrendingUp className="h-3 w-3" />,
  get_client_info: <Users className="h-3 w-3" />,
  get_top_clients: <Users className="h-3 w-3" />,
  get_cash_position: <DollarSign className="h-3 w-3" />,
  get_pnl_data: <DollarSign className="h-3 w-3" />,
  get_revenue_forecast: <TrendingUp className="h-3 w-3" />,
  get_recent_meetings: <Calendar className="h-3 w-3" />,
  get_upcoming_calendar_events: <Calendar className="h-3 w-3" />,
  get_email_stats: <Mail className="h-3 w-3" />,
  get_client_emails: <Mail className="h-3 w-3" />,
  get_overdue_tasks: <Clock className="h-3 w-3" />,
  get_task_overview: <Clock className="h-3 w-3" />,
  get_agent_status: <Bot className="h-3 w-3" />,
  get_drive_files: <Database className="h-3 w-3" />,
  get_client_drive_files: <Database className="h-3 w-3" />,
  search_documents: <Database className="h-3 w-3" />,
  get_partner_group_allocation: <Users className="h-3 w-3" />,
};

function toolLabel(tool: string): string {
  return tool
    .replace(/^get_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* -------------------------------------------------------------------------- */
/*  ToolsUsed chips                                                            */
/* -------------------------------------------------------------------------- */

function ToolsUsed({ tools }: { tools: string[] }) {
  if (!tools || tools.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-surface-100 flex flex-wrap gap-1.5">
      {tools.map((tool) => (
        <span
          key={tool}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 text-xs font-medium border border-primary-100"
        >
          {TOOL_ICON_MAP[tool] ?? <Database className="h-3 w-3" />}
          {toolLabel(tool)}
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SourcesBadges                                                              */
/* -------------------------------------------------------------------------- */

function SourcesBadges({ sources }: { sources: string[] }) {
  const [open, setOpen] = useState(false);
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-surface-400 hover:text-surface-600 transition-default"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        {sources.length} data source{sources.length !== 1 ? 's' : ''} used
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {sources.map((src, i) => (
            <Badge key={i} variant="default" size="sm">
              {src}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  MessageBubble                                                              */
/* -------------------------------------------------------------------------- */

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const timestamp = message.timestamp.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex gap-3 flex-row-reverse">
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
          <User className="h-4 w-4" />
        </div>
        <div className="max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-3 bg-primary-600 text-white">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <p className="text-xs mt-1.5 text-primary-200">{timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="max-w-[78%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-surface-200 shadow-soft">
        <Prose content={message.content} />
        {message.tools_used && message.tools_used.length > 0 && (
          <ToolsUsed tools={message.tools_used} />
        )}
        {message.sources && message.sources.length > 0 && (
          <SourcesBadges sources={message.sources} />
        )}
        <p className="text-xs mt-2 text-surface-400">{timestamp}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ThinkingIndicator                                                          */
/* -------------------------------------------------------------------------- */

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="bg-white border border-surface-200 shadow-soft rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1">
            <span className="h-2 w-2 bg-accent-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 bg-accent-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 bg-accent-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-xs text-surface-500">Querying data sources…</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Suggested question categories                                              */
/* -------------------------------------------------------------------------- */

const SUGGESTED_CATEGORIES = [
  {
    icon: <DollarSign className="h-3.5 w-3.5" />,
    label: 'Finances',
    color: 'text-success-700',
    bg: 'bg-success-50 border-success-200',
    questions: [
      "What's our revenue this month?",
      "Show me cash position",
      "How does our P&L look?",
      "What's the revenue forecast?",
    ],
  },
  {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: 'Operations',
    color: 'text-primary-600',
    bg: 'bg-primary-50 border-primary-200',
    questions: [
      "What's our team utilization?",
      "Which tasks are overdue?",
      "Show me full task overview",
      "What's our time allocation by partner group?",
    ],
  },
  {
    icon: <Users className="h-3.5 w-3.5" />,
    label: 'Clients',
    color: 'text-accent-700',
    bg: 'bg-accent-50 border-accent-200',
    questions: [
      "Which clients generate the most revenue?",
      "Top 5 clients by hours this month",
      "Which clients are over-serviced?",
      "What's our accounts receivable status?",
    ],
  },
];

/* -------------------------------------------------------------------------- */
/*  OpsAIPage                                                                  */
/* -------------------------------------------------------------------------- */

let nextMsgId = 1;
function genId() { return `msg-${nextMsgId++}`; }

export default function OpsAIPage() {
  const [status, setStatus] = useState<OpsAIStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, sending, scrollToBottom]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<{ success: boolean; data: OpsAIStatus }>('/opsai/status');
        setStatus(res.data);
      } catch {
        setStatus({ configured: false });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return;

    setMessages((prev) => [...prev, {
      id: genId(), role: 'user', content: content.trim(), timestamp: new Date(),
    }]);
    setInputValue('');
    setSending(true);
    setError('');

    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const res = await apiClient.post<AskResponse>('/opsai/ask', { question: content.trim() });
      setMessages((prev) => [...prev, {
        id: genId(),
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        tools_used: res.data.tools_used,
        timestamp: new Date(),
      }]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get response';
      setError(errMsg);
      setMessages((prev) => [...prev, {
        id: genId(), role: 'assistant',
        content: `I couldn't process that request. ${errMsg}`,
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputValue); }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center shadow-soft">
            <Sparkles className="h-[18px] w-[18px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-surface-900 text-base">OpsAI</h1>
              <Badge variant={status?.configured ? 'success' : 'warning'} size="sm" dot>
                {status?.configured ? 'Online' : 'Not configured'}
              </Badge>
            </div>
            <p className="text-xs text-surface-500">
              {status?.data_sources
                ? `${status.data_sources.length} sources · ${status.available_tools?.length ?? 0} tools available`
                : 'Business intelligence assistant'}
            </p>
          </div>
        </div>

        {hasMessages && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-danger-600 transition-default px-3 py-1.5 rounded-lg hover:bg-danger-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-danger-50 border border-danger-100 px-4 py-2 text-sm text-danger-700 mx-4 mt-2">
          {error}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 bg-surface-50">
        {/* Empty state with categorised suggestions */}
        {!hasMessages && !sending && (
          <div className="flex flex-col items-center py-6 max-w-2xl mx-auto w-full">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent-100 to-accent-200 text-accent-600 flex items-center justify-center mb-5">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-surface-900">Ask OpsAI</h2>
            <p className="text-sm text-surface-500 mt-1.5 text-center max-w-sm">
              Get data-backed answers about your business. OpsAI queries live data
              across all connected sources.
            </p>

            <div className="mt-7 w-full space-y-5">
              {SUGGESTED_CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <div className={`inline-flex items-center gap-1.5 ${cat.color} border ${cat.bg} px-2.5 py-1 rounded-full text-xs font-semibold mb-2.5`}>
                    {cat.icon}
                    {cat.label}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.questions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className="text-left rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-surface-700 hover:bg-surface-50 hover:border-primary-300 hover:text-primary-700 transition-default shadow-soft"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {sending && <ThinkingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-surface-200 bg-white px-4 py-3 shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your business…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 focus:bg-white transition-default"
          />
          <Button
            variant="primary"
            size="md"
            icon={<Send className="h-4 w-4" />}
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || sending}
            className="shrink-0 rounded-xl"
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-surface-400 text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
