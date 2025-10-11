# Stryama

A modern full-stack application built with the [T3 Stack](https://create.t3.gg/).

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [Clerk](https://clerk.com) - Authentication
- [Prisma](https://prisma.io) - Database ORM
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [tRPC](https://trpc.io) - Type-safe API
- [Anthropic Claude](https://anthropic.com) - AI integration
- [E2B](https://e2b.dev) - Code execution sandbox

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm installed
- PostgreSQL database (local or hosted)
- API keys for Clerk, Anthropic, and E2B

### Environment Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd stryama
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` with your actual values:

   ```bash
   # Database
   DATABASE_URL="postgresql://user:password@localhost:5432/stryama"

   # Clerk Authentication
   CLERK_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
   NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

   # AI Services
   ANTHROPIC_API_KEY="sk-ant-..."

   # Sandbox
   E2B_API_KEY="e2b_..."

   # Application
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

### Obtaining API Keys

#### Database (PostgreSQL)

**Option 1: Local PostgreSQL**

- Install PostgreSQL locally
- Create a database: `createdb stryama`
- Use connection string: `postgresql://postgres:password@localhost:5432/stryama`

**Option 2: Hosted Database (Recommended)**

- [Neon](https://neon.tech) - Serverless PostgreSQL (Free tier available)
- [Supabase](https://supabase.com) - Open source Firebase alternative (Free tier available)
- [Railway](https://railway.app) - Infrastructure platform (Free tier available)

#### Clerk Authentication

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application
3. Navigate to **API Keys** in the sidebar
4. Copy both the **Secret Key** and **Publishable Key**

#### Anthropic API

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

#### E2B Sandbox

1. Go to [e2b.dev](https://e2b.dev)
2. Sign up for an account
3. Navigate to **API Keys** in the dashboard
4. Create a new API key
5. Copy the key (starts with `e2b_`)

### Database Setup

Run Prisma migrations to set up your database schema:

```bash
pnpm db:push
```

### Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variable Validation

This project uses runtime environment variable validation with Zod schemas. The app will **fail to start** with clear error messages if:

- Required environment variables are missing
- Environment variables have invalid formats
- API keys don't match expected patterns

To skip validation (e.g., for Docker builds):

```bash
SKIP_ENV_VALIDATION=1 pnpm build
```

## Security Features

### Security Headers

The following security headers are automatically applied to all responses:

- **Content-Security-Policy (CSP)** - Restricts resource loading
- **Strict-Transport-Security (HSTS)** - Enforces HTTPS
- **X-Frame-Options** - Prevents clickjacking
- **X-Content-Type-Options** - Prevents MIME sniffing
- **Referrer-Policy** - Controls referrer information
- **Permissions-Policy** - Restricts browser features

### CORS Configuration

API routes are configured with CORS restrictions:

- **Development**: Allows `localhost` origins
- **Production**: Only allows the configured `NEXT_PUBLIC_APP_URL`

CORS can be configured in [`src/lib/cors.ts`](src/lib/cors.ts).

## Troubleshooting

### Environment Variable Errors

**Problem**: App fails to start with Zod validation errors

**Solution**:

- Check that all required variables in `.env.local` are filled in
- Verify API key formats match the expected patterns (see [.env.example](.env.example))
- Ensure no extra quotes or spaces around values

**Example Error**:

```
❌ Invalid environment variables:
  CLERK_SECRET_KEY: CLERK_SECRET_KEY must start with sk_test_ or sk_live_
```

### Database Connection Issues

**Problem**: Cannot connect to database

**Solution**:

- Verify `DATABASE_URL` is correct
- Check that PostgreSQL is running (if local)
- Ensure database exists: `createdb stryama`
- Test connection: `psql $DATABASE_URL`

### CORS Errors in Browser

**Problem**: API requests blocked by CORS policy

**Solution**:

- Verify `NEXT_PUBLIC_APP_URL` matches your actual URL
- Check that the origin is in the allowed list in [`src/lib/cors.ts`](src/lib/cors.ts)
- Clear browser cache and restart dev server

### Build Failures

**Problem**: Build fails with module not found

**Solution**:

```bash
# Clean install dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Clear Next.js cache
rm -rf .next
pnpm build
```

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), check out these resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available)
- [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app)

## Deployment

Follow the T3 deployment guides:

- [Vercel](https://create.t3.gg/en/deployment/vercel) (Recommended)
- [Netlify](https://create.t3.gg/en/deployment/netlify)
- [Docker](https://create.t3.gg/en/deployment/docker)

### Pre-Deployment Checklist

- [ ] All environment variables configured in hosting platform
- [ ] Database provisioned and `DATABASE_URL` updated
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] Clerk configured for production domain
- [ ] Security headers reviewed and CSP adjusted if needed

## License

[MIT](LICENSE)
