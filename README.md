# GEO - Content Automation Platform

GEO is a TypeScript-based content automation and distribution platform built with Hono API framework and Prisma ORM.

## Features

- **Clear Stories**: Content source management
- **Articles**: Article generation and workflow management
- **Reddit Distribution**: Automated Reddit post distribution
- **Scheduling**: Task scheduling and execution
- **Analytics**: UTM tracking and engagement metrics
- **Agent Orchestration**: AI agent session management

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Hono (lightweight, fast)
- **Database**: PostgreSQL (Vercel Postgres)
- **ORM**: Prisma
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database (or Vercel Postgres)

### Installation

1. Clone the repository
```bash
git clone https://github.com/jbeam-5326/geo.git
cd geo
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Generate Prisma client and push schema
```bash
npm run db:generate
npm run db:push
```

5. Start development server
```bash
npm run dev
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | API information |
| `GET /health` | Health check |
| `GET /ready` | Readiness probe |
| `GET /live` | Liveness probe |
| `/api/clear-stories` | Clear Story management |
| `/api/articles` | Article management |
| `/api/reddit-posts` | Reddit post distribution |
| `/api/schedules` | Task scheduling |
| `/api/users` | User management |
| `/api/customers` | Customer management |
| `/api/analytics` | Analytics and reporting |
| `/api/sessions` | Agent orchestration |

## Deployment

This project is configured for Vercel deployment.

1. Create a Vercel Postgres database
2. Link your GitHub repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Run migrations |
| `npm run typecheck` | Run TypeScript type checking |

## License

ISC
