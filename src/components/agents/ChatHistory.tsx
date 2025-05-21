import { useState, useEffect } from 'react';
import { MessageSquare, ChevronRight, ChevronDown } from 'lucide-react';
import { Agent, Chat } from './AgentTypes';
import { Button, Card } from '../ui';

interface ChatHistoryProps {
  agent: Agent;
  chats: Chat[];
  childAgentChats: Chat[];
  parentAgentChats: Chat[];
  isLoading: boolean;
  onSelectChat: (chat: Chat) => void;
  onCreateChat: (parentChatId?: number) => Promise<void>;
  currentChatId: number | null;
}

const ChatHistory = ({
  agent,
  chats,
  childAgentChats,
  parentAgentChats,
  isLoading,
  onSelectChat,
  onCreateChat,
  currentChatId,
}: ChatHistoryProps) => {
  const [showParentChats, setShowParentChats] = useState(false);
  const [showChildChats, setShowChildChats] = useState(false);

  // Format date to a readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-lg font-medium">Chat History</h2>
      </div>

      <div className="p-4 space-y-4">
        {/* Current Agent Chats */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-md font-medium">{agent.name}'s Chats</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateChat()}
              disabled={isLoading}
            >
              New Chat
            </Button>
          </div>
          {chats.length > 0 ? (
            <div className="space-y-2">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`p-3 rounded-lg cursor-pointer flex items-center ${
                    currentChatId === chat.id
                      ? 'bg-primary-100 border border-primary-300'
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                  }`}
                  onClick={() => onSelectChat(chat)}
                >
                  <MessageSquare className="h-5 w-5 text-gray-500 mr-3" />
                    <div className="flex-1">
                      <div className="font-medium">{chat.title || `Chat ${chat.id}`}</div>
                      <div className="text-xs text-gray-500">{formatDate(chat.created_at)}</div>
                    </div>
                    {agent.is_parent && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Pass only the chat ID, not the event object
                          const chatId = chat.id;
                          onCreateChat(chatId);
                        }}
                        disabled={isLoading}
                      >
                        Create Child Chat
                      </Button>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm italic">No chats yet</div>
          )}
        </div>

        {/* Parent Agent Chats (if this is a child agent) */}
        {agent.parent_id && parentAgentChats.length > 0 && (
          <div>
            <div
              className="flex items-center mb-2 cursor-pointer"
              onClick={() => setShowParentChats(!showParentChats)}
            >
              {showParentChats ? (
                <ChevronDown className="h-4 w-4 text-gray-500 mr-1" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500 mr-1" />
              )}
              <h3 className="text-md font-medium">Parent Agent Chats</h3>
            </div>

            {showParentChats && (
              <div className="space-y-2 pl-4">
                {parentAgentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="p-3 rounded-lg cursor-pointer flex items-center bg-blue-50 hover:bg-blue-100 border border-blue-200"
                    onClick={() => onSelectChat(chat)}
                  >
                    <MessageSquare className="h-5 w-5 text-blue-500 mr-3" />
                    <div className="flex-1">
                      <div className="font-medium">{chat.title || `Chat ${chat.id}`}</div>
                      <div className="text-xs text-gray-500">{formatDate(chat.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Child Agent Chats (if this is a parent agent) */}
        {agent.is_parent && childAgentChats.length > 0 && (
          <div>
            <div
              className="flex items-center mb-2 cursor-pointer"
              onClick={() => setShowChildChats(!showChildChats)}
            >
              {showChildChats ? (
                <ChevronDown className="h-4 w-4 text-gray-500 mr-1" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500 mr-1" />
              )}
              <h3 className="text-md font-medium">Child Agent Chats</h3>
            </div>

            {showChildChats && (
              <div className="space-y-2 pl-4">
                {childAgentChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="p-3 rounded-lg cursor-pointer flex items-center bg-purple-50 hover:bg-purple-100 border border-purple-200"
                    onClick={() => onSelectChat(chat)}
                  >
                    <MessageSquare className="h-5 w-5 text-purple-500 mr-3" />
                    <div className="flex-1">
                      <div className="font-medium">{chat.title || `Chat ${chat.id}`}</div>
                      <div className="text-xs text-gray-500">{formatDate(chat.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;
