# Landing Page Redesign Plan

## Objective
Redesign the landing page (`/app/[locale]/page.tsx`) to effectively communicate the value proposition of CareerShaper, shifting focus from technical implementation to user benefits and career success. The design should be visually engaging, professional, and consistent with the application's "document/workspace" aesthetic.

## Core Philosophy (The "Why")
The redesign centers on the belief that **successful job hunting starts with organized personal assets**. The app isn't just a tool; it's a workflow that helps users structure their experience (`Profile Assets`) to power AI-driven applications (`Match`, `Customize`, `Interview`).

## Proposed Page Structure

### 1. Hero Section
*   **Goal:** Immediate value proposition and call to action.
*   **Visual:** A clean, high-impact area.
*   **Copy:**
    *   *Headline:* "Your Personal AI Career Coach" / "你的 AI 求职私教"
    *   *Subhead:* "Unlock your potential with data-driven resume customization and interview strategies."
    *   *CTA:* "Start Free Trial" (Highlighting the free credits).
*   **Visual Element:** A dynamic preview of the "Workbench" or a composite of the high-value outputs (Resume + Analysis Report).

### 2. The "Asset-First" Philosophy (New Section)
*   **Goal:** Educate users on the importance of the "Profile" step.
*   **Content:** Explain that uploading a "Detailed Resume" allows the AI to understand them deeply, enabling better matching and customization.
*   **Visual:** A flow diagram or simple illustration: `Raw Experience` -> `Structured Assets` -> `Tailored Applications`.

### 3. Feature Workflow Showcase (Interactive)
*   **Goal:** Demonstrate the "How" and "What" in a user-centric flow.
*   **Interaction:** A Tabbed interface (similar to `ProfileTabs`) switching between the 3 core steps:
    1.  **Analyze (Match):** Show a mock `ResultCard` highlighting a high match score and key insights.
    2.  **Customize (Resume):** Show the Resume Editor capabilities and the "Tailored" output.
    3.  **Prepare (Interview):** Show the `InterviewBattlePlan` card.
*   **Why this works:** It lets users "try" the experience visually without signing up yet.

### 4. Value Propositions (Benefits)
*   **Goal:** Reinforce the "Why us".
*   **Points:**
    *   **Precision:** "Stop guessing. Know exactly why you fit."
    *   **Efficiency:** "Tailor resumes in seconds, not hours."
    *   **Confidence:** "Walk into interviews prepared for every question."

### 5. FAQ & Footer
*   **Goal:** Address concerns (Privacy, Pricing).
*   **Refinement:** Update existing FAQ to be friendlier.

## Visual Direction
*   **Theme:** "Professional Workspace".
*   **Elements:**
    *   Use the **Noise Texture** background (from `ResultCard`) for distinct sections to create a tactile "paper" feel.
    *   **Shadows & Borders:** Subtle borders and soft shadows to mimic physical cards/documents.
    *   **Typography:** Clean, legible headings.
    *   **Motion:** Gentle fade-ins and slide-ups using `framer-motion`.

## Implementation Steps

### Phase 1: Copy & Content (i18n)
1.  Update `lib/i18n/en.ts` and `zh.ts` with the new structure.
    *   `landing.hero`
    *   `landing.philosophy` (New)
    *   `landing.features` (Renamed from `howItWorks`)
    *   `landing.benefits` (Renamed from `valueProps`)

### Phase 2: Component Development
1.  **`LandingHero`:** Refactor to be more visual.
2.  **`PhilosophySection`:** Create new component.
3.  **`FeatureShowcase`:** Create a complex component using `Tabs` and mock versions of `ResultCard` / `InterviewBattlePlan`.
    *   *Note:* Need to create "Static" or "Mock" data for these cards so they render without backend data.
4.  **`BenefitsSection`:** Refactor `ValuePropsSection`.

### Phase 3: Page Assembly
1.  Assemble components in `app/[locale]/page.tsx`.
2.  Ensure responsive design (Mobile/Desktop).
3.  Verify Dark Mode compatibility.

## Technical Details
*   **Mock Data:** Create a `lib/mocks/landing-data.ts` to hold static example data for the showcase components (Match Result, Resume, Interview Plan).
*   **Reuse:** Import `ResultCard`, `InterviewBattlePlan` directly but pass `mockData`.

## Verification
*   Check responsiveness on mobile.
*   Check language switching (EN/ZH).
*   Verify no hydration errors with the interactive tabs.
