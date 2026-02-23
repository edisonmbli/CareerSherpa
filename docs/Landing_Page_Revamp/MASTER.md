# CareerShaper Landing Page - Design System & Structure Plan

## 1. Design System: Bento Grid x Soft UI Evolution
Based on the existing application tokens and UI/UX Pro Max professional SaaS guidelines, the Landing Page will utilize a highly polished, trustworthy, and modern aesthetic. We will avoid cheap CSS gradients and instead rely on sophisticated lighting, shadows, and subtle textures.

### 1.1 Typography
*   **Headings:** `var(--font-outfit)` (Outfit) / `var(--font-plus-jakarta)` (Plus Jakarta Sans) - Modern, tech-forward, and clean sans-serif typography. Perfectly matches the UI's Soft UI geeky yet professional SaaS aesthetic, replacing overly classical serifs.
*   **Body & UI Text:** System sans-serif (Inter/Nunito Sans) - Clean, highly readable SaaS standard.
*   **Hierarchy:** High contrast between heading weight (Bold/800) and supporting text (Regular/muted).

### 1.2 Color Architecture
*   **Primary Trust:** `#0EA5E9` (Sky Blue) / Existing `text-primary`. Represents professional, calm, AI-driven capability.
*   **Background:** `bg-background` (Pure/Near-white in Light mode, deep Slate/Zinc in Dark mode) allowing glass cards to pop.
*   **Card Surfaces:** `bg-card/50` with `backdrop-blur-sm` to create physical depth without heavy opacity.
*   **Semantic Accents:** Emerald (Match/Strengths), Amber (Risks), Rose (Missing skills) - used strictly for data visualization.

### 1.3 Shadows, Borders & Soft UI Effects
The core "Soft UI Evolution" relies on multi-layered box-shadows to simulate light hitting a physical glass/frosted surface.
*   **Double Border Effect:** `shadow-[0_0_0_1px_rgba(255,255,255,0.4)_inset,0_2px_6px_rgba(0,0,0,0.04)]` (Light) and `dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_4px_24px_rgba(0,0,0,0.2)]` (Dark).
*   **Borders:** `border border-border/60` to enforce physical edges.
*   **Radius (Rounding):** `.rounded-xl` for outer Bento Grid containers; `.rounded-sm` for inner nested items/badges. `rounded-full` for chips and floating elements.
*   **Tactile Texture:** `<svg>` noise filter overlay (`opacity: 0.03`) applied to card backgrounds to break up flat digital surfaces.

### 1.4 Animation & Interactions
*   **Mounting:** `animate-in fade-in slide-in-from-bottom-6 duration-[800ms] ease-out`. Staggered reveals for Bento grids.
*   **Hover States:** `transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`. Subtle scaling (`scale-105` on inner icons).
*   **Visual Assets:** Pure Code (HTML/CSS/Framer Motion). Animated SVG paths for charts, typing effects for AI generation simulation.

### 1.5 i18n Layout & Defensive Design
*   **Elastic Dimensions:** All Bento Grid cards and text containers **MUST** explicitly use elastic minimum heights (`min-h-[xxx]`) instead of rigid fixed heights (`h-[xxx]`).
*   **Generous Padding:** Guarantee ample internal spacing (e.g., `p-6` or `p-8`) to absorb content reflows. 
*   **Reasoning:** Chinese strings often expand by 30-50% in length when localized to English. Sticking to flexible grid definitions and responsive paddings prevents grid breakage or text clipping during language switching.

---

## 2. Landing Page Structure & Component Plan

The narrative strictly follows: **Hook -> Trust -> Paradigm Shift (Asset Vault) -> Core Value (Bento Features) -> Conversion**.

### 2.1 Hero 区 (The Hook)
*   **Goal:** Immediate professional impact. Establish trust.
*   **Layout:** Centered alignment. Heavy typography.
*   **Headline [i18n]:** "你的 AI 求职私教" (Your Premium AI Job Search Coach)
*   **Subheadline [i18n]:** "告别海投。沉淀个人经历，让 AI 为你精准匹配岗位、定制惊艳简历并制定面试通关策略。" (Stop blindly applying. Consolidate your experience and let AI match you, build stunning resumes, and craft interview strategies.)
*   **CTA:** `[ 开始免费诊断 / Start Free Diagnosis ]` (Solid primary color, pulsing glow).
*   **Code-driven Visual:** A floating abstract UI component. Behind it, a slow-spinning, blurred SVG gradient orb (to signify AI thought). In front, a mock "Match Score Card" (reusing the `ResultCard` aesthetic) elegantly floating via Framer Motion.

### 2.2 信任背书区 (Trust & Social Proof Banner)
*   **Goal:** Alleviate privacy concerns and highlight technical authority before asking users to entrust the platform with their career experiences.
*   **Layout:** A minimalist inline banner or subtle marquee immediately beneath the Hero block.
*   **Elements [i18n]:** "Privacy First / 数据安全隔离", "Powered by Advanced AI / 驱动于顶尖大模型", "Local Browser Parsing / 保护简历隐私" (Accompanied by Lucide icons like Shield, Sparkle, Lock).
*   **Visual:** Low opacity (`opacity-60`), monochrome or muted text, seamless integration with the page background to avoid stealing focus from the CTA.

### 2.3 核心价值理念区 (Core Value Statement)
*   **Goal:** Educate the user on the "Profile First" mechanism. It's not just "uploading a file", it is systematically building a structured "Personal Asset Vault" (个人高光资产库) for the AI to retrieve and weaponize.
*   **Layout:** 2-column storytelling layout.
*   **Section Title [i18n]:** "打造专属个人的高光资产库" (Build Your Personal Highlight Asset Vault)
*   **Steps:**
    1.  **沉淀 (Vault):** Unload your raw experiences. AI extracts and structures your data into a secure knowledge base.
    2.  **织网 (Graph):** The AI connects disparate achievements into a unified competency graph.
    3.  **赋能 (Empower):** The vault feeds the AI engine to generate highly targeted assets for any given JD instantly.
*   **Code-driven Visual:** A sleek, secure SVG animation where the Vault nodes map and connect tracking varying Job Descriptions ("Collision Engine").

### 2.4 Bento Grid 场景功能区 (Core Value Showcase)
*   **Goal:** High information density, visually striking. Showcase the 4 core functions with a **heavy visual emphasis** on the Resume Builder.
*   **Layout:** CSS Grid (`grid-cols-1 md:grid-cols-3 auto-rows-auto gap-4 md:gap-6`).
    *   **Card 1 (Span 3 Cols / Full Width) - 定制精美简历 (Custom Resumes - Primary Payload):**
        *   *Layout:* Top-level dominating card, spanning the entire width of the Bento layout to command maximum attention.
        *   *Copy:* 专属线上排版，一键分发替代沉重 PDF (Stunning web-native resumes, overriding static PDFs via shareable links).
        *   *Visual:* An expansive, horizontally sweeping skeleton mesh illustrating a beautifully formatted resume layout sliding into view on hover, complemented by an interactive "Copy Link" micro-interaction.
    *   **Card 2 (Span 1 Col) - 精准匹配分析 (Precision Match):**
        *   *Copy:* 透视 JD 隐藏需求 (Decipher hidden JD requirements).
        *   *Visual:* A mini SVG Radar chart or a glowing Match Score ring (Code generated).
    *   **Card 3 (Span 1 Col) - 破冰话术 (Smart Pitch):**
        *   *Copy:* 抓眼球的直联内推话术 (Eye-catching DM & referral scripts).
        *   *Visual:* A sleek chat bubble executing a typing animation sequence.
    *   **Card 4 (Span 1 Col) - 面试沙盘演练 (Mock Interview):**
        *   *Copy:* 预判面试官的连环追问 (Anticipate ruthless interviewer follow-ups).
        *   *Visual:* Opposing blocks abstractly reflecting Defense framing and Attack counters.

### 2.5 CTA 转化区 (The Push)
*   **Goal:** Capture the user while intent is high. Highlight the Freemium model.
*   **Layout:** Deep tinted container (`bg-primary/5`), heavy padding.
*   **Headline [i18n]:** "准备好斩获心仪的 Offer 了吗？" (Ready to land your dream offer?)
*   **Subheadline [i18n]:** "注册即送启动金币，开启你的智能求职之旅。按需拓展，毫无压力。" (Register to get startup coins. Pay as you go, zero pressure.)
*   **CTA Button:** `[ 立即开启尝试 / Get Started Now ]` (Includes a small glowing coin icon).

---
*Note: All visuals will be implemented using Tailwind CSS utilities, Lucide React icons, and Framer Motion. No raster images will be used to ensure perfect i18n scaling, dark mode compatibility, and zero loading layout shifts.*
