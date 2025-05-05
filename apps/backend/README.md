# LibTrack Backend

A TypeScript-based backend API for managing library books, built with TypeORM, Vercel Serverless Functions, and Neon DB.

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Neon DB account and database
- Vercel account

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL=your_neon_db_connection_string
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

3. Initialize the database:
```bash
npm run typeorm migration:run
```

## Development

To run the development server:
```bash
npm run dev
```

## Deployment

1. Push your code to a Git repository
2. Connect your repository to Vercel
3. Configure the following environment variables in Vercel:
   - DATABASE_URL
   - JWT_SECRET
   - NODE_ENV

## API Documentation

The API follows the OpenAPI specification defined in `openapi.yaml`. You can view the full API documentation there.

### Key Endpoints

- `GET /api/books` - Get books by states
- `PUT /api/books/states` - Update states of multiple books
- `POST /api/auth/register` - Register a new user with passkey
- `POST /api/auth/login` - Login with passkey
- `GET /api/library-cards` - Get list of library cards
- `POST /api/library-cards` - Create a new library card
- `PUT /api/library-cards/{id}` - Update a library card 
