将 LangChain 强大的编排能力与 Next.js 的全栈开发体验相结合，是构建现代化 AI 应用的黄金搭档。

在 Next.js (App Router) 生态中，最佳实践是将所有与 LLM 的交互（尤其是需要 API Key 的操作）都放在**服务端**，通常是通过 API Routes 来实现。这样可以确保您的密钥安全，不会泄露到前端。

以下是为您准备的、在 Next.js 项目中使用 TypeScript 和 LangChain.js 调用智谱 AI 的完整方案建议。

---

### 1\. 项目设置与安装

首先，在您的 Next.js 项目中安装所需的 LangChain.js 相关包。

```bash
# 使用 pnpm (推荐), yarn 或 npm
pnpm install langchain @langchain/core @langchain/zhipuai
```

- `langchain`: 核心的编排库。
- `@langchain/core`: 包含核心的类型定义和基础模块。
- `@langchain/zhipuai`: 智谱 AI 模型的官方集成包。

### 2\. 配置环境变量

在您的项目根目录创建 `.env.local` 文件，并添加您的智谱 AI API Key。Next.js 会自动加载这个文件中的环境变量。

**.env.local**

```
ZHIPUAI_API_KEY="YOUR_ZHIPUAI_API_KEY"
```

**重要**: `.env.local` 文件应该被添加到 `.gitignore` 中，以防密钥泄露到 Git 仓库。

---

### 3\. 创建一个基础的 API Route (非流式)

我们先来创建一个简单的 API 接口，它接收一个问题，然后返回智谱 AI 的完整回答。

在您的 Next.js 项目中，创建文件 `app/api/chat/route.ts`:

**app/api/chat/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { ChatZhipuAI } from '@langchain/zhipuai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StrOutputParser } from '@langchain/core/output_parsers'

// 确保只在服务端运行
export const runtime = 'edge' // 或者 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json()

    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      )
    }

    // 1. 初始化模型
    // API Key 会自动从 process.env.ZHIPUAI_API_KEY 读取
    const model = new ChatZhipuAI({
      model: 'glm-4',
      temperature: 0.7,
    })

    // 2. 创建 Prompt 模板
    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个知识渊博的AI助手。'],
      ['user', '{input}'],
    ])

    // 3. 创建输出解析器
    const outputParser = new StrOutputParser()

    // 4. 组装 Chain
    const chain = prompt.pipe(model).pipe(outputParser)

    // 5. 调用 Chain (invoke 获取完整回答)
    const response = await chain.invoke({
      input: question,
    })

    return NextResponse.json({ answer: response })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}
```

**如何测试这个 API？**
您可以使用 `curl` 或任何 API 测试工具来调用它：

```bash
curl -X POST http://localhost:3000/api/chat \
-H "Content-Type: application/json" \
-d '{"question": "请用TypeScript写一个斐波那契数列的函数"}'
```

---

### 4\. 生产级方案：流式响应 (Streaming) + Vercel AI SDK

在真实的聊天应用中，流式响应可以极大地提升用户体验。Vercel 官方的 `ai` SDK 是实现这一功能的最佳工具，它能与 LangChain.js 完美集成。

#### 步骤 A: 安装额外依赖

```bash
pnpm install ai zod
```

- `ai`: Vercel AI SDK，轻松处理前端和后端的流式通信。
- `zod`: 用于验证请求体，是服务端开发的最佳实践。

#### 步骤 B: 更新 API Route 以支持流式输出

修改 `app/api/chat/route.ts` 文件：

```typescript
import { NextRequest } from 'next/server'
import { Message as VercelChatMessage, StreamingTextResponse } from 'ai'
import { ChatZhipuAI } from '@langchain/zhipuai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { MessagesPlaceholder } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { BytesOutputParser } from '@langchain/core/output_parsers'

export const runtime = 'edge'

// 定义我们期望的请求体格式
const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage)
    const currentMessageContent = messages[messages.length - 1].content

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', '你是一个知识渊博的AI助手, 总是乐于助人并提供详细的解答。'],
      new MessagesPlaceholder('history'),
      ['user', '{input}'],
    ])

    const model = new ChatZhipuAI({
      model: 'glm-4',
      temperature: 0.7,
      streaming: true, // 确保开启流式
    })

    // 使用 BytesOutputParser 以处理流式输出的字节流
    const outputParser = new BytesOutputParser()

    const chain = RunnableSequence.from([prompt, model, outputParser])

    // 使用 .stream() 方法代替 .invoke()
    const stream = await chain.stream({
      input: currentMessageContent,
      history: formattedPreviousMessages.join('\n'),
    })

    // 将 LangChainStream 返回为 Vercel AI SDK 的 StreamingTextResponse
    return new StreamingTextResponse(stream)
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

#### 步骤 C: 创建前端聊天组件

现在，在您的前端页面（例如 `app/page.tsx`）中使用 Vercel AI SDK 提供的 `useChat` hook 来消费这个流式 API。

**app/page.tsx**

```tsx
'use client'

import { useChat } from 'ai/react'

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    // useChat hook 会自动调用这个 API
    api: '/api/chat',
  })

  return (
    <div className="flex flex-col w-full max-w-md mx-auto stretch py-8">
      <div className="flex-grow overflow-auto mb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`whitespace-pre-wrap ${
              m.role === 'user' ? 'text-right' : ''
            }`}
          >
            <strong>{m.role === 'user' ? 'You: ' : 'AI: '}</strong>
            {m.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl text-black"
          value={input}
          placeholder="Say something..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  )
}
```

### 总结与建议

1.  **安全第一**: 始终将 LangChain 的核心逻辑和 API Key 放在 Next.js 的服务端（API Routes, Server Actions, or Route Handlers）。
2.  **拥抱流式**: 对于聊天等交互式应用，使用**流式响应 (Streaming)** 是提升用户体验的关键。`Vercel AI SDK` 是实现此目标的最佳选择。
3.  **代码一致性**: 您会发现，LangChain.js 的链式调用 (`.pipe()` 或 `RunnableSequence`) 与 Python 版本的 LCEL 思想高度一致，这体现了 LangChain 作为统一编排框架的价值。
4.  **探索更多**: LangChain.js 还支持 RAG、Agents 等复杂功能，您可以将刚才创建的 API Route 作为起点，逐步构建更强大的 AI 应用。
