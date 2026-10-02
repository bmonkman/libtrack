# LibTrack

A modern library management system built with SvelteKit, TypeScript, and Vercel Serverless Functions.

## Project Overview

LibTrack keeps track of a household's library books when the kids have many books checked out across several library cards. It also shows your library card barcodes for when you're at the library without your card.
It features a SvelteKit frontend with Tailwind CSS styling and a TypeScript backend using Vercel Serverless Functions.

### How it's used

You gather the library books you can find into a pile. Then, phone in hand, you go down the "Still out" list one book at a time. For each title you check the pile: if the book is there, tap **Found** and it drops off the list. Whatever is left on "Still out" when you're done is what's still somewhere in the house, usually in a kid's room. The daily sync keeps the list current: new loans appear, and returned books leave by themselves.

To mark many at once, tap **Find books in a photo** and photograph the pile with the covers showing. The app suggests which of your still-out books are in the photo; untick any it got wrong and confirm, and they're all marked found together.

### Key Features

- **Book Management**: Track whether each borrowed book is still out, found in the house, or returned, with overdue books flagged from their due dates
- **Library Cards**: Manage library cards with display names and system associations
- **Modern UI**: Responsive design with Tailwind CSS
- **Type Safety**: Full TypeScript support throughout the stack
- **Serverless**: Deployed on Vercel with serverless functions
- **Automated Book Sync**: Daily synchronization with library systems to update checked-out books and due dates

## Project Structure

```
libtrack/
├── package.json            # root dev scripts (setup, dev, check, test:e2e)
├── docker-compose.yml      # local Postgres
├── CLAUDE.md               # architecture, deploy and release notes
├── .claude/skills/         # how Claude runs, tests and screenshots the app
└── apps/
    ├── frontend/           # SvelteKit app (Vercel project: libtrack)
    │   ├── src/lib/        # API client, types, date helpers
    │   ├── src/routes/     # pages
    │   └── e2e/            # Playwright tests
    └── backend/            # Vercel serverless API (Vercel project: libtrack-api)
        ├── api/            # endpoints only (one function per file)
        ├── lib/            # entities, data source, sync logic
        ├── migrations/     # schema migrations
        └── scripts/        # seed data, one-card sync CLI
```

## Development

### Running locally

An optional dev container is described in [.devcontainer/README.md](.devcontainer/README.md).

Requires Docker and Node 22.

```bash
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local
npm install && npm run setup                            # installs, starts Postgres, migrates
npm run dev                                             # http://localhost:5173
```

Register in the browser, then `npm run db:seed` to give your account sample cards and books.
Tests: `npm run check` and `npm run test:e2e`. More detail in `CLAUDE.md` and
`.claude/skills/libtrack-dev/SKILL.md`.

## Project Creation

This entire project, including all code, configuration, and documentation, was created without writing any code manually. Everything was generated using Cursor, an AI-powered IDE that can understand and implement complex development requirements. The AI assistant was able to:

1. Design the application architecture
2. Generate all necessary code files
3. Set up the development environment
4. Create database schemas and migrations
5. Implement the frontend and backend
6. Write documentation

## Notes on AI-assisted Development

I used multiple AI coding assistants during development, with notable differences in their capabilities:

**Cursor:**

- Provided a smooth, integrated development experience
- Good understanding of the project architecture as a whole
- Useful features like button to add terminal text to chat context
- Ran out of credits, switched to copilot

**GitHub Copilot with Claude 3.7:**

- Noticeably slower response times compared to Cursor

**General Observations:**

- Having both projects in a single repo was very helpful for context, but not necessarily best practice.
- Limited understanding of Vercel deployment concepts
- Struggled with Svelte-specific patterns and best practices
- Less proficient at setting up development environments
- Success with AI-assisted development was heavily dependent on my experience as a developer
- Having sufficient knowledge to properly direct the AI and critically review its output was essential
- The ability to recognize incorrect suggestions and provide better prompts significantly improved results
- Started the project by getting the agent to create openapi.yaml from my description, this provided a very useful foundation
- The agent was able to manage fairly complex workflows like implementing both the backend and frontend of WebAuthn (passkey) auth
