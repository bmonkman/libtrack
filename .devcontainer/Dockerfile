FROM mcr.microsoft.com/devcontainers/javascript-node:20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set up the workspace
WORKDIR /workspaces/libtrack

# Install global dependencies
RUN npm install -g typescript@latest vercel@latest

# Set the user to node
USER node

# Set up environment variables
ENV NODE_ENV=development
ENV PATH="/workspace/node_modules/.bin:${PATH}" 

# Expose ports
EXPOSE 3000
EXPOSE 5173

COPY .vercel .vercel
