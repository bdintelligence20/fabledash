# FableDash Python Backend

This is the Python backend for the FableDash AI Agent System. It provides a FastAPI-based REST API for managing agents, chats, documents, clients, and tasks.

## Features

- **Agent Management**: Create, update, delete, and query agents
- **Chat System**: Create chats, send messages, and retrieve chat history
- **Document Management**: Upload, process, and query documents
- **Client Management**: Create, update, delete, and query clients
- **Task Management**: Create, update, delete, and query tasks
- **RAG (Retrieval-Augmented Generation)**: Enhance AI responses with relevant document context
- **Parent-Child Agent Relationships**: Support for hierarchical agent structures

## Tech Stack

- **FastAPI**: Modern, fast web framework for building APIs
- **Supabase**: PostgreSQL database with built-in authentication and realtime features
- **OpenAI**: Integration with OpenAI's GPT models for AI chat capabilities
- **PyPDF2, python-docx**: Document processing libraries
- **scikit-learn**: For vector similarity search
- **Docker**: Containerization for easy deployment
- **Google Cloud Run**: Serverless deployment platform

## Prerequisites

- Python 3.11+
- Supabase account and project
- OpenAI API key

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fabledash.git
   cd fabledash/python-backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

5. Update the `.env` file with your Supabase and OpenAI credentials.

## Running the Application

### Development

```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000.

### Production

```bash
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Docker

### Building the Docker Image

```bash
docker build -t fabledash-backend .
```

### Running the Docker Container

```bash
docker run -p 8000:8000 --env-file .env fabledash-backend
```

## API Documentation

Once the application is running, you can access the API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Deployment

### Google Cloud Run

The repository includes a `cloudbuild.yaml` file for deploying to Google Cloud Run:

1. Set up a Google Cloud project and enable Cloud Build and Cloud Run.
2. Create a Cloud Build trigger that points to your repository.
3. Set the required environment variables in the Cloud Build trigger settings.
4. Push to your repository to trigger a build and deployment.

## Database Schema

The application expects the following tables in your Supabase database:

- `agents`: Stores agent information
- `chats`: Stores chat sessions
- `messages`: Stores chat messages
- `documents`: Stores document metadata
- `document_chunks`: Stores document chunks with embeddings
- `clients`: Stores client information
- `tasks`: Stores task information
- `task_statuses`: Stores task status options
- `task_comments`: Stores task comments
- `task_attachments`: Stores task attachments

Refer to the Supabase schema file for detailed schema information.

## Parent-Child Agent Chat History

The system supports hierarchical agent relationships with parent and child agents. Chat history can be retrieved for:

- A specific agent's chats
- Child agent chats for a parent agent
- Parent agent chats for a child agent

This enables a comprehensive view of all related conversations.

## License

[MIT License](LICENSE)
