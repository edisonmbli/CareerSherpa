# Project Rules & Standards

## 1. Core Architecture & File Structure

- **Directory & Naming Conventions**:
- **Directories**: Use `kebab-case` (e.g., `components/user-profile`).
- **Components/Types**: Use `PascalCase` (e.g., `UserProfile.tsx`, `UserTypes.ts`).
- **Utilities/DAL/Services**: Use `camelCase` (e.g., `lib/utils.ts`, `lib/dal/user.ts`).
- **Files**: adhere to Single Responsibility Principle (SRP). One purpose per file.

- **Environment Variables**:
- Store sensitive data (API Keys, DB strings) in `.env.local`.
- Client-side variables **must** be prefixed with `NEXT_PUBLIC_`.
- **Never** expose non-public keys in client code.

- **Code Style**:
- Strictly follow `ESLint` and `Prettier` configs.
- Use **Named Exports** (`export function`) over default exports for consistency.
- **No Magic Values**: Extract constants to `lib/constants.ts` (e.g., page sizes, error messages).

## 2. Next.js 15 & App Router

- **Routing Paradigm**:
- **Strictly** use the App Router (`app/` dir). Do not use `pages/`.
- Co-locate route files (`page.tsx`, `layout.tsx`, `loading.tsx`) within feature directories.

- **Component Strategy**:
- **Default to Server Components (RSC)**: Use for data fetching, DAL access, and static rendering.
- **Minimize Client Components**: Use `'use client'` _only_ for interactivity (event listeners), hooks (`useState`, `useEffect`), or browser APIs.
- **Split Logic**: Extract interactive bits into small Client Components; keep parents as RSC.

- **Data Fetching**:
- Fetch data in RSC, Server Actions, or Route Handlers. **Avoid** client-side fetching (`useEffect`) unless required for real-time interactions (e.g., search-as-you-type).
- Leverage `fetch` caching strategies (`next: { revalidate: ... }`) or `unstable_noStore` for dynamic data.

- **Navigation**:
- Use `<Link>` for internal navigation.
- Use `useRouter` (from `next/navigation`) only for programmatic navigation in Client Components.

## 3. Styling System (Tailwind & shadcn/ui)

- **Tailwind CSS**:
- **Utility-First**: Avoid custom CSS files. Use utility classes.
- **Configuration**: Define all design tokens (colors, fonts) in `tailwind.config.js` (`theme.extend`).
- **Class Handling**: Use `clsx` or `tailwind-merge` for dynamic class logic.

- **shadcn/ui**:
- **Installation**: Use CLI (`npx shadcn-ui@latest add ...`). Do not copy-paste manually.
- **Customization**: Edit `tailwind.config.js` or `globals.css` variables. Do not modify `components/ui` base files directly.
- **Composition**: Wrap primitive shadcn components to build domain-specific UI.

## 4. Data Access Layer (DAL) & Prisma

-Strict architectural boundary. No exceptions.\*

- **Prisma Schema**:
- `prisma/schema.prisma` is the **Single Source of Truth**.
- **Vector Support**: Use `Unsupported("vector(2048)")` for vector fields (matching GLM embedding-3 dimensions).

- **DAL Rules**:
- **Centralized Access**: All Database CRUD operations **must** occur within `lib/dal/`.
- **Forbidden**: Direct `PrismaClient` usage in UI Components, API Routes, or Actions is prohibited.
- **Structure**: Organize DAL files by model (e.g., `lib/dal/user.ts`, `lib/dal/document.ts`).
- **Purity**: DAL functions must be pure, explicitly typed, and encapsulate complex transactions.

## 5. Backend: Server Actions & Workers

- **Server Actions (Primary Mutation Layer)**:
- Use for **all** form submissions and data mutations.
- Place in `actions.ts` or `*.actions.ts` with `'use server'` directive.
- **Response Format**: Return structured objects (e.g., `{ success: boolean, data?: any, error?: string }`).
- **Client Integration**: Use React 19 hooks (`useFormState`, `useFormStatus`, `useOptimistic`) for UI feedback.

- **API Routes (`app/api/`)**:
- **Restricted Use**: Only for Webhooks (Stripe/GitHub), external REST endpoints, or streaming responses.
- **Thin Layer**: Handle validation/auth only, then delegate to DAL/Services. No business logic.

- **Worker/Background Patterns**:
- **Strategy Pattern**: Use for distinct tasks (OCR, Summaries). Define interfaces and isolate logic in `strategies/`.
- **Guard Clauses**: Use early returns over nested `if/else`.
- **Error Handling**: No empty `catch` blocks. Log errors structurally.

## 6. AI Engineering (LLM & RAG)

- **Configuration**:
- Keys via Environment Variables (e.g., `DEEPSEEK_API_KEY`).
- **Entry Points**:
- `lib/llm/models.ts`: Export configured LLM instances.
- `lib/llm/embeddings.ts`: Export GLM embedding-3 instance.

- **LangChain (Orchestration)**:
- **LCEL**: Strictly use LangChain Expression Language (pipe syntax `|`) for chains.
- **Validation**: Use Zod for input/output schemas.
- **Encapsulation**: Wrap chains in reusable functions (e.g., `summarizeDocumentChain`).

- **LlamaIndex (RAG)**:
- **Vector Store**: Use `PrismaVectorStore` (Neon/pgvector integration). Config in `lib/rag/vectorStore.ts`.
- **Indexing**: Implement as standalone scripts (`scripts/generate-embeddings.ts`).
- **Retrieval**: Encapsulate RAG logic in `lib/rag/query.ts` (Query Vector -> Retriever -> Prompt -> LLM).

## 7. Code Quality & Maintenance

- **Modularity**:
- **Max Length**: Refactor functions/components > 150 lines. Break into helper functions.
- **Logic Isolation**: Isolate business logic from framework code (Next.js Request/React Hooks) into pure TypeScript files (`lib/services/`).

- **Documentation**:
- **JSDoc**: Required for all exported functions in DAL, Services, and Actions (`@desc`, `@param`, `@returns`).
- **Comments**: Explain the "Why" (business context), not the "What" (syntax).

- **Clean Code**:
- **Immutability**: Prefer non-mutating methods (`map`, `filter`, spread).
- **Error Handling**: Wrap external calls in `try...catch`. Return user-friendly errors, don't just throw.
