# Supabase Integration for FableDash

This document explains how to set up and use Supabase as a persistent database for the FableDash application.

## Why Supabase?

The application was originally built with SQLite, which works well for development but has limitations in a serverless environment like Vercel:

1. In-memory SQLite databases are reset with each function invocation
2. File-based SQLite databases can't be used effectively in serverless environments
3. Data persistence between deployments is not possible with SQLite

Supabase provides a PostgreSQL database with:
- Persistent storage across function invocations
- Built-in authentication
- Row-level security
- Vector embeddings support for AI features
- Real-time subscriptions
- REST and GraphQL APIs

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign up or log in
2. Create a new project
3. Choose a name and password for your project
4. Select a region close to your users
5. Wait for the project to be created (this may take a few minutes)

### 2. Get Your Supabase Credentials

1. In your Supabase project dashboard, go to Project Settings > API
2. Copy the `URL` and `anon` key
3. Add these to your environment variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
```

### 3. Set Up Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Create a new query
3. Copy and paste the contents of `supabase-schema.sql` into the query editor
4. Run the query to create all the necessary tables

### 4. Update Vercel Environment Variables

If deploying to Vercel, add the Supabase credentials to your Vercel project:

1. Go to your Vercel project settings
2. Navigate to the Environment Variables section
3. Add the `SUPABASE_URL` and `SUPABASE_KEY` variables with the values from step 2

### 5. Use the Supabase Version of the App

The application has two versions:
- `app.js` and `vercel-app.js` - Original SQLite version
- `vercel-app-supabase-final.js` - Supabase version

To use the Supabase version:

1. In your Vercel configuration, set the entry point to `vercel-app-supabase-final.js`
2. Make sure the Supabase environment variables are set

## Testing the Supabase Connection

You can test if your Supabase connection is working by accessing the health check endpoint:

```
GET /api/supabase/health
```

This will return a success message if the connection is working properly.

## Database Schema

The Supabase database includes the following tables:

- `clients` - Client information
- `task_statuses` - Status options for tasks
- `tasks` - Task data linked to clients
- `task_attachments` - Files attached to tasks
- `task_comments` - Comments on tasks
- `agents` - AI agents configuration
- `documents` - Documents uploaded to AI agents
- `chats` - Chat sessions with AI agents
- `messages` - Individual messages in AI agent chats
- `chunks` - Text chunks with embeddings for AI search

## Vector Embeddings

For AI features, the application uses OpenAI embeddings stored in Supabase's vector column type. This enables semantic search across documents.

To use this feature:
1. Make sure the `pgvector` extension is enabled in your Supabase project
2. Ensure your OpenAI API key is set in the environment variables
3. Upload documents to agents to generate and store embeddings

## Troubleshooting

If you encounter issues:

1. Check that your Supabase credentials are correct
2. Verify that all tables were created successfully
3. Check the Supabase logs for any errors
4. Ensure the pgvector extension is enabled for AI features
5. Verify that your OpenAI API key is valid if using AI features

## Migration from SQLite

If you have existing data in SQLite that you want to migrate to Supabase:

1. Export your SQLite data to JSON or CSV
2. Transform the data to match the Supabase schema if needed
3. Import the data into Supabase using the dashboard or API

Note that the schema has been optimized for PostgreSQL, so some fields may have different types or constraints.
