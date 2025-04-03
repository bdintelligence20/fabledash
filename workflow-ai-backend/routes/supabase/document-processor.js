const { OpenAI } = require('openai');
const supabase = require('../../supabase');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const csv = require('csv-parser');
const mammoth = require('mammoth');
const { Readable } = require('stream');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-testing',
});

/**
 * Extract text from a document based on its type
 * @param {Buffer} buffer - The document buffer
 * @param {string} fileType - The MIME type of the document
 * @param {string} fileName - The name of the document
 * @returns {Promise<string>} - The extracted text
 */
async function extractTextFromDocument(buffer, fileType, fileName) {
  try {
    // Handle different file types
    if (fileType.includes('pdf')) {
      // PDF files
      const pdfData = await pdfParse({ data: buffer });
      return pdfData.text;
    } else if (fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
               fileName.endsWith('.docx')) {
      // DOCX files (Word 2007+)
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else if (fileType.includes('application/msword') || fileName.endsWith('.doc')) {
      // DOC files (Word 97-2003)
      // Note: mammoth has limited support for .doc files, but we'll try
      try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch (e) {
        console.error('Error extracting text from DOC file:', e);
        return 'Error: Could not extract text from this DOC file. Please convert it to DOCX format.';
      }
    } else if (fileType.includes('text/plain') || fileName.endsWith('.txt')) {
      // Plain text files
      return buffer.toString('utf-8');
    } else if (fileType.includes('csv') || fileName.endsWith('.csv')) {
      // CSV files
      let csvText = '';
      const results = [];
      
      // Parse CSV
      await new Promise((resolve, reject) => {
        const stream = Readable.from(buffer.toString('utf-8'));
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
      
      // Convert to text
      if (results.length > 0) {
        // Get headers
        const headers = Object.keys(results[0]);
        csvText += headers.join(', ') + '\n';
        
        // Get rows
        results.forEach(row => {
          csvText += headers.map(header => row[header]).join(', ') + '\n';
        });
      }
      
      return csvText;
    } else if (fileType.includes('application/json') || fileName.endsWith('.json')) {
      // JSON files
      try {
        const jsonData = JSON.parse(buffer.toString('utf-8'));
        return JSON.stringify(jsonData, null, 2);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        return buffer.toString('utf-8');
      }
    } else if (fileType.includes('text/html') || fileName.endsWith('.html') || fileName.endsWith('.htm')) {
      // HTML files - simple text extraction, not parsing HTML structure
      return buffer.toString('utf-8');
    } else if (fileType.includes('text/markdown') || fileName.endsWith('.md')) {
      // Markdown files
      return buffer.toString('utf-8');
    } else {
      // Default: try to extract as text
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error('Error extracting text from document:', error);
    return '';
  }
}

/**
 * Process a document by extracting text, chunking it, and generating embeddings
 * @param {Object} document - The document object from the database
 * @param {string} extractedText - The extracted text from the document
 * @returns {Promise<boolean>} - Whether the processing was successful
 */
async function processDocument(document, extractedText) {
  try {
    if (!extractedText || extractedText.trim() === '') {
      console.warn(`No text extracted from document ${document.id}`);
      return false;
    }

    // Update the document with the extracted text
    const { error: updateError } = await supabase
      .from('documents')
      .update({ extracted_text: extractedText })
      .eq('id', document.id);

    if (updateError) {
      console.error('Error updating document with extracted text:', updateError);
      return false;
    }

    // Chunk the text
    const chunks = chunkText(extractedText, 1000);
    
    // Generate embeddings and store chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding
      const embedding = await generateEmbedding(chunk);
      
      if (!embedding) {
        console.error(`Failed to generate embedding for chunk ${i} of document ${document.id}`);
        continue;
      }
      
      // Store chunk in database
      const { error: chunkError } = await supabase
        .from('chunks')
        .insert({
          document_id: document.id,
          agent_id: document.agent_id,
          content: chunk,
          source: `${document.file_name} (chunk ${i + 1}/${chunks.length})`,
          embedding: embedding
        });
      
      if (chunkError) {
        console.error(`Error storing chunk ${i} for document ${document.id}:`, chunkError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing document:', error);
    return false;
  }
}

/**
 * Chunk text into smaller pieces
 * @param {string} text - The text to chunk
 * @param {number} maxChunkSize - The maximum size of each chunk in characters
 * @returns {string[]} - Array of text chunks
 */
function chunkText(text, maxChunkSize = 1000) {
  // Split text into paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would exceed the max chunk size, start a new chunk
    if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    // Add paragraph to current chunk
    currentChunk += paragraph + '\n\n';
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Cosine similarity (between -1 and 1)
 */
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  // Calculate dot product
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  // Calculate magnitude/norm
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  // Calculate cosine similarity
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Generate an embedding for a text
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<number[]|null>} - The embedding vector or null if failed
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Retrieve relevant chunks for a query
 * @param {number} agentId - The ID of the agent
 * @param {string} query - The query text
 * @param {number} limit - The maximum number of chunks to retrieve
 * @param {boolean} includeParentDocs - Whether to include documents from the parent agent
 * @returns {Promise<Object[]>} - Array of relevant chunks with their documents
 */
async function retrieveRelevantChunks(agentId, query, limit = 5, includeParentDocs = false) {
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      console.error('Failed to generate embedding for query');
      return [];
    }
    
    // Get the agent to check if it has a parent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('parent_id')
      .eq('id', agentId)
      .single();
    
    if (agentError) {
      console.error('Error fetching agent:', agentError);
      return [];
    }
    
    // Determine which agent IDs to include in the search
    let agentIds = [agentId];
    
    // If this is a child agent and includeParentDocs is true, include the parent's documents
    if (includeParentDocs && agent.parent_id) {
      agentIds.push(agent.parent_id);
    }
    
    // If this is a parent agent, we might want to include only its documents, not its children's
    
    // Perform the search using the embedding
    // Note: This is a simplified version since we can't use vector similarity search directly
    // In a real implementation, you would use a vector database or Supabase's pgvector extension
    
    // For now, we'll just retrieve all chunks for the agent(s) and sort them client-side
    const { data: chunks, error: chunksError } = await supabase
      .from('chunks')
      .select('*, documents(file_name)')
      .in('agent_id', agentIds);
    
    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
      return [];
    }
    
    // Calculate cosine similarity between query embedding and chunk embeddings
    const scoredChunks = chunks.map(chunk => {
      // Check if chunk has an embedding
      if (!chunk.embedding || !Array.isArray(chunk.embedding)) {
        return {
          ...chunk,
          score: 0 // No embedding, so no similarity
        };
      }
      
      // Calculate cosine similarity
      const similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
      
      return {
        ...chunk,
        score: similarity
      };
    });
    
    // Sort by score (descending) and take the top 'limit' chunks
    const topChunks = scoredChunks
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return topChunks;
  } catch (error) {
    console.error('Error retrieving relevant chunks:', error);
    return [];
  }
}

/**
 * Format retrieved chunks into a context string for the LLM
 * @param {Object[]} chunks - The retrieved chunks
 * @returns {string} - Formatted context string
 */
function formatChunksAsContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return '';
  }
  
  let context = 'Here are some relevant documents that might help you answer the question:\n\n';
  
  chunks.forEach((chunk, index) => {
    context += `Document ${index + 1}: ${chunk.documents?.file_name || 'Unknown'}\n`;
    context += `Content: ${chunk.content}\n\n`;
  });
  
  context += 'Please use this information to help answer the user\'s question. If the information provided doesn\'t contain the answer, please say so.';
  
  return context;
}

module.exports = {
  extractTextFromDocument,
  processDocument,
  chunkText,
  generateEmbedding,
  retrieveRelevantChunks,
  formatChunksAsContext
};
