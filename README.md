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

## 📦 Deployment

Stryama is optimized for deployment on **Vercel**.

- Build command: `pnpm build`
- Output directory: `.next`

## 📄 License

[MIT](LICENSE)
