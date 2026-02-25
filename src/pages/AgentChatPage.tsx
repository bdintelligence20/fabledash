import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Bot, User, ChevronDown, Plus } from 'lucide-react';
import { Button, Badge, Spinner } from '../components/ui';
import { apiClient } from '../lib/api';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AgentResponse {
  id: string;
  name: string;
  tier: 'ops_traffic' | 'client_based';
  status: 'active' | 'paused' | 'archived';
  model: string;
}

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

interface ConversationSingleResponse {
  success: boolean;
  data: ConversationResponse;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources: Array<{ title?: string; content?: string; document_id?: string }>;
  created_at: string;
}

interface MessageListResponse {
  success: boolean;
  data: ChatMessage[];
}

interface SendMessageResponse {
  success: boolean;
  data: {
    user_message: ChatMessage;
    assistant_message: ChatMessage;
  };
}

/* -------------------------------------------------------------------------- */
/*  SourcesCollapsible                                                         */
/* -------------------------------------------------------------------------- */

function SourcesCollapsible({
  sources,
}: {
  sources: Array<{ title?: string; content?: string; document_id?: string }>;
}) {
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
        {sources.length} source{sources.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {sources.map((src, i) => (
            <div
              key={i}
              className="rounded-md bg-surface-50 px-3 py-2 text-xs text-surface-600"
            >
              {src.title && <p className="font-medium">{src.title}</p>}
              {src.content && (
                <p className="mt-0.5 line-clamp-3">{src.content}</p>
              )}
            </div>
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
  const timestamp = new Date(message.created_at).toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-primary-100 text-primary-600'
            : 'bg-surface-100 text-surface-600'
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser ? 'bg-primary-100 text-primary-900' : 'bg-white border border-surface-200 text-surface-900'
        }`}
      >
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourcesCollapsible sources={message.sources} />
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
/*  TypingIndicator                                                            */
/* -------------------------------------------------------------------------- */

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-surface-100 text-surface-600 flex items-center justify-center">
        <Bot className="h-4 w-4" />
      </div>
      <div className="bg-white border border-surface-200 rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 bg-surface-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 bg-surface-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 bg-surface-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AgentChatPage                                                              */
/* -------------------------------------------------------------------------- */

export default function AgentChatPage() {
  const { agentId, conversationId } = useParams<{
    agentId: string;
    conversationId: string;
  }>();
  const navigate = useNavigate();

  // Data state
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [conversation, setConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  async function fetchData() {
    if (!agentId || !conversationId) return;

    setLoading(true);
    setError('');

    try {
      const [agentRes, convRes, msgsRes] = await Promise.all([
        apiClient.get<AgentSingleResponse>(`/agents/${agentId}`),
        apiClient.get<ConversationSingleResponse>(`/chats/${conversationId}`),
        apiClient.get<MessageListResponse>(`/chats/${conversationId}/messages`),
      ]);

      setAgent(agentRes.data);
      setConversation(convRes.data);
      setMessages(msgsRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [agentId, conversationId]);

  async function handleSend() {
    if (!conversationId || !inputValue.trim() || sending) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await apiClient.post<SendMessageResponse>(
        `/chats/${conversationId}/messages`,
        { content },
      );
      setMessages((prev) => [
        ...prev,
        res.data.user_message,
        res.data.assistant_message,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
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
  /*  Error state (hard)                                                     */
  /* ---------------------------------------------------------------------- */

  if (!agent || !conversation) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error || 'Conversation not found'}
        </div>
        <Link
          to={agentId ? `/agents/${agentId}` : '/agents'}
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          &larr; Back to Agent
        </Link>
      </div>
    );
  }

  /* ---------------------------------------------------------------------- */
  /*  Main render                                                            */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/agents/${agentId}`}
            className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-primary-600 transition-default shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary-500 shrink-0" />
              <h1 className="font-semibold text-surface-900 truncate">{agent.name}</h1>
              <Badge
                variant={agent.status === 'active' ? 'success' : 'default'}
                size="sm"
                dot
              >
                {agent.status}
              </Badge>
            </div>
            <p className="text-xs text-surface-500 truncate">
              {conversation.title || 'Untitled Conversation'}
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={handleNewConversation}
        >
          New Chat
        </Button>
      </div>

      {/* Error banner (soft) */}
      {error && (
        <div className="rounded-lg bg-danger-50 px-4 py-2 text-sm text-danger-700 mx-4 mt-2">
          {error}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-surface-50">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center py-16 text-surface-400">
            <Bot className="h-12 w-12 mb-3" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm mt-1">
              Send a message to begin chatting with {agent.name}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {sending && <TypingIndicator />}

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
            placeholder={`Message ${agent.name}...`}
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
