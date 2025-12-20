# Stryama Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- **Empowerment**: Enable non-technical users to build full-stack web apps via chat.
- **Speed**: Sub-15 minute time-to-first-app.
- **Ownership**: Users must be able to export and own their code (GitHub/Netlify).
- **Scale**: Architecture capable of supporting 10k+ users.

## Requirements

### Functional Requirements

**Core Generation**

- **FR1:** Accept natural language prompts and generate Next.js code via Claude.
- **FR2:** Execute code in E2B sandboxes for live preview.
- **FR3:** Support streaming responses for perceived latency reduction.

**Project Management**

- **FR4:** Persist projects, files, and chat history in PostgreSQL.
- **FR5:** Authenticate users via Clerk (Email/Google).

**Integrations (New)**

- **FR6:** Connect GitHub accounts via OAuth and export projects to new repositories.
- **FR7:** Connect Netlify accounts via OAuth and deploy projects to live URLs.
- **FR8:** Collect user feedback via an integrated widget/modal.

**Usage & Limits**

- **FR9:** Track token usage and enforce plan limits (Free/Builder/Pro).
- **FR10:** Display usage statistics to users.

### Non-Functional Requirements

- **NFR1:** Prompt-to-preview latency < 30s for minor updates.
- **NFR2:** 99.5% uptime for API and Sandbox services.
- **NFR3:** Secure handling of OAuth tokens (encryption at rest).
- **NFR4:** Responsive design (Mobile/Desktop).

## User Interface Design

### Key Views

1.  **Dashboard**: Project grid + "New Project" + Usage stats.
2.  **Editor**: Split view (Chat Left, Preview Right).
3.  **Integrations**: Modals for connecting GitHub/Netlify.

## Technical Assumptions

### Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind 3.4, ShadCN/UI.
- **State**: TanStack React Query.
- **Backend**: tRPC, Prisma, PostgreSQL (Neon).
- **Services**: Claude (AI), E2B (Sandbox), Clerk (Auth), Vercel (Hosting).

### Deployment

- **Main App**: Vercel.
- **User Apps**: Previewed in E2B, deployed to Netlify.

## Epic List

**Epic 1: Foundation**

- Next.js setup, Clerk Auth, Prisma/DB schema, Basic Layouts.

**Epic 2: AI Core**

- Claude Integration, Streaming, Prompt Engineering, Context Management.

**Epic 3: Sandbox**

- E2B Integration, File Sync, Iframe Preview.

**Epic 4: Persistence**

- Project CRUD, File System in DB, History.

**Epic 5: Integrations (New)**

- **GitHub**: OAuth flow, Repo creation, Commit logic.
- **Netlify**: OAuth flow, Site creation, Deploy logic.

**Epic 6: Usage & Monitization**

- Token tracking, Plan limits, Upgrade flows.
