# FableDash Backend

A Node.js backend service for the FableDash application, providing API endpoints for AI agent management, document processing, and chat functionality.

## Features

- AI agent creation and management
- Document upload and processing (PDF, TXT, CSV, DOCX)
- Chat functionality with AI agents
- SQLite database for data storage
- OpenAI integration for AI capabilities

## Tech Stack

- Node.js
- Express
- SQLite
- OpenAI API
- Multer for file uploads
- PDF-parse and CSV-parser for document processing

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/fabledash-backend.git
cd fabledash-backend
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Create a `.env` file in the root directory with the following content:
```
PORT=3001
OPENAI_API_KEY=your_openai_api_key
```

4. Start the development server
```bash
npm run dev
# or
yarn dev
```

5. The server will be running at `http://localhost:3001`

## API Endpoints

### Agents
- `POST /api/agents/create` - Create a new agent
- `GET /api/agents/list` - List all agents

### Documents
- `POST /api/documents/upload` - Upload a document to an agent
- `GET /api/documents/list` - List documents for an agent

### Chats
- `POST /api/chats/create` - Create a new chat
- `POST /api/chats/message` - Send a message in a chat
- `GET /api/chats/history` - Get chat history

## Deployment

This backend can be deployed to Vercel as a serverless function. Make sure to set up the environment variables in your Vercel project settings.

## License

[MIT](LICENSE)
