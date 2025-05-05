# LibTrack Development Container

This directory contains the configuration for the LibTrack development container. The container provides a consistent development environment for both the frontend and backend projects.

## Features

- Node.js 20 with TypeScript support
- VS Code extensions for Svelte, TypeScript, ESLint, and Prettier
- Automatic port forwarding for frontend (5173) and backend (3000)
- Vercel Dev support for local development

## Getting Started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install [VS Code](https://code.visualstudio.com/)
3. Install the [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
4. Open the project in VS Code
5. Click "Reopen in Container" when prompted, or use the Command Palette (F1) and select "Remote-Containers: Reopen in Container"

## Development

Once the container is running:

1. The frontend will be available at http://localhost:5173
2. The backend will be available at http://localhost:3000
3. Use Vercel Dev for local development:
   ```bash
   # In the backend directory
   vercel dev
   ```

## VS Code Extensions

The container includes the following VS Code extensions:
- Svelte for VS Code
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- Docker
- TypeScript and JavaScript Language Features

## Troubleshooting

If you encounter any issues:

1. Try rebuilding the container:
   - Command Palette (F1) -> "Remote-Containers: Rebuild Container"
2. Check Docker Desktop is running
3. Ensure ports 3000 and 5173 are not in use
4. Check the VS Code output panel for any error messages 
