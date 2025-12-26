# Stryama

**AI-Powered No-Code Development Platform**

Stryama democratizes software development by enabling anyone to build functional, production-ready applications through natural language prompts. It combines advanced AI code generation with a secure, sandboxed live preview environment, allowing users to create, visualize, and refine full-stack web applications in real-time.

## 🚀 Key Features

- **💬 Conversational Development**: Build apps by describing them in plain English. No coding knowledge required.
- **🤖 Intelligent Code Generation**: Powered by **Anthropic Claude Code SDK** to generate high-quality, modern React/Next.js code.
- **👁️ Live Sandboxed Preview**: Instant, secure application previews running in isolated **E2B** environments.
- **🔄 Iterative Refinement**: Refine and modify your application through continuous conversation.
- **🛠️ Modern Tech Stack**: Generates production-ready code using **Next.js 15+**, **React 19**, **Tailwind CSS**, and **ShadCN/UI**.
- **🔐 Enterprise-Grade Security**: Integrated **Clerk** authentication and secure runtime execution.
- **🗄️ Full Persistence**: Robust data management with **PostgreSQL** and **Prisma ORM**.

## 🏗️ Architecture

Stryama is built on a serverless-first, TypeScript monorepo architecture leveraging the T3 Stack foundation.

- **Frontend**: Next.js 15+ (App Router), React 19, Tailwind CSS v4, ShadCN/UI
- **Backend**: tRPC (Type-safe API), Next.js Serverless Functions
- **Database**: PostgreSQL (via Neon/Supabase), Prisma ORM
- **AI Engine**: Anthropic Claude Code SDK
- **Execution Engine**: E2B Sandboxed Environments
- **Auth**: Clerk

For a deep dive into the system design, please refer to the [Architecture Documentation](docs/architecture.md).

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ and pnpm installed
- PostgreSQL database
- API Keys: Clerk, Anthropic, E2B

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd stryama
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env.local` and configure your keys:

   ```bash
   cp .env.example .env.local
   ```

4. **Database Setup**

   ```bash
   pnpm db:push
   ```

5. **Run Development Server**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to start building.

## 📄 Documentation

- [Architecture Overview](docs/architecture.md)
- [Project Brief](docs/brief.md)
- [Frontend Specifications](docs/front-end-spec.md)

## 🧪 Testing

Stryama uses **Vitest** for unit testing with a focus on critical business logic and services.

### Test Coverage Strategy

**Phase 1 (Current)**: Critical Services Layer ✅

- ✅ Usage Tracking & Billing Logic (prevents cost overruns)
- ✅ Rate Limiting (prevents API abuse)
- ✅ Model Selection (ensures cost optimization)
- ✅ File Persistence (prevents data loss)
- **95 tests** with **100% coverage** on critical services

**Phase 2 (Planned)**: API Layer & Integration Tests

- tRPC routers (AI, Project, Subscription, Usage)
- Sandbox Manager & Stream Manager
- Target: 20-30% overall coverage

### Running Tests

```bash
# Run all tests in watch mode
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage report
pnpm test:coverage

# Run tests once (CI mode)
pnpm test:ci

# Run tests for changed files only
pnpm test:changed
```

### Test Structure

```
src/
├── __tests__/
│   ├── helpers/         # Test utilities
│   │   ├── db.ts        # Prisma mocks
│   │   ├── factories.ts # Test data factories
│   │   └── clerk.ts     # Auth mocks
│   ├── mocks/           # External service mocks
│   │   ├── e2b.ts       # E2B sandbox mocks
│   │   └── anthropic.ts # Claude SDK mocks
│   └── setup.ts         # Global test setup
└── lib/
    ├── services/
    │   ├── modelSelection.test.ts    # ✅ 29 tests
    │   └── usageTracking.test.ts     # ✅ 25 tests
    └── integrations/
        ├── claude/
        │   └── rateLimiter.test.ts   # ✅ 25 tests
        └── e2b/
            └── utils/
                └── file-saver.test.ts # ✅ 16 tests
```

### CI/CD

Tests run automatically on:

- Every commit via pre-commit hooks (changed files only)
- Every pull request via GitHub Actions
- Every push to `main` branch

See `.github/workflows/test.yml` for CI configuration.

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI integration

Current thresholds:

- Lines: 3%
- Functions: 4%
- Branches: 3%
- Statements: 3%

**Note**: Low overall percentage is intentional - we focus on 100% coverage of high-risk business logic rather than 100% coverage of all code. UI components and integration code will be tested via E2E tests.

## 📦 Deployment

Stryama is optimized for deployment on **Vercel**.

- Build command: `pnpm build`
- Output directory: `.next`

## 📄 License

[MIT](LICENSE)
