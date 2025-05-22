const express = require('express');
const router = express.Router();
const supabase = require('../../supabase');
const { OpenAI } = require('openai');
const documentProcessor = require('./document-processor');

// Initialize OpenAI client (with fallback for testing)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

// Helper function to handle API errors gracefully
const safeApiCall = async (apiCall, fallbackMessage) => {
  try {
    return await apiCall();
  } catch (error) {
    console.error('API call error:', error);
    return { 
      choices: [{ 
        message: { 
          content: fallbackMessage || 'I encountered an error processing your request. Please try again later.' 
        } 
      }] 
    };
  }
};

// Create a new chat
router.post('/', async (req, res) => {
  try {
    const { agent_id, title, parent_chat_id } = req.body;
    
    if (!agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID is required'
      });
    }
    
    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();
    
    if (agentError || !agent) {
      console.error('Error fetching agent:', agentError);
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    // If parent_chat_id is provided, verify it exists
    if (parent_chat_id) {
      const { data: parentChat, error: parentChatError } = await supabase
        .from('chats')
        .select('id')
        .eq('id', parent_chat_id)
        .single();
      
      if (parentChatError || !parentChat) {
        console.error('Error fetching parent chat:', parentChatError);
        return res.status(404).json({
          success: false,
          message: 'Parent chat not found'
        });
      }
    }
    
    // Create chat in database
    const { data, error } = await supabase
      .from('chats')
      .insert({
        agent_id,
        title: title || `Chat with ${agent.name}`,
        parent_chat_id: parent_chat_id || null,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating chat:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create chat',
        error: error.message
      });
    }
    
    // Add system message to initialize the chat
    const systemMessage = {
      chat_id: data.id,
      role: 'system',
      content: `You are an AI assistant named ${agent.name}. ${agent.description || ''}`,
    };
    
    const { error: messageError } = await supabase
      .from('messages')
      .insert(systemMessage);
    
    if (messageError) {
      console.error('Error creating system message:', messageError);
      // Continue anyway, not critical
    }
    
    return res.json({
      success: true,
      chat: data
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating chat'
    });
  }
});

// Get all chats for an agent
router.get('/agent/:agentId', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching chats:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch chats',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      chats: data
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching chats'
    });
  }
});

// Get chat by ID with messages
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', id)
      .single();
    
    if (chatError || !chat) {
      console.error('Error fetching chat:', chatError);
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }
    
    // Get messages for this chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', id)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch messages',
        error: messagesError.message
      });
    }
    
    return res.json({
      success: true,
      chat,
      messages: messages || []
    });
  } catch (error) {
    console.error('Error fetching chat with messages:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching chat with messages'
    });
  }
});

// Send a message in a chat
router.post('/:id/message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }
    
    const chat_id = id;
    
    // Get chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*, agents(*)')
      .eq('id', chat_id)
      .single();
    
    if (chatError || !chat) {
      console.error('Error fetching chat:', chatError);
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }
    
    // Get previous messages for context
    const { data: previousMessages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      console.error('Error fetching previous messages:', messagesError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch previous messages',
        error: messagesError.message
      });
    }
    
    // Add user message to database
    const userMessage = {
      chat_id,
      role: 'user',
      content: message,
    };
    
    const { data: savedUserMessage, error: userMessageError } = await supabase
      .from('messages')
      .insert(userMessage)
      .select()
      .single();
    
    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save user message',
        error: userMessageError.message
      });
    }
    
    // Prepare messages for OpenAI API
    const openaiMessages = previousMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Add the new user message
    openaiMessages.push({
      role: 'user',
      content: message
    });
    
    // Determine if this is a child agent and if we should include parent documents
    let includeParentDocs = false;
    let includeChildAgentContext = false;
    
    if (chat.agents) {
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('parent_id, is_parent')
        .eq('id', chat.agents.id)
        .single();
      
      if (!agentError && agent) {
        if (agent.parent_id) {
          // This is a child agent, so we'll include parent documents
          includeParentDocs = true;
        }
        
        if (agent.is_parent) {
          // This is a parent agent, so we'll include context from child agents
          includeChildAgentContext = true;
        }
      }
    }
    
    console.log(`Processing message: "${message}" for chat ${chat_id} with agent ${chat.agents.id}`);
    
    // Retrieve relevant chunks for the query
    console.log(`Retrieving relevant chunks for query: "${message}"`);
    const relevantChunks = await documentProcessor.retrieveRelevantChunks(
      chat.agents.id,
      message,
      5, // Limit to 5 most relevant chunks
      includeParentDocs, // Include parent documents if this is a child agent
      includeChildAgentContext // Include child agent context if this is a parent agent
    );
    
    console.log(`Retrieved ${relevantChunks.length} relevant chunks`);
    
    // Format chunks as context
    const documentContext = documentProcessor.formatChunksAsContext(relevantChunks);
    
    // If we have relevant chunks, add them to the context
    if (documentContext) {
      console.log('Adding document context to the prompt');
      
      // Find the system message
      const systemMessageIndex = openaiMessages.findIndex(msg => msg.role === 'system');
      
      if (systemMessageIndex !== -1) {
        // Add document context to system message
        console.log('Adding document context to existing system message');
        openaiMessages[systemMessageIndex].content += '\n\n' + documentContext;
      } else {
        // If no system message exists, add one with the document context
        console.log('Creating new system message with document context');
        openaiMessages.unshift({
          role: 'system',
          content: `You are an AI assistant. ${documentContext}`
        });
      }
    } else {
      console.log('No document context to add to the prompt');
    }
    
    // Use the safeApiCall helper to handle API errors gracefully
    const completion = await safeApiCall(
      async () => {
        return await openai.chat.completions.create({
          model: "gpt-4o",
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 4000,
        });
      },
      "I'm having trouble connecting to my knowledge base right now. Please try again later or ask a different question."
    );
    
    // Get assistant response
    const assistantResponse = completion.choices[0].message.content;
    
    // Save assistant response to database
    const assistantMessage = {
      chat_id,
      role: 'assistant',
      content: assistantResponse,
    };
    
    const { error: assistantMessageError } = await supabase
      .from('messages')
      .insert(assistantMessage);
    
    if (assistantMessageError) {
      console.error('Error saving assistant message:', assistantMessageError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save assistant message',
        error: assistantMessageError.message
      });
    }
    
    // Get all messages for this chat
    const { data: allMessages, error: allMessagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: true });
    
    if (allMessagesError) {
      console.error('Error fetching all messages:', allMessagesError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch all messages',
        error: allMessagesError.message
      });
    }
    
    return res.json({
      success: true,
      messages: allMessages
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    try {
      // Make sure chat_id is defined in this scope
      const chat_id = id;
      
      // Save error message to database
      const errorMessage = {
        chat_id,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again later.',
      };
      
      await supabase.from('messages').insert(errorMessage);
    } catch (dbError) {
      console.error('Error saving error message to database:', dbError);
    }
    
    return res.status(500).json({
      success: false,
      message: 'Server error while sending message',
      error: error.message
    });
  }
});

// Get linked chats (parent and child chats)
router.get('/:id/linked-chats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the chat
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*, agents(*)')
      .eq('id', id)
      .single();
    
    if (chatError || !chat) {
      console.error('Error fetching chat:', chatError);
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }
    
    // Get parent chat if this chat has a parent
    let parentChat = null;
    if (chat.parent_chat_id) {
      const { data: parent, error: parentError } = await supabase
        .from('chats')
        .select('*, agents(*)')
        .eq('id', chat.parent_chat_id)
        .single();
      
      if (!parentError && parent) {
        parentChat = parent;
      }
    }
    
    // Get child chats
    const { data: childChats, error: childChatsError } = await supabase
      .from('chats')
      .select('*, agents(*)')
      .eq('parent_chat_id', id);
    
    if (childChatsError) {
      console.error('Error fetching child chats:', childChatsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch child chats',
        error: childChatsError.message
      });
    }
    
    return res.json({
      success: true,
      chat,
      parentChat,
      childChats: childChats || []
    });
  } catch (error) {
    console.error('Error fetching linked chats:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching linked chats'
    });
  }
});

// Get full chat history for an agent including child agent chats
router.get('/agent/:agentId/chat-history', async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Check if agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();
    
    if (agentError || !agent) {
      console.error('Error fetching agent:', agentError);
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }
    
    // Get all chats for this agent
    const { data: agentChats, error: agentChatsError } = await supabase
      .from('chats')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    
    if (agentChatsError) {
      console.error('Error fetching agent chats:', agentChatsError);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch agent chats',
        error: agentChatsError.message
      });
    }
    
    // If this is a parent agent, get all child agents
    let childAgentChats = [];
    if (agent.is_parent) {
      // Get all child agents
      const { data: childAgents, error: childAgentsError } = await supabase
        .from('agents')
        .select('id')
        .eq('parent_id', agentId);
      
      if (!childAgentsError && childAgents && childAgents.length > 0) {
        // Get chats for all child agents
        const childAgentIds = childAgents.map(a => a.id);
        
        const { data: childChats, error: childChatsError } = await supabase
          .from('chats')
          .select('*')
          .in('agent_id', childAgentIds)
          .order('created_at', { ascending: false });
        
        if (!childChatsError && childChats) {
          childAgentChats = childChats;
        }
      }
    }
    
    // If this is a child agent, get the parent agent's chats
    let parentAgentChats = [];
    if (agent.parent_id) {
      const { data: parentChats, error: parentChatsError } = await supabase
        .from('chats')
        .select('*')
        .eq('agent_id', agent.parent_id)
        .order('created_at', { ascending: false });
      
      if (!parentChatsError && parentChats) {
        parentAgentChats = parentChats;
      }
    }
    
    return res.json({
      success: true,
      agent,
      agentChats: agentChats || [],
      childAgentChats,
      parentAgentChats
    });
  } catch (error) {
    console.error('Error fetching agent chat history:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching agent chat history'
    });
  }
});

// Delete a chat
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete all messages in this chat first
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('chat_id', id);
    
    if (messagesError) {
      console.error('Error deleting messages:', messagesError);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete messages',
        error: messagesError.message
      });
    }
    
    // Delete the chat
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting chat:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete chat',
        error: error.message
      });
    }
    
    return res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting chat'
    });
  }
});

module.exports = router;
