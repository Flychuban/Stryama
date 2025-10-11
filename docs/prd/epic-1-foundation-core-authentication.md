# Epic 1: Foundation & Core Authentication

**Epic Goal:** Establish production-ready project infrastructure with user authentication and basic application framework, delivering immediate deployable value through a functional web application that users can register for and access.

## Story 1.1: Next.js Project Initialization with TypeScript
As a developer,
I want a Next.js 15+ project with App Router and strict TypeScript configuration,
so that the development team has a type-safe foundation with modern React patterns.
I already ran pnpm create t3-app@latest so everything with the initial instalation of Next, Prisma, TS is installed. You only need to check whether everything is ok and to change sth if it's not ok or need to be configured.

**Acceptance Criteria:**
1. Create Next.js project using `create-next-app` with TypeScript and App Router
2. Configure `tsconfig.json` with strict mode, path aliases (@/), and proper module resolution
3. Set up `next.config.js` with production optimizations and security headers
4. Configure TypeScript absolute imports for components, lib, types, and app directories
5. Install and configure `@types/node` and other essential type definitions
6. Verify TypeScript compilation with zero errors using `tsc --noEmit`
7. Create basic `globals.css` with Tailwind imports and CSS reset

## Story 1.2: Tailwind CSS and ShadCN UI Setup
As a developer,
I want Tailwind CSS with ShadCN components configured,
so that consistent, accessible UI components are available throughout the application.

**Acceptance Criteria:**
1. Install and configure Tailwind CSS with Next.js App Router support
2. Set up `tailwind.config.js` with custom theme tokens and ShadCN compatibility
3. Initialize ShadCN with `npx shadcn-ui@latest init` and configure components.json
4. Install essential ShadCN components: Button, Input, Card, Dialog, Toast
5. Create `lib/utils.ts` with `cn` utility function for conditional classes
6. Set up CSS variables for theme colors in `globals.css`
7. Verify responsive design tokens work across breakpoints (sm, md, lg, xl, 2xl)

## Story 1.3: Development Tooling and Code Quality
As a developer,
I want ESLint, Prettier, and Git hooks configured for consistent code quality,
so that the codebase maintains high standards and follows team conventions.

**Acceptance Criteria:**
1. Configure ESLint with Next.js, TypeScript, and React hooks rules
2. Set up Prettier with consistent formatting (semi-colons, single quotes, 2-space indent)
3. Install and configure `lint-staged` for pre-commit code formatting
4. Create `.gitignore` with Next.js, Node.js, and IDE-specific exclusions
5. Add package.json scripts: `dev`, `build`, `start`, `lint`, `lint:fix`, `type-check`
6. Configure VSCode settings.json for automatic formatting and linting
7. Verify all tools work correctly with sample components and utilities

## Story 1.4: Environment Configuration and Security
As a developer,
I want environment variable management and security configurations,
so that sensitive data is protected and deployment environments are properly configured.

**Acceptance Criteria:**
1. Create `.env.example` with all required environment variables documented
2. Set up `.env.local` for development with placeholder values
3. Configure environment variable validation using Zod schemas in `env.mjs`
4. Add security headers in `next.config.js` (CSP, HSTS, X-Frame-Options)
5. Set up CORS configuration for API routes with proper origin restrictions
6. Configure runtime environment validation that fails fast on missing variables
7. Document environment setup process in README.md

## Story 1.5: PostgreSQL Database Setup with Prisma
As a developer,
I want PostgreSQL database configured with Prisma ORM and proper schema,
so that data persistence is reliable and type-safe throughout the application.

**Acceptance Criteria:**
1. Install Prisma CLI and configure `prisma/schema.prisma` with PostgreSQL provider
2. Define initial database schema with User, Project, File, AIGeneration models
3. Set up database connection URL handling for development and production
4. Create and run initial migration with `prisma migrate dev`
5. Generate Prisma client with proper TypeScript types
6. Create `lib/db.ts` with singleton Prisma client instance
7. Verify database connection with health check query

## Story 1.6: Core Database Models and Relationships
As a developer,
I want comprehensive database models for users, projects, and AI generations,
so that all application data can be stored with proper relationships and constraints.

**Acceptance Criteria:**
1. User model with clerkId, email, createdAt, updatedAt fields and unique constraints
2. Project model with name, description, userId foreign key, and JSON file structure
3. File model with path, content, language, projectId relationships
4. AIGeneration model with prompt, response, tokens, duration, userId tracking
5. Sandbox model for tracking E2B environments linked to projects
6. Proper indexes on frequently queried fields (userId, projectId, clerkId)
7. Database seed script with sample data for development

## Story 1.7: Clerk Authentication Setup and Configuration
As a user,
I want to create an account and sign in using email/password or Google OAuth,
so that I can access the platform and save my projects securely.

**Acceptance Criteria:**
1. Clerk project setup with development and production environments
2. Configure authentication providers: email/password and Google OAuth
3. Install `@clerk/nextjs` and configure middleware for route protection
4. Set up authentication pages: sign-in, sign-up, user profile
5. Configure Clerk webhook endpoints for user creation and updates
6. Implement automatic user record creation in database via webhooks
7. Test complete authentication flow from registration to database sync

## Story 1.8: Protected Route Middleware and Authorization
As a developer,
I want middleware that protects authenticated routes and handles authorization,
so that user data is secure and only accessible to authorized users.

**Acceptance Criteria:**
1. Configure Clerk middleware in `middleware.ts` for route protection
2. Create auth utilities for server components and API routes
3. Implement user context provider for client-side authentication state
4. Set up redirect logic for unauthenticated users to sign-in page
5. Create role-based access control utilities for future premium features
6. Add proper error handling for authentication failures
7. Verify protected routes redirect properly and authenticated routes work

## Story 1.9: tRPC API Foundation and Type Safety
As a developer,
I want tRPC configured for end-to-end type safety between client and server,
so that API communication is reliable and development is efficient.

**Acceptance Criteria:**
1. Install and configure tRPC with Next.js App Router integration
2. Set up tRPC client in `lib/api.ts` with proper error handling
3. Create base router structure in `server/api/root.ts`
4. Implement authentication middleware for protected tRPC procedures
5. Set up development tools: tRPC panel for API testing
6. Create example user router with basic CRUD operations
7. Verify type safety works end-to-end from client to database

## Story 1.10: Application Layout and Navigation Framework
As a user,
I want a responsive application layout with intuitive navigation,
so that I can easily access different sections of the platform.

**Acceptance Criteria:**
1. Create main layout component with header, sidebar, and content areas
2. Implement responsive header with logo, navigation, and user profile dropdown
3. Build collapsible sidebar navigation for dashboard sections
4. Add loading states and error boundaries for all layout components
5. Ensure mobile responsiveness from 320px to 2560px viewports
7. Create placeholder dashboard page accessible after authentication

## Story 1.11: External Service Account Setup and API Configuration
As a developer,
I want all external service accounts properly configured with secure API credentials,
so that the development team can immediately begin implementing AI generation and sandbox functionality without service access blockers.

**Acceptance Criteria:**
1. Create Claude Code SDK account and obtain API keys through official Anthropic process
2. Set up E2B sandbox service account with appropriate tier for development needs
3. Configure Clerk authentication service with development and production environments
4. Store all API credentials securely in environment variables with proper naming conventions
5. Test connectivity to all external services with health check procedures
6. Document API rate limits and usage quotas for each service
7. Create fallback error handling for external service unavailability
8. Set up monitoring alerts for API quota approaching limits

## Story 1.12: Integration Testing Framework and External Service Mocking
As a developer,
I want comprehensive testing infrastructure for external service integrations,
so that the application can be tested reliably without depending on external service availability.

**Acceptance Criteria:**
1. Set up MSW (Mock Service Worker) for mocking external API responses during testing
2. Create test fixtures for Claude Code SDK responses with various generation scenarios
3. Implement E2B sandbox service mocking for preview functionality testing
4. Build integration tests that validate external service error handling
5. Create test data sets for different AI generation success and failure cases
6. Set up automated testing that runs against mocked services in CI/CD pipeline
7. Document testing procedures for external service integration validation

