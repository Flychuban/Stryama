# Technical Assumptions

## Repository Structure: Monorepo

Single Next.js application repository with clear separation of client/server concerns. This approach provides simplicity for MVP development while maintaining the ability to scale to microservices architecture in later phases if needed.

## Service Architecture

**Next.js Architecture:** Leveraging standard Next.js API Routes for backend logic. Core components include:

- Next.js 15+ with App Router for frontend and API routes
- tRPC for end-to-end type-safe API communication
- Claude Code SDK integration for AI-powered code generation
- E2B sandboxed execution environment for secure code preview
- Clerk for complete authentication and user management
- Stripe integration (via Clerk) for subscription management in later phases

## Testing Requirements

**Unit + Integration Testing:** Jest and React Testing Library for component testing, tRPC endpoint testing with MSW mocking for external services. Manual testing focus on AI generation quality and sandbox functionality due to the complexity of testing AI-driven workflows. No e2e testing in MVP to maintain development velocity.

## Additional Technical Assumptions and Requests

**Frontend Technology Stack:**

- Next.js 15.3+ with TypeScript 5.8+ for type safety and modern React patterns
- React 19.0+ for improved concurrent features and performance
- ShadCN/UI (v4 compatible) + Tailwind CSS 4.0+ for consistent, accessible UI components
- Zustand 5.0+ for lightweight state management with improved TypeScript support
- React Error Boundaries for graceful AI failure handling
- PNPM 9.15.4+ for efficient package management

**Backend and Database:**

- PostgreSQL 15+ with Prisma ORM 6.5+ for robust data persistence and type-safe database operations
- Database schema optimized for project file storage, user management, and AI generation tracking
- Comprehensive logging and error tracking for AI generation pipeline
- Node.js 20+ LTS runtime for optimal performance and stability

**AI and Sandbox Integration:**

- Claude Code SDK (latest version) as primary AI engine with intelligent context awareness
- E2B SDK v2+ for secure, isolated code execution environments
- tRPC 11.0+ for end-to-end type safety with FormData support and React Server Components
- Robust error recovery strategies for AI generation failures
- Usage tracking and rate limiting for freemium business model support

**Security and Performance:**

- Input validation using Zod schemas for all user inputs and AI responses
- Code sanitization to prevent malicious pattern injection
- Sandboxed execution prevents security vulnerabilities
- Sub-45 second prompt-to-preview latency requirements
- 99.5% uptime targets for core services

**Development and Deployment:**

- Vercel hosting for automatic deployments
- Environment-based configuration for development, staging, and production
- Git-based workflow with feature branch deployment previews
- TypeScript strict mode with comprehensive linting (ESLint 9+, Prettier 3.5+)
- **Documentation Research Requirement:** All developers must use Ref MCP to verify latest stable versions and documentation before implementing any tool or library integration

**CRITICAL TECHNICAL CONSTRAINTS:**

- Dependent on Claude API availability and rate limits
- E2B sandbox service limitations may constrain preview capabilities
- Serverless function execution time limits (platform dependent, e.g., 60s default)
- Limited to web applications initially (no native mobile or desktop)
- All external API integrations must have fallback strategies
