# agentic-identity-demo

A simple PNPM workspaces mono repo with web, backend and agent packages.

Web - A frontend app for users to interact with the agent.
Backend - Hosts and provides an API for the web app, and interacts with the
agent.

## Web

A React app (Typescript) using vite, styled-components and Tanstack query.

### Development

Run `pnpm dev` to start the development server. Requests are proxied to the
backend running on port 5200.

### Build

Run `pnpm build` to build the distributed version of the app. This is served by
the backend.

## Backend

A Node.js backend using Koa (Typescript). The frontend web app is service from the '.web'
directory. The Teleport Assertion token (injected by Teleport App access) is
parsed and relayed to the client as a cookie.

### Development

Run `pnpm dev` to start the development server. This will also copy the web
distribution - be sure to build the web app first.

### Build

TODO: Setup build process for distribution
