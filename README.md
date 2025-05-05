# LibTrack

A modern library management system built with SvelteKit, TypeScript, and Vercel Serverless Functions.

## Project Overview

LibTrack is a full-stack application for managing library books and library cards, specifically keeping track of which kids books have been found when looking around the house for many books that may have been checked out from multiple accounts. It features a modern SvelteKit frontend with Tailwind CSS styling and a TypeScript backend using Vercel Serverless Functions.

### Key Features

- **Book Management**: Track books with states (checked out, found, returned, overdue)
- **Library Cards**: Manage library cards with display names and system associations
- **Modern UI**: Responsive design with Tailwind CSS
- **Type Safety**: Full TypeScript support throughout the stack
- **Serverless**: Deployed on Vercel with serverless functions

## Project Structure

```
libtrack/
├── apps/
│   ├── frontend/           # SvelteKit frontend application
│   │   ├── src/
│   │   │   ├── lib/       # Shared frontend code
│   │   │   └── routes/    # SvelteKit routes
│   │   └── static/        # Static assets
│   │
│   └── backend/           # Vercel serverless backend
│       ├── api/           # API endpoints
│       ├── entities/      # TypeORM entities
│       └── migrations/    # Database migrations
│
└── .devcontainer/         # Development container configuration
```

## Development

The project uses a development container for a consistent development environment. See the [.devcontainer/README.md](.devcontainer/README.md) for setup instructions.

### Frontend Development

```bash
cd apps/frontend
npm install
npm run dev
```

### Backend Development

```bash
cd apps/backend
npm install
vercel dev
```

## Project Creation

This entire project, including all code, configuration, and documentation, was created without writing any code manually. Everything was generated using Cursor, an AI-powered IDE that can understand and implement complex development requirements. The AI assistant was able to:

1. Design the application architecture
2. Generate all necessary code files
3. Set up the development environment
4. Create database schemas and migrations
5. Implement the frontend and backend
6. Write documentation

