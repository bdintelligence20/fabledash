import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Paperclip, X } from 'lucide-react';
import { Agent, Chat, Message } from './AgentTypes';
import { Button, Card } from '../ui';

interface AgentChatProps {
  agent: Agent;
  currentChatId: number | null;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onCreateChat: () => Promise<void>;
}

const AgentChat = ({
  agent,
  currentChatId,
  messages,
  isLoading,
  onSendMessage,
  onCreateChat,
}: AgentChatProps) => {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom of messages when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isLoading) return;
    
    const message = messageInput;
    setMessageInput('');
    await onSendMessage(message);
  };
  
  // If no active chat, show empty state
  if (!currentChatId) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center h-[600px]">
        <div className="text-center">
          <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-700 mb-2">No Active Chat</h3>
          <p className="text-gray-500 mb-6">Start a new chat to interact with this agent</p>
          <Button
            onClick={onCreateChat}
            variant="primary"
            icon={<MessageSquare className="h-5 w-5" />}
            disabled={isLoading}
          >
            Start New Chat
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-[600px]">
      <div className="p-4 border-b">
        <h2 className="text-lg font-medium">Chat with {agent.name}</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length > 0 ? (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-3/4 rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Start a conversation with your AI agent</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Type your message..."
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon={<Send className="h-5 w-5" />}
            disabled={isLoading || !messageInput.trim()}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;
