---
description: 'Project AI Collaboration Rules for Next.js 15, Prisma, Server Actions, Tailwind, shadcn/ui, Neon, LangChain, and LlamaIndex.'
globs:
  [
    '**/*.tsx',
    '**/*.ts',
    '**/*.js',
    '**/*.jsx',
    '**/*.sql',
    'prisma/schema.prisma',
  ]
alwaysApply: true
---

# Goals & Scope

- **Goal**: To complete a three-step closed loop of (a) job description matching, (b) resume customization, and (c) interview key points generation, all achieved with minimal token consumption and stable, structured output.
- **Scope**: The service is exclusively for the personal job search scenario. The MVP will not include a browser extension, a template library, or an automated application submission feature.

# Danger Operation

- **Reset Database**: Use `npx prisma migrate reset --force` will reset the database schema and data. This operation is **dangerous** and should only be performed in a controlled environment. Do ask for confirmation before executing.

# Architectural Overview (MVP)

1.  **Frontend/Backend**: Next.js 15 App Router + Tailwind CSS + shadcn/ui, deployed to Vercel.
2.  **Authentication**: Neon Auth.
3.  **Database**: Neon PostgreSQL with pgvector enabled for vector storage.
4.  **Data Access Layer**: Prisma ORM + a strict Data Access Layer (DAL) to uniformly manage all database reads, writes, and transactions.
5.  **Backend Paradigm**: Server Actions first. API Routes serve as a thin adapter layer (for parameter validation and call forwarding only).
6.  **LLM Services**:
    - **Inference Models**: DeepSeek v3.2, GLM 4.5 (for complex tasks); GLM-4.5-Flash (for lighter tasks).
    - **Vision Model**: GLM-4.1v-thinking-Flash.
    - **Embedding Model**: GLM embedding-3.
    - **RAG**: LlamaIndex + pgvector.
    - **Workflow**: LangChain (for model abstraction, queue management, and chain orchestration).

# 1. General Project Standards

- **Directory & File Naming**:
  - Use `kebab-case` for component directories and non-route folders (e.g., `components/user-profile`).
  - Use `PascalCase` for component files and type definition files (e.g., `UserProfile.tsx`, `UserTypes.ts`).
  - Use `camelCase` for non-component files like utilities, services, and DALs (e.g., `lib/utils.ts`, `lib/dal/user.ts`).
- **Code Style**:
  - Strictly adhere to the project's `ESLint` and `Prettier` configurations for code formatting.
  - Prefer named exports (`export function ...`) over default exports (`export default ...`) to maintain consistency in imports.
- **Environment Variables**:
  - All sensitive information (API Keys, database connection strings, etc.) **must** be stored in the `.env.local` file.
  - Environment variables intended for client-side use **must** be prefixed with `NEXT_PUBLIC_`.
  - Never access or expose non-`NEXT_PUBLIC_` environment variables in client-side code.

# 2. Next.js 15 & App Router Core Rules

- **App Router First**:
  - **Must** use the App Router (`app` directory) for all page and API routing.
  - Do not mix the `pages` and `app` directories for routing.
  - Files like `page.tsx`, `layout.tsx`, `loading.tsx`, and `error.tsx` must be co-located within their corresponding route directories.
- **Component Paradigm**:
  - **Default to Server Components (RSC)**: Components should be Server Components by default for data fetching, direct database access (via the DAL), and rendering static content.
  - **Minimize Client Components**: Only mark a component as a Client Component (`'use client'`) when it requires user interactivity, lifecycle hooks (`useEffect`, `useState`), or browser-specific APIs.
  - **Component Splitting**: Isolate client-side interactive logic into small, dedicated Client Components. The parent components should remain Server Components whenever possible.
- **Data Fetching**:
  - **Server-Side Fetching**: Data fetching logic **must** be performed primarily in Server Components, Route Handlers, or Server Actions.
  - **Avoid Client-Side Fetching**: Do not fetch data in Client Components unless it's for real-time client interactions (e.g., search-as-you-type suggestions).
  - **Caching & Revalidation**: Fully leverage the `fetch` API's caching and the `next: { revalidate: <seconds> }` option. Set appropriate revalidation times for static or infrequently changing data. Use `unstable_noStore` or `cache: 'no-store'` for fully dynamic content.
- **Routing & Navigation**:
  - **Internal Linking**: **Must** use the `<Link>` component for all internal application navigation to leverage prefetching and client-side routing.
  - **Programmatic Navigation**: In Client Components, use the `useRouter` hook from `next/navigation` for programmatic navigation.

# 3. Styling: Tailwind CSS & shadcn/ui

- **Tailwind CSS**:
  - **Utility-First**: Strictly adhere to the utility-first principle. Prioritize using Tailwind's atomic classes over writing custom CSS files.
  - **Theme Extension**: All design tokens (colors, fonts, spacing, etc.) must be configured centrally in the `tailwind.config.js` file under `theme.extend`.
  - **Dynamic Classes**: When constructing class names dynamically, use libraries like `clsx` or `tailwind-merge` to ensure correctness and avoid conflicts.
- **shadcn/ui**:
  - **Adding Components**: **Must** use the shadcn/ui CLI (`npx shadcn-ui@latest add ...`) to add new components, not manual copy-pasting.
  - **Component Composition**: Treat shadcn/ui components as building blocks. Compose and wrap them to create reusable, application-specific components.
  - **Style Customization**: Customize component appearance by modifying `tailwind.config.js` and global CSS variables (`globals.css`), not by directly editing the base component files in `components/ui`.

# 4. Data Access Layer: Prisma ORM & DAL

This is a core architectural rule and must be strictly followed.

- **Prisma Schema**:
  - **Single Source of Truth**: All data models, enums, and relations **must** be defined exclusively in the `prisma/schema.prisma` file.
  - **pgvector Integration**: For vector storage, **must** use the `Unsupported("vector(1536)")` type to define vector fields. The dimension (1536) must match the output dimension of the embedding model (GLM embedding-3).
    ```prisma
    // prisma/schema.prisma
    model Document {
      id        Int      @id @default(autoincrement())
      content   String
      embedding Unsupported("vector(1536)")? // Dimension for GLM embedding-3
    }
    ```
  - **Database Migrations**: After modifying `schema.prisma`, **must** run `npx prisma migrate dev` to generate and apply database migrations.
- **Data Access Layer (DAL)**:

  - **Mandatory DAL Usage**: **All** database operations (CRUD) in the project **must** go through the DAL. Direct instantiation or use of `PrismaClient` in Server Components, Server Actions, or API Routes is strictly forbidden.
  - **DAL Directory Structure**: All DAL-related files must be located in `lib/dal/` and organized by data model (e.g., `user.ts`, `document.ts`).
  - **DAL Function Design**:

    - DAL functions should be pure, reusable data manipulation functions.
    - Functions should accept clear arguments and return processed data or status.
    - Complex business logic and transactions must be encapsulated within the DAL.
    - **Example `lib/dal/document.ts`**:

      ```typescript
      import { prisma } from '@/lib/db' // A singleton Prisma Client instance
      import type { Document } from '@prisma/client'

      export async function createDocument(
        content: string,
        embedding: number[]
      ): Promise<Document> {
        // Note: Prisma requires raw SQL for vector types.
        await prisma.$executeRaw`
          INSERT INTO "Document" (content, embedding)
          VALUES (${content}, ${`[${embedding.join(',')}]`}::vector);
        `
        // This may require an additional SELECT to return the created document.
        const newDoc = await prisma.document.findFirst({ where: { content } })
        if (!newDoc) throw new Error('Failed to create and retrieve document')
        return newDoc
      }

      export async function findSimilarDocuments(
        queryEmbedding: number[],
        limit: number
      ): Promise<Document[]> {
        // Use pgvector's cosine distance operator for similarity search.
        const result: Document[] = await prisma.$queryRaw`
          SELECT id, content
          FROM "Document"
          ORDER BY embedding <-> ${`[${queryEmbedding.join(',')}]`}::vector
          LIMIT ${limit};
        `
        return result
      }
      ```

# 5. Backend Paradigm: Server Actions First

- **Server Actions as the Default**:
  - **All** data mutations (e.g., form submissions, creates, updates, deletes) **must** be implemented using Server Actions by default.
  - Server Action files should be named `actions.ts` or `*.actions.ts` and placed within the relevant feature directory.
  - **Must** include the `'use server';` directive at the top of Server Action files.
- **Client-Side Interaction**:
  - When invoking Server Actions from Client Components, use React 19's `useFormState`, `useFormStatus`, and `useOptimistic` hooks to handle loading, error states, and optimistic UI updates for a better user experience.
- **The Role of API Routes**:
  - API Routes (`app/api/...`) should only be used for:
    1.  Receiving webhooks from third-party services (e.g., Stripe, GitHub).
    2.  Providing traditional RESTful endpoints for external clients or mobile apps.
    3.  Specific use cases that require a streaming response.
  - API Routes **must** be kept "thin." Their primary responsibility is parameter validation and error handling, after which they should call the DAL or other business services. They should not contain complex business logic.

# 6. LLM Integration: LangChain & LlamaIndex

- **Configuration & Initialization**:
  - **Model Keys**: API keys for all LLM providers **must** be configured via environment variables (e.g., `DEEPSEEK_API_KEY`, `GLM_API_KEY`).
  - **Centralized Entry Points**: Create centralized entry points for model and client initialization under `lib/llm/`.
    - `models.ts`: Initialize and export various LLM instances (DeepSeek, GLM) based on environment variables. This allows for easy model switching.
    - `embeddings.ts`: Initialize and export the GLM embedding-3 model instance.
- **LangChain (Workflow Orchestration)**:
  - **LCEL First**: **Must** use the LangChain Expression Language (LCEL) and its pipe (`|`) syntax to build chains. This ensures code is declarative, readable, and composable.
  - **Input/Output Schemas**: For complex chains, it is recommended to use Zod to define input and output schemas for automatic validation and type safety.
  - **Chain Encapsulation**: Encapsulate specific business logic chains (e.g., summarization chain, Q&A chain) into separate, reusable functions.
- **LlamaIndex (RAG & Vector Storage)**:

  - **VectorStore**: **Must** use a suitable LlamaIndex `VectorStore` integration (e.g., `PrismaVectorStore`) to interact with Neon's `pgvector`. Configuration should be centralized in a file like `lib/rag/vectorStore.ts`.

    ```typescript
    // Example: lib/rag/vectorStore.ts
    import { PrismaClient } from '@prisma/client'
    import { PrismaVectorStore } from 'llamaindex/storage/vectorStore/PrismaVectorStore'

    const prisma = new PrismaClient()

    export const vectorStore = new PrismaVectorStore({
      prisma: prisma,
      tableName: 'Document',
      vectorColumnName: 'embedding',
      contentColumnName: 'content',
    })
    ```

  - **Indexing**:
    - The process of creating and embedding data into the vector store should be implemented as standalone scripts (e.g., `scripts/generate-embeddings.ts`). These scripts will read from a data source, call the embedding model, and store the results.
  - **Querying**:
    - The RAG query logic should be encapsulated in service functions (e.g., `lib/rag/query.ts`).
    - This service will take a user query, generate a query vector, use a LlamaIndex Retriever to fetch relevant documents from the vector store, construct a prompt, and call an LLM to generate the final answer.

# 7. Neon TypeScript SDK

This section provides comprehensive rules and best practices for interacting with the Neon API using the `@neondatabase/api-client` TypeScript SDK. The SDK is a wrapper around the Neon REST API and provides typed methods for managing all Neon resources.

## 7.1. Neon Core Concepts

To effectively use the Neon TypeScript SDK, it's essential to understand the hierarchy and purpose of its core resources.

| Concept          | Description                                                                                                                        | Analogy/Purpose                                                                                                 | Key Relationship                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Organization     | The highest-level container, managing billing, users, and multiple projects.                                                       | A GitHub Organization or a company's cloud account.                                                             | Contains one or more Projects.                                                                        |
| Project          | The primary container that contains all related database resources for a single application or service.                            | A Git repository or a top-level folder for an application.                                                      | Lives within an Organization (or a personal account). Contains Branches.                              |
| Branch           | A lightweight, copy-on-write clone of a database's state at a specific point in time.                                              | A `git branch`. Used for isolated development, testing, staging, or previews without duplicating storage costs. | Belongs to a Project. Contains its own set of Databases and Roles, cloned from its parent.            |
| Compute Endpoint | The actual running PostgreSQL instance that you connect to. It provides the CPU and RAM for processing queries.                    | The "server" or "engine" for your database. It can be started, suspended (scaled to zero), and resized.         | Is attached to a single Branch. Your connection string points to a Compute Endpoint's hostname.       |
| Database         | A logical container for your data (tables, schemas, views) within a branch. It follows standard PostgreSQL conventions.            | A single database within a PostgreSQL server instance.                                                          | Exists within a Branch. A branch can have multiple databases.                                         |
| Role             | A PostgreSQL role used for authentication (logging in) and authorization (permissions to access data).                             | A database user account with a username and password.                                                           | Belongs to a Branch. Roles from a parent branch are copied to child branches upon creation.           |
| API Key          | A secret token used to authenticate requests to the Neon API. Keys have different scopes (Personal, Organization, Project-scoped). | A password for programmatic access, allowing you to manage all other Neon resources.                            | Authenticates actions on Organizations, Projects, Branches, etc.                                      |
| Operation        | An asynchronous action performed by the Neon control plane, such as creating a branch or starting a compute.                       | A background job or task. Its status can be polled to know when an action is complete.                          | Associated with a Project and often a specific Branch or Endpoint. Essential for scripting API calls. |

## 7.2. Installation

Install the SDK package into your project:

```bash
npm install @neondatabase/api-client
```

## 7.3. Understanding API Key Types

When performing actions via the API, you must select the correct type of API key based on the required scope and permissions.

1.  **Personal API Key**: Accesses all projects the user is a member of. Best for individual use.
2.  **Organization API Key**: Accesses all projects within an entire organization. Best for CI/CD and service accounts.
3.  **Project-scoped API Key**: Access is strictly limited to a single project. This is the most secure and limited key type, best for third-party integrations.

## 7.4. Authentication and Client Initialization

All interactions with the Neon API require an API key. Store your key securely as an environment variable (`NEON_API_KEY`).

```typescript
import { createApiClient } from '@neondatabase/api-client'

// Best practice: Load API key from environment variables
const apiKey = process.env.NEON_API_KEY

if (!apiKey) {
  throw new Error('NEON_API_KEY environment variable is not set.')
}

const apiClient = createApiClient({ apiKey })
```

## 7.5. API Operations

### 7.5.1. API Keys

- **`apiClient.listApiKeys()`**: Retrieves a list of all API keys. Use this to get the `key_id` for revoking a key.
- **`apiClient.createApiKey({ key_name: '...' })`**: Creates a new API key. The secret `key` token is only returned once upon creation; store it securely.
- **`apiClient.revokeApiKey(keyId)`**: Permanently revokes an existing API key.

### 7.5.2. Operations

An operation is an action like `create_branch`. Monitor long-running operations to ensure completion.

- **`apiClient.listProjectOperations({ projectId: '...' })`**: Retrieves a list of operations for a specified project.
- **`apiClient.getProjectOperation(projectId, operationId)`**: Retrieves the status and details of a single operation.

### 7.5.3. Projects

- **`apiClient.listProjects({})`**: Retrieves a list of all projects.
- **`apiClient.createProject({ project: { ... } })`**: Creates a new Neon project.
- **`apiClient.getProject(projectId)`**: Fetches detailed information for a single project.
- **`apiClient.updateProject(projectId, { project: { ... } })`**: Updates the settings of an existing project.
- **`apiClient.deleteProject(projectId)`**: Permanently deletes a project. This is irreversible.
- **`apiClient.getConnectionUri({ ... })`**: Gets a complete connection string for a database.

### 7.5.4. Branches

- **`apiClient.createProjectBranch(projectId, { ... })`**: Creates a new branch from a parent.
- **`apiClient.listProjectBranches({ projectId: '...' })`**: Retrieves a list of branches for a project.
- **`apiClient.getProjectBranch(projectId, branchId)`**: Fetches details for a single branch.
- **`apiClient.updateProjectBranch(projectId, branchId, { ... })`**: Updates a branch's properties.
- **`apiClient.deleteProjectBranch(projectId, branchId)`**: Permanently deletes a branch. You cannot delete the default branch or a branch with children.
- **`apiClient.listProjectBranchEndpoints(projectId, branchId)`**: Lists endpoints for a specific branch.
- **Databases within a Branch**:
  - `apiClient.listProjectBranchDatabases(projectId, branchId)`
  - `apiClient.createProjectBranchDatabase(projectId, branchId, { ... })`
  - `apiClient.getProjectBranchDatabase(projectId, branchId, databaseName)`
  - `apiClient.updateProjectBranchDatabase(projectId, branchId, databaseName, { ... })`
  - `apiClient.deleteProjectBranchDatabase(projectId, branchId, databaseName)`
- **Roles within a Branch**:
  - `apiClient.listProjectBranchRoles(projectId, branchId)`
  - `apiClient.createProjectBranchRole(projectId, branchId, { ... })`
  - `apiClient.getProjectBranchRole(projectId, branchId, roleName)`
  - `apiClient.deleteProjectBranchRole(projectId, branchId, roleName)`

### 7.5.5. Endpoints

- **`apiClient.createProjectEndpoint(projectId, { ... })`**: Creates a new compute endpoint.
- **`apiClient.listProjectEndpoints(projectId)`**: Lists all endpoints for a project.
- **`apiClient.getProjectEndpoint(projectId, endpointId)`**: Retrieves details for a single endpoint.
- **`apiClient.updateProjectEndpoint(projectId, endpointId, { ... })`**: Updates an endpoint's configuration.
- **`apiClient.deleteProjectEndpoint(projectId, endpointId)`**: Deletes a compute endpoint.
- **`apiClient.startProjectEndpoint(projectId, endpointId)`**: Starts an `idle` endpoint.
- **`apiClient.suspendProjectEndpoint(projectId, endpointId)`**: Suspends an `active` endpoint.
- **`apiClient.restartProjectEndpoint(projectId, endpointId)`**: Restarts an active endpoint.

### 7.5.6. Organizations

- **`apiClient.getOrganization(orgId)`**: Retrieves details for an organization.
- **API Keys for an Org**:
  - `apiClient.listOrgApiKeys(orgId)`
  - `apiClient.createOrgApiKey(orgId, { ... })`
  - `apiClient.revokeOrgApiKey(orgId, keyId)`
- **Members of an Org**:
  - `apiClient.getOrganizationMembers(orgId)`
  - `apiClient.getOrganizationMember(orgId, memberId)`
  - `apiClient.updateOrganizationMember(orgId, memberId, { ... })`
  - `apiClient.removeOrganizationMember(orgId, memberId)`
- **Invitations for an Org**:
  - `apiClient.getOrganizationInvitations(orgId)`
  - `apiClient.createOrganizationInvitations(orgId, { ... })`

## 7.6. Error Handling

The SDK throws `AxiosError` for API failures. Always wrap API calls in `try...catch` blocks.

- `error.response.status`: The HTTP status code (e.g., `401`, `404`, `429`).
- `error.response.data`: The error payload from the Neon API.

<!-- end list -->

```typescript
async function safeApiOperation(projectId: string) {
  try {
    const response = await apiClient.getProject(projectId)
    return response.data
  } catch (error: any) {
    if (error.isAxiosError) {
      const status = error.response?.status
      const data = error.response?.data
      console.error(`API Error: Status ${status}, Message: ${data?.message}`)
    } else {
      console.error('A non-API error occurred:', error.message)
    }
    return null
  }
}
```

# 8\. Neon Auth

These rules govern the integration of user authentication with the Neon Postgres database, eliminating the need to manually synchronize user data.

## 8.1. Core Concepts

Neon Auth consists of two components:

1.  **The Authentication Layer (SDK)**: Powered by Stack Auth (`@stackframe/stack`), it manages user sessions, sign-ins, and sign-ups in your application code.
2.  **The Database Layer (Data Sync)**: A near real-time, read-only replica of your user data in the `neon_auth.users_sync` table, ready for SQL joins.

## 8.2. Stack Auth Setup

- **Initial Setup**: The human developer enables Neon Auth in the console and gets credentials.
- **Installation Wizard**: Run `npx @stackframe/stack init-stack@latest --agent-mode --no-browser`.
- **Environment Variables**: Update `.env.local` with `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, and `STACK_SECRET_SERVER_KEY`.

## 8.3. Stack Auth Usage

### 8.3.1. UI Components

- Use pre-built components from `@stackframe/stack` like `<UserButton />`, `<SignIn />`, and `<SignUp />`.
- Compose smaller components like `<OAuthButtonGroup />` for custom flows.

### 8.3.2. User Management

- **Client Components**: Use the `useUser()` hook to get the current user. Update with `user.update({...})` and sign out with `user.signOut()`.
- **Server Components**: Use `stackServerApp.getUser()` from the `stack/server.tsx` file.

### 8.3.3. Page Protection

- Protect pages by redirecting unauthenticated users.
  - **Client**: `useUser({ or: "redirect" })`
  - **Server**: `await stackServerApp.getUser({ or: "redirect" })`
  - **Middleware**: Check for a user and redirect to `/handler/sign-in` if none is found.

## 8.4. Neon Auth Database Integration

### 8.4.1. Database Schema

- A `neon_auth` schema is created automatically.
- The primary table is `users_sync`. It contains user `id`, `name`, `email`, and timestamps.
- **NOTE**: Do not manually create or modify this schema.

### 8.4.2. Database Usage Best Practices

- **Read-Only Replica**: **NEVER** `INSERT`, `UPDATE`, or `DELETE` rows directly in the `neon_auth.users_sync` table. All user modifications must happen through the Stack Auth SDK.
- **Querying Active Users**: Always include `WHERE deleted_at IS NULL` in your queries to work only with active users.
  ```sql
  SELECT * FROM neon_auth.users_sync WHERE deleted_at IS NULL;
  ```
- **Foreign Keys**: You **SHOULD** create foreign key constraints from your application tables _to_ the `neon_auth.users_sync(id)` column to maintain referential integrity.
  ```sql
  -- CORRECT WAY
  CREATE TABLE posts (
      id SERIAL PRIMARY KEY,
      content TEXT,
      author_id TEXT NOT NULL REFERENCES neon_auth.users_sync(id) ON DELETE CASCADE
  );
  ```
- **Joining Data**: Use a `LEFT JOIN` from your application tables to the `users_sync` table on the user ID.
  ```sql
  SELECT p.*, u.name as author_name
  FROM public.posts p
  LEFT JOIN neon_auth.users_sync u ON p.author_id = u.id
  WHERE u.deleted_at IS NULL;
  ```
