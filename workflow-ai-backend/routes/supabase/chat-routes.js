// Chat routes for Supabase
const express = require('express');
const { OpenAI } = require('openai');
const router = express.Router();

// Import the Supabase client
const supabase = require('../../supabase');

// Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
});

// Helper function to calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Create a new chat
router.post('/chats/create', async (req, res) => {
  try {
    const { agent_id } = req.body;
    
    if (!agent_id) {
      return res.status(400).json({ success: false, message: "Agent ID is required" });
    }
    
    // Verify agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agent_id)
      .single();
    
    if (agentError) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    
    const { data, error } = await supabase
      .from('chats')
      .insert([
        { agent_id }
      ])
      .select();
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      chat: {
        id: data[0].id,
        agent_id: data[0].agent_id,
        created_at: data[0].created_at
      }
    });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ success: false, message: "Failed to create chat" });
  }
});

// Get chat details
router.get('/chats/details', async (req, res) => {
  try {
    const { chat_id } = req.query;
    
    if (!chat_id) {
      return res.status(400).json({ success: false, message: "Chat ID is required" });
    }
    
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .single();
    
    if (error) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    
    res.json({
      success: true,
      chat: {
        id: data.id,
        agent_id: data.agent_id,
        created_at: data.created_at
      }
    });
  } catch (error) {
    console.error("Error getting chat details:", error);
    res.status(500).json({ success: false, message: "Failed to get chat details" });
  }
});

// Send a message in a chat
router.post('/chats/message', async (req, res) => {
  try {
    const { chat_id, message } = req.body;
    
    if (!chat_id || !message) {
      return res.status(400).json({ success: false, message: "Chat ID and message are required" });
    }
    
    // Get chat details
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chat_id)
      .single();
    
    if (chatError) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }
    
    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', chat.agent_id)
      .single();
    
    if (agentError) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }
    
    // Store user message
    const { error: messageError } = await supabase
      .from('messages')
      .insert([
        { chat_id, role: 'user', content: message }
      ]);
    
    if (messageError) {
      throw messageError;
    }
    
    // Get chat history for better context
    const { data: chatHistory, error: historyError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: true })
      .limit(10);
    
    if (historyError) {
      throw historyError;
    }
    
    // Format previous messages for context
    const previousMessages = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Get embedding for the message
    let queryEmbedding;
    try {
      const queryEmbeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: message
      });
      
      queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    } catch (embeddingError) {
      console.error("Error generating query embedding:", embeddingError);
      throw new Error(`Failed to generate embedding: ${embeddingError.message}`);
    }
    
    // Get all chunks for this agent with better error handling
    let chunks = [];
    try {
      const { data, error } = await supabase
        .from('chunks')
        .select('*')
        .eq('agent_id', chat.agent_id);
      
      if (error) {
        throw error;
      }
      
      chunks = data || [];
      
      if (chunks.length === 0) {
        // No chunks found, might be because no documents have been uploaded
        console.warn(`No chunks found for agent ${chat.agent_id}. The agent may not have any documents.`);
      }
    } catch (chunksError) {
      console.error("Error fetching chunks:", chunksError);
      throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
    }
    
    // Calculate similarity and find the most relevant chunks
    const scoredChunks = chunks.map(chunk => {
      try {
        // Handle both string and array embedding formats
        let embedding;
        if (typeof chunk.embedding === 'string') {
          embedding = JSON.parse(chunk.embedding);
        } else {
          embedding = chunk.embedding;
        }
        
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return {
          ...chunk,
          similarity
        };
      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        // Return with very low similarity so it's not selected
        return {
          ...chunk,
          similarity: -1
        };
      }
    });
    
    // Sort by similarity and take top 10
    const topChunks = scoredChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
    
    // Build context from top chunks with source information
    let context = "";
    if (topChunks && topChunks.length > 0) {
      context = topChunks.map((chunk, index) => 
        `[Document ${index + 1}] ${chunk.content}\nSource: ${chunk.source} (Relevance: ${(chunk.similarity * 100).toFixed(1)}%)`
      ).join("\n\n");
    }
    
    // Build conversation messages including system prompt and previous messages
    const conversationMessages = [
      {
        role: "system",
        content: `You are ${agent.name}, an intelligent AI assistant specialized in providing accurate information based on provided documents. ${agent.description || ""}
        
Your task is to give helpful, accurate, and thoughtful answers based ONLY on the context provided below. If you're unsure or the answer isn't contained in the provided context, be honest and say "I don't have enough information about that in my knowledge base." Don't make up information that isn't supported by the documents.

When referring to information, cite the source (Document number) when possible.

Here is the relevant information from the knowledge base:
${context}

Remember: Be concise yet thorough. Prioritize accuracy over speculation. Structure complex answers with headings and bullet points when helpful.`
      }
    ];
    
    // Add previous messages for conversation context (up to last 6 messages)
    const recentMessages = previousMessages.slice(-6);
    conversationMessages.push(...recentMessages);
    
    // Generate AI response with the specified model and parameters
    const completion = await openai.chat.completions.create({
      model: "o3-mini-2025-01-31",
      messages: conversationMessages,
      response_format: {
        "type": "text"
      },
      reasoning_effort: "medium"
    });
    
    const aiResponse = completion.choices[0].message.content;
    
    // Store AI response
    const { error: responseError } = await supabase
      .from('messages')
      .insert([
        { chat_id, role: 'assistant', content: aiResponse }
      ]);
    
    if (responseError) {
      throw responseError;
    }
    
    // Get all messages for this chat
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: true });
    
    if (messagesError) {
      throw messagesError;
    }
    
    res.json({
      success: true,
      message: aiResponse,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
      }))
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ success: false, message: "Failed to send message: " + error.message });
  }
});

// Get chat history
router.get('/chats/history', async (req, res) => {
  try {
    const { chat_id } = req.query;
    
    if (!chat_id) {
      return res.status(400).json({ success: false, message: "Chat ID is required" });
    }
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat_id)
      .order('created_at', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      messages: data.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
      }))
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    res.status(500).json({ success: false, message: "Failed to get chat history" });
  }
});

module.exports = router;
