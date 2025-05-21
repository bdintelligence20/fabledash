# FableDash

A modern dashboard application built with React, TypeScript, and Vite for the frontend, and FastAPI with Python for the backend. This application provides a user interface for managing tasks, finances, and AI agents.

## Features

- Dashboard overview with key metrics
- Task management with status tracking and comments
- Client management
- AI agent management with document upload and chat capabilities
- Parent-child agent relationships with shared chat history
- RAG (Retrieval-Augmented Generation) for enhanced AI responses
- Responsive design for desktop and mobile

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- Lucide React for icons

### Backend
- FastAPI (Python)
- Supabase (PostgreSQL)
- OpenAI API integration
- Docker for containerization
- Google Cloud Run for deployment

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python 3.11 or higher
- npm or yarn
- Supabase account and project
- OpenAI API key

### Frontend Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/fabledash.git
cd fabledash
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Create a `.env` file based on `.env.example`
```bash
cp .env.example .env
```

4. Update the `.env` file with your Supabase and API credentials

5. Start the development server
```bash
npm run dev
# or
yarn dev
```

6. Open your browser and navigate to `http://localhost:3000`

### Backend Installation

1. Navigate to the Python backend directory
```bash
cd python-backend
```

2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies
```bash
pip install -r requirements.txt
```

4. Create a `.env` file based on `.env.example`
```bash
cp .env.example .env
```

5. Update the `.env` file with your Supabase and OpenAI credentials

6. Start the development server
```bash
python server.py
```

7. The API will be available at `http://localhost:8000`

## Deployment

### Frontend Deployment to Google App Engine

1. Set up a Google Cloud project
2. Configure the Cloud Build trigger with the necessary environment variables
3. Push to your repository to trigger a build and deployment

### Backend Deployment to Google Cloud Run

1. Set up a Google Cloud project
2. Configure the Cloud Build trigger with the necessary environment variables
3. Push to your repository to trigger a build and deployment

## Environment Variables

### Frontend
- `VITE_API_URL`: URL of the backend API
- `VITE_SUPABASE_URL`: URL of your Supabase project
- `VITE_SUPABASE_ANON_KEY`: Anon key for your Supabase project

### Backend
- `SUPABASE_URL`: URL of your Supabase project
- `SUPABASE_KEY`: Anon key for your Supabase project
- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Port for the server (default: 8000)
- `HOST`: Host for the server (default: 0.0.0.0)
- `CORS_ORIGINS`: Comma-separated list of allowed origins for CORS

## Documentation

- [Chat History Feature](python-backend/CHAT_HISTORY_FEATURE.md): Details about the parent-child agent chat history feature
- [RAG Implementation](python-backend/RAG_IMPLEMENTATION.md): Details about the Retrieval-Augmented Generation implementation

## License

[MIT](LICENSE)
