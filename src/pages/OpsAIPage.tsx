import { useState, useRef, useCallback, useEffect } from 'react';
import { Sparkles, Send, User, ChevronDown } from 'lucide-react';
import { Button, Badge, Spinner } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface OpsAIStatus {
  configured: boolean;
  model?: string;
}

interface StatusResponse {
  success: boolean;
  data: OpsAIStatus;
}

interface SuggestedQuestion {
  text: string;
  category?: string;
}

interface SuggestedQuestionsResponse {
  success: boolean;
  data: SuggestedQuestion[];
}

interface DataSource {
  name: string;
  type?: string;
}

interface AskResponse {
  success: boolean;
  data: {
    answer: string;
    sources: DataSource[];
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: DataSource[];
  timestamp: Date;
}

/* -------------------------------------------------------------------------- */
/*  SourcesBadges                                                              */
/* -------------------------------------------------------------------------- */

function SourcesBadges({ sources }: { sources: DataSource[] }) {
  const [open, setOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 transition-default"
      >
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
        {sources.length} data source{sources.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {sources.map((src, i) => (
            <Badge key={i} variant="default" size="sm">
              {src.name}
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

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-primary-100 text-primary-600'
            : 'bg-accent-100 text-accent-600'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary-100 text-primary-900'
            : 'bg-white border border-surface-200 text-surface-900'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesBadges sources={message.sources} />
        )}
        <p
          className={`text-xs mt-1.5 ${
            isUser ? 'text-primary-500' : 'text-surface-400'
          }`}
        >
          {timestamp}
        </p>
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
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="bg-white border border-surface-200 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <div className="flex gap-1">
            <span className="h-2 w-2 bg-accent-400 rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="h-2 w-2 bg-accent-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="h-2 w-2 bg-accent-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
          <span>Thinking...</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  OpsAIPage                                                                  */
/* -------------------------------------------------------------------------- */

let nextMsgId = 1;
function genId() {
  return `msg-${nextMsgId++}`;
}

export default function OpsAIPage() {
  // Data state
  const [status, setStatus] = useState<OpsAIStatus | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  /* -- Fetch initial data -------------------------------------------------- */

  useEffect(() => {
    async function fetchInitialData() {
      setLoading(true);
      try {
        const [statusRes, questionsRes] = await Promise.all([
          apiClient.get<StatusResponse>('/opsai/status'),
          apiClient.get<SuggestedQuestionsResponse>('/opsai/suggested-questions'),
        ]);
        setStatus(statusRes.data);
        setSuggestedQuestions(questionsRes.data);
      } catch (err) {
        // Non-blocking: show page even if status/questions fail
        setStatus({ configured: false });
        setSuggestedQuestions([
          { text: "What's our utilization this month?" },
          { text: 'Which clients are most profitable?' },
          { text: 'Show me cash position' },
          { text: 'Any overdue tasks?' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  /* -- Send message -------------------------------------------------------- */

  async function sendMessage(content: string) {
    if (!content.trim() || sending) return;

    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setSending(true);
    setError('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await apiClient.post<AskResponse>('/opsai/ask', {
        question: content.trim(),
      });

      const assistantMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to get response';
      setError(errMsg);

      // Add error as assistant message so user sees it in context
      const errorMsg: ChatMessage = {
        id: genId(),
        role: 'assistant',
        content: `Sorry, I couldn't process that request. ${errMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    sendMessage(inputValue);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleSuggestedClick(question: string) {
    sendMessage(question);
  }

  /* -- Loading state -------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  /* -- Main render --------------------------------------------------------- */

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-surface-900">OpsAI</h1>
              <Badge
                variant={status?.configured ? 'success' : 'warning'}
                size="sm"
                dot
              >
                {status?.configured ? 'Online' : 'Not configured'}
              </Badge>
            </div>
            <p className="text-xs text-surface-500">
              What would you like to know about your business?
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-2 text-sm text-danger-700 mx-4 mt-2">
          {error}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-surface-50">
        {/* Empty state with suggested questions */}
        {!hasMessages && !sending && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-accent-50 text-accent-500 flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-surface-900">
              Ask OpsAI anything
            </h2>
            <p className="text-sm text-surface-500 mt-1 text-center max-w-md">
              Get data-backed answers about your business performance, clients,
              finances, and team utilization.
            </p>

            {/* Suggested question cards */}
            {suggestedQuestions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-lg">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSuggestedClick(q.text)}
                    className="text-left rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-700 hover:bg-surface-50 hover:border-primary-300 hover:text-primary-700 transition-default"
                  >
                    {q.text}
                  </button>
                ))}
              </div>
            )}
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
            placeholder="Ask OpsAI anything..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-surface-200 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-focus focus:border-primary-500 focus:bg-white transition-default"
          />
          <Button
            variant="primary"
            size="md"
            icon={<Send className="h-4 w-4" />}
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            className="shrink-0 rounded-xl"
          >
            Send
          </Button>
        </div>
        <p className="text-xs text-surface-400 text-center mt-2">
          Press Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
