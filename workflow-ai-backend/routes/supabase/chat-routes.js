const express = require('express');
const router = express.Router();
const { supabase } = require('../../supabase');
const { OpenAI } = require('openai');

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
router.post('/create', async (req, res) => {
  try {
    const { agent_id, title } = req.body;
    
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
    
    // Create chat in database
    const { data, error } = await supabase
      .from('chats')
      .insert({
        agent_id,
        title: title || `Chat with ${agent.name}`,
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
router.post('/message', async (req, res) => {
  try {
    const { chat_id, message } = req.body;
    
    if (!chat_id || !message) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and message are required'
      });
    }
    
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
    
    // Get agent documents for context if needed
    let documents = [];
    if (chat.agents && chat.agents.id) {
      const { data: agentDocs, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('agent_id', chat.agents.id);
      
      if (!docsError && agentDocs) {
        documents = agentDocs;
      }
    }
    
    // If there are documents, add their content to the system message
    if (documents.length > 0) {
      // Find the system message
      const systemMessageIndex = openaiMessages.findIndex(msg => msg.role === 'system');
      
      if (systemMessageIndex !== -1) {
        // Add document context to system message
        openaiMessages[systemMessageIndex].content += '\n\nYou have access to the following documents:';
        documents.forEach(doc => {
          openaiMessages[systemMessageIndex].content += `\n- ${doc.file_name}`;
        });
      }
    }
    
    // Use the safeApiCall helper to handle API errors gracefully
    const completion = await safeApiCall(
      async () => {
        return await openai.chat.completions.create({
          model: "gpt-4",
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: 1000,
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
