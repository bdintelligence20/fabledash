// api/chat-message.js - Serverless function for handling chat messages
const supabase = require('../supabase');
const { OpenAI } = require('openai');
const documentProcessor = require('../routes/supabase/document-processor');

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

// Main handler function
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }
  
  try {
    const { id } = req.query; // Get chat ID from query parameters
    const { message } = req.body;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required'
      });
    }
    
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
    
    return res.status(200).json({
      success: true,
      messages: allMessages
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    try {
      // Make sure chat_id is defined in this scope
      const chat_id = req.query.id;
      
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
};
