# CareerShaper

CareerShaper is an intelligent job search assistant that provides a three-step closed loop of (a) job description matching, (b) resume customization, and (c) interview key points generation. Built with Next.js 15, Prisma, and advanced LLM orchestration.

## Architecture Overview

### LLM Orchestration System

The project features a sophisticated LLM orchestration system designed for optimal performance and resource management:

#### Core Components

1. **LLM Scheduler** (`lib/llm/llm-scheduler.ts`)
   - Central task orchestration and queue management
   - Intelligent routing based on task type and priority
   - Support for multiple LLM providers (DeepSeek, GLM-4.5)
   - Token usage tracking and performance monitoring

2. **LLM Scheduler** (`lib/llm/llm-scheduler.ts`)
   - Unified LLM task scheduling and orchestration
   - Multi-queue task processing with separate queues for different task types
   - Configurable concurrency limits and retry mechanisms
   - Integrated LangChain workflow orchestration and prompt management

3. **Service Orchestrator** (`lib/services/service-orchestrator.ts`)
   - High-level business logic coordination
   - Template-based prompt management
   - Multi-step workflow execution
   - Integration with OCR and embedding services

#### Key Features

- **Queue Management**: Separate queues for text, vision, and embedding tasks
- **Priority Handling**: High-priority tasks get preferential processing
- **Retry Logic**: Automatic retry with exponential backoff
- **Token Tracking**: Comprehensive usage monitoring and logging
- **Performance Optimization**: Intelligent load balancing and resource allocation

#### Usage Example

```typescript
import { executeLLMTask } from '@/lib/llm/llm-scheduler'

const result = await executeLLMTask({
  id: 'task-id',
  userId: 'user-id',
  serviceId: 'service-id',
  type: 'text',
  step: 'summarize',
  prompt: 'Your prompt here',
  priority: 1,
  tier: 'free',
  createdAt: new Date(),
  retries: 0
}, {
  timeout: 30000
})
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Technology Stack

### Frontend & Backend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** + **shadcn/ui** for styling
- **Server Actions** for data mutations

### Database & ORM
- **Neon PostgreSQL** with pgvector for vector storage
- **Prisma ORM** with strict Data Access Layer (DAL)
- **Neon Auth** for authentication

### LLM & AI Services
- **DeepSeek v3.2** & **GLM-4.5** for text generation
- **GLM-4.1v-thinking-Flash** for vision tasks
- **GLM embedding-3** for embeddings
- **LangChain** for workflow orchestration
- **LlamaIndex** for RAG implementation

### Development & Deployment
- **Vercel** for hosting
- **ESLint** & **Prettier** for code quality
- **Vitest** for testing

## Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Database
DATABASE_URL="your-neon-database-url"

# LLM Providers
DEEPSEEK_API_KEY="your-deepseek-api-key"
GLM_API_KEY="your-glm-api-key"

# Authentication
NEXT_PUBLIC_STACK_PROJECT_ID="your-stack-project-id"
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY="your-stack-client-key"
STACK_SECRET_SERVER_KEY="your-stack-server-key"

# Optional: Neon API (for database management)
NEON_API_KEY="your-neon-api-key"
```

## Performance Metrics

Recent performance test results:

- **Single Task Performance**: 40% success rate, 3.2s avg response time
- **Concurrent Processing**: Multi-queue system with 4 active queues
- **Token Efficiency**: 397 tokens processed in test scenarios
- **Throughput**: 0.54 tasks/sec for complex tasks, 9.92 tasks/sec for simple tasks
- **System Uptime**: Stable operation with 18s test duration

## Project Structure

```
lib/
├── llm/                    # LLM orchestration system
│   ├── llm-scheduler.ts    # Unified LLM scheduler and orchestrator
│   ├── providers.ts        # LLM provider interfaces
│   ├── json-validator.ts   # Response validation
│   └── debug-logger.ts     # Debug and monitoring
├── services/               # Business logic services
│   ├── service-orchestrator.ts  # Main orchestration
│   └── ocr-service.ts      # OCR functionality
├── dal.ts                  # Data Access Layer
└── env.ts                  # Environment configuration
```
