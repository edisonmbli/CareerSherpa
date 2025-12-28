# RAG Knowledge Base: "AI Job-Search Assistant Guide"

## Part 1: Career Positioning

<!-- RAG_METADATA:{"category":"career_positioning", "lang":"en"} -->

### 1.1 Core Concept: Job Seeking as a "Value Exchange"

The essence of job seeking is not "finding a job," but **"completing a value exchange."** A company pays a salary (price) to purchase your "abilities" (value). Your resume and interview are simply showcases for your value. When positioning yourself, you must ask three questions:

1.  **What value do I have?** (Your "Internal Skills" and "External Power")
2.  **What value does the market need?** (The requirements on the JD)
3.  **How do I prove my value?** ("Golden Descriptions" on your resume and STAR examples in your interview)

### 1.2 Practice: Finding Your "Career Anchors"

"Career Anchors" are your core values that determine what kind of role suits you best.

- **Technical/Functional Competence**: Driven to become an expert in a specific field. (e.g., Staff Engineer, Financial Expert)
- **General Managerial Competence**: Driven to lead, coordinate, and manage larger teams and complex business.
- **Security/Stability**: Driven by predictable, stable work environments and benefits.
- **Entrepreneurial Creativity**: Driven to create new things from scratch (0-to-1), unafraid of risk.
- **Autonomy/Independence**: Driven to have maximum freedom, dislikes organizational constraints.
- **LLM Task**: When analyzing a user's history, the LLM can try to identify their career anchor to assist with match analysis.

### 1.3 Cases: Mismatched Career Anchors

- **Conflict Case**: A person with a "Technical/Functional" anchor who is promoted to a "Managerial" role may become miserable, as they lose time for deep technical work.
- **Match Case**: A person with "Entrepreneurial Creativity" might feel stifled in a mature corporation (which favors "Security/Stability") but will thrive in an early-stage startup.

---

## Part 2: History Review & SWOT

<!-- RAG_METADATA:{"category":"detail_analysis", "lang":"en"} -->

### 2.1 Theory: Auditing Your "Internal Skills" & "External Power"

To review your career history is to audit your "Internal Skills" and "External Power".

- **Internal Skills**: Your ability to **solve problems**. This is your core competence.
  - **Level 1 (Knowledge)**: You know "what" (e.g., know Python syntax).
  - **Level 2 (Methods)**: You know "how" (e.g., can write a web scraper in Python).
  - **Level 3 (Principles)**: You know "why" (e.g., understand network protocols and anti-scraping strategies).
- **External Power**: Your ability to **leverage resources** to get things done.
  - **Level 1 (Self-Reliant)**: Accomplishing tasks on your own.
  - **Level 2 (Importing Resources)**: Collaborating cross-departmentally; mobilizing others to help.
  - **Level 3 (Attracting/Creating Resources)**: Your influence attracts external resources (people, money, opportunities).
- **LLM Task**: The `customize` function should help the user reflect both "Internal Skills" and "External Power" in their project descriptions.

### 2.2 Practice: How to Review "Internal Skills" (SWOT Analysis)

SWOT is the classic tool for analyzing your "Internal Skills."

- **S (Strengths)**: Skills you excel at. (e.g., Data-sensitive, strong coding ability).
- **W (Weaknesses)**: Skills you are relatively weak in. (e.g., Weak public speaking, lack of management experience).
- **O (Opportunities)**: What the market needs that you are good at. (e.g., Market needs AI Prompt Engineers; you excel at it).
- **T (Threats)**: What the market no longer needs that is your only skill. (e.g., You are a Flash expert, but the market has moved on).

### 2.3 Practice: How to Review "External Power" (STAR Method)

The STAR method is the best tool for reviewing "External Power" (project experience) (see Part 7.2 for details). In the review phase, the focus is on **excavation**.

- **S (Situation)**: What was the project context?
- **T (Task)**: What was your core mission?
- **A (Action)**: How did you use resources ("External Power") to succeed? Were you "self-reliant" or did you "import resources" (e.g., "coordinated 3 departments")?
- **R (Result)**: What was the quantifiable outcome? (See Part 3.2's XYZ formula).

---

## Part 3: Job Match Analysis

<!-- RAG_METADATA:{"category":"job_match", "lang":"en"} -->

### 3.1 Core Principle: Deconstructing the JD (Job Description)

A JD is a "value requirement list" issued by an employer. Your goal is not to meet 100% of it, but to identify the "core demands" within it. A JD often consists of a "template" (company info written by HR) and the "essence" (the actual needs written by the hiring manager).

### 3.2 Practice: Distinguishing "Must-haves" from "Nice-to-haves"

When analyzing, the LLM must help the user differentiate between these two types of requirements. This is the core of match analysis.

- **Must-haves**: These are skills typically described in the JD as "Expert," "X+ years of experience," or "Required." This is the hard threshold for "internal skills". If these are not met, the match score will be low.
- **Nice-to-haves**: These are skills often described as "Familiar with," "Preferred," or "Bonus points." This reflects "external power" and is used to stand out among many candidates.

### 3.3 Practice: How to Assess "Skill Match" (Keywords)

Skill matching is the first filter.

- **Method**: Extract all "tech stack," "tools," and "certification" keywords from the JD (e.g., Python, Figma, AWS Certified, PMP).
- **Assessment**: Check the frequency and proficiency level described for these keywords in the user's "General Resume" and "Detailed Resume."
- **Example**:
  - JD Requires: "Expert in React, TypeScript."
  - Resume Shows: "Familiar with React, basic knowledge of TypeScript."
  - Analysis: Medium skill match. There is a proficiency gap in core skills.

### 3.4 Practice: How to Assess "Experience Match"

Experience match is more important than skill match. It answers, "Have you actually accomplished things with these skills?"

- **Method**: Extract "experience" descriptions from the JD, e.g., "experience with large-scale SaaS projects," "experience building from 0 to 1," "strong cross-departmental communication skills."
- **Assessment**: Check if the user's "Project History" matches in "Scale" (large vs. small), "Stage" (0-to-1 vs. 1-to-100), and "Role" (Led vs. Participated).
- **Example**:
  - JD Requires: "Performance optimization experience for a product with 5M+ DAU."
  - Resume Shows: "Developed an internal CRM system (500 users)."
  - Analysis: Low experience match. There is a significant discrepancy in project scale (DAU).

### 3.5 Practice: Identifying JD "Jargon" & "Red Flags"

- **Jargon**: Industry or company-specific terminology.
  - E.g., "Close the loop," "Empower," "Synergy," "Ecosystem."
  - The LLM should advise the user that these are "soft descriptions" and the focus should remain on concrete responsibilities.
- **Red Flags**: Descriptions that hint at potential problems with the role.
  - E.g., "Strong ability to withstand pressure," "Adapt to rapid changes," "Flexible working hours" (often means overtime).
  - The LLM should objectively inform the user about potential risks regarding work intensity and stability.

---

## Part 4: Expressing Job Intent

<!-- RAG_METADATA:{"category":"express_job_intent", "lang":"en"} -->

### 4.1 Core Principle: The 30-Second "Elevator Pitch"

A self-recommendation message is not a chat. It is an "Elevator Pitch" designed to **deliver your value within 30 seconds (approx. 100-150 words)**. A hiring manager receives hundreds of these; yours must be as concise and compelling as a billboard.

### 4.2 Practice: The High-Reply-Rate "H-V-C" Structure

A successful outreach message has three parts:

- **H (Hook)**: One sentence stating who you are and why you are writing. (e.g., "Dear [Name], I am writing regarding the Senior Developer role I found on...")
- **V (Value)**: One or two sentences **precisely** demonstrating your "core value" that **matches** the JD. **This is the core content the `match` LLM must generate.**
- **C (Call-to-Action)**: A clear, easy-to-answer request. (e.g., "My resume is attached. Are you available for a brief chat next week?")

### 4.3 Case Library: "Flat" Message vs. "Golden" Template

**Case 1 (Software Developer)**

- **Flat**:
  > "Hi, I'm interested in your 'Frontend Developer' job. I have many years of frontend experience. My resume is attached. Hope to hear from you."
- **Golden (H-V-C)**:
  > "【H】Dear [Hiring Manager name], I am writing to express my strong interest in the 'Senior Frontend Engineer' position I found on your careers page.
  > 【V】I was particularly excited to see the emphasis on 'React performance optimization' and 'component library construction.' This directly aligns with my last 3 years of work, where I led the refactor of a component library for a 1M DAU application, improving LCP performance by 40%.
  > 【C】My resume and portfolio are attached. I would welcome the opportunity to discuss my approach to performance optimization with you."

**Case 2 (Product Manager)**

- **Flat**:
  > "Hi, I am applying for the PM role. I have a lot of experience shipping features. Please see my resume."
- **Golden (H-V-C)**:
  > "【H】Dear [Hiring Manager name], I am applying for the 'SaaS Product Manager' role.
  > 【V】Having studied your product, I saw the JD highlights 'improving user activation' as a key KRA. In my previous role, I specialized in this, driving new user retention from 15% to 28% in 6 months by optimizing the onboarding flow and running A/B tests.
  > 【C】I have several ideas on how I could bring similar growth to your team. Are you available for a 15-minute call next week?"

---

## Part 5: Customized Resume Writing

<!-- RAG_METADATA:{"category":"cv_customize", "lang":"en"} -->

### 5.1 Core Principle: The Resume is an "Ad," Not a "Chronicle"

The sole purpose of a resume is to **precisely match** the target JD, proving you are the "best candidate." It is an advertisement for your "value match", not a chronicle of your life. The core function of `customize` is to rewrite the user's "chronicle" (General Resume) into an "ad" (Customized Resume) for a specific JD.

### 5.2 Practice: How to Quantify Achievements (The X-Y-Z Formula)

This is the **most critical** practical method.

- **Formula**: (In situation X) I accomplished Y, by doing Z.
- **X (Situation)**: The context or problem you faced.
- **Y (Action)**: The key action(s) you took (see 3.3).
- **Z (Result)**: The **quantifiable** outcome of your actions.
- **LLM Task**: When customizing, the LLM should attempt to rewrite the user's flat descriptions into the X-Y-Z format.

### 5.3 Practice: Using "Action Verbs"

Use strong verbs instead of passive or vague ones.

- **Weak Verbs**: Responsible for, Participated in, Assisted with, Handled...
- **Strong Verbs**: **Led**, **Drove**, **Achieved**, **Optimized**, **Refactored**, **Designed**, **Established**, **Increased A to B**...
- **LLM Task**: The LLM should proactively replace weak verbs in the user's resume.

### 5.4 Practice: How to "Patch" Based on the JD

- **Method**: The `customize` task must utilize the analysis results from `match`.
- **Steps**:
  1.  Identify the "Must-have" keywords from the JD (from 4.3).
  2.  Ensure these keywords appear **prominently** in the customized resume's "Skills" and "Projects" sections.
  3.  If the user has the experience but didn't use the keyword, the LLM should try to "translate." (e.g., JD requires "DevOps," user's experience is "Managed Jenkins and Docker." LLM should rewrite this as "Managed DevOps workflows using Jenkins and Docker.").

### 5.5 Case Library: "Flat" Descriptions vs. "Golden" Descriptions

**Case 1 (Software Developer)**

- **Flat**: Responsible for daily maintenance and bug fixes for the company website.
- **Golden (XYZ + Verb)**: **Led** (Y) the refactor of the company website (X), **improving** (Y) page load speed (LCP) **by 40%** (Z) through component and API optimization, and resolved 50+ legacy bugs (Z).

**Case 2 (Product Manager)**

- **Flat**: Participated in the design of the new user sign-up feature.
- **Golden (XYZ + Verb)**: **Drove** (Y) the A/B testing for the new user sign-up flow (X), **increasing** the new user **conversion rate by 15%** (Z) by simplifying verification steps (Y).

**Case 3 (Marketing Specialist)**

- **Flat**: Handled the company's social media accounts.
- **Golden (XYZ + Verb)**: **Established and managed** (Y) the company's social media matrix (X), **achieving 120%** follower **growth** (Z) in 6 months and **increasing** average post engagement **by 30%** (Z).

---

## Part 6: Self-Introduction

<!-- RAG_METADATA:{"category":"self_introduction", "lang":"en"} -->

### 6.1 Core Principle: It's Not a "Resume Recital"

The interviewer already has your resume. The **sole purpose** of a self-introduction is to establish your "professional brand" and **lead the interviewer** to ask questions you _want_ to answer. It must be a highly customized, engaging summary.

### 6.2 Practice: The "Present - Past - Future" (P-P-F) Structure

This is the most classic and effective structure:

- **P (Present)**: Who you are now; your role and years of experience. ("I am a Product Manager with 5 years of experience, specializing in...")
- **P (Past)**: Your **top 1-2 achievements** (your "Golden Descriptions" from Part 3) that are **highly relevant** to the job you are interviewing for. ("In my last role, I led... which resulted in...")
- **F (Future)**: Why you are interested in _this_ specific opportunity. ("I was drawn to this role at [Company Name] because I saw... and that is exactly the challenge I am eager to take on next.")

### 6.3 Practice: Adjusting Based on the "Audience"

- **Facing HR**: HR doesn't understand deep technical details.
  - **Focus**: Highlight your "soft skills," "communication," "stability," and your understanding of the "company culture."
- **Facing the Hiring Manager**:
  - **Focus**: **Get straight to the point**. Highlight your "hard skills," "project achievements" (using the XYZ formula from Part 3), and prove you can "hit the ground running."

### 6.4 Case Library: 1-Minute Golden Template

**Case (Product Manager, facing Hiring Manager)**

> "【Present】Hello, I'm Li Si. I'm a Product Manager with 5 years of experience, and for the last 3 years, I've been focused vertically in the B2B SaaS space, specializing in user activation and retention.
> 【Past】In my most recent role, I was responsible for the XX module. I (Y Action)..., which ultimately (Z Result, e.g., increased new user retention by 15%).
> 【Future】I was particularly drawn to this JD's requirement to 'build a new product line from 0 to 1.' After my last role (which was 1-to-100), this is the exact challenge I am looking for. I am very bullish on this market space and hope we can dive deeper."

---

## Part 7: Interview Strategies & Skills

<!-- RAG_METADATA:{"category":"interview_strategies", "lang":"en"} -->

### 7.1 Theory: The Interviewer's "Iceberg Model"

What the interviewer sees is just the tip of the iceberg (your resume, your answers). What they are truly assessing is what's below the surface—the abilities you **cannot fake**:

- **Above Water**: Knowledge, Skills.
- **Below Water**: Problem-solving ability, mindset, values ("Internal Skills"), and the ability to leverage resources ("External Power").
- **LLM Task**: The `interview` feature should generate points that help the user show not just "what" they know, but "how" they think and "why" they act.

### 7.2 Practice: Answering "Behavioral Questions"

- **Definition**: Questions about your "past." (e.g., "Tell me about a time when you...")
- **Golden Rule**: **The STAR Method** (This is the "application" version of the review from Part 2).
  - **S (Situation)**: The context. One sentence. ("At my last company, our sign-up conversion rate was low...")
  - **T (Task)**: Your assignment. ("My task was to identify the bottleneck and optimize it.")
  - **A (Action)**: **(Core)** What **specific actions** did you take? ("I analyzed the funnel, found... so I designed an A/B test, rewrote the copy, and simplified the captcha...")
  - **R (Result)**: **(Core)** What was the outcome? ("As a result, the conversion rate increased by 15%, leading to... in new revenue.")

### 7.3 Practice: How to Answer "What is your greatest weakness?"

- **The Trap**: Answering with a "fake weakness" (e.g., "I'm too much of a perfectionist") or a "fatal weakness" (e.g., "I hate teamwork").
- **Golden Rule**: A "real, improved, non-fatal" weakness.
- **Structure**:
  1.  **Acknowledge Weakness**: ("In the past, one weakness I've had is overcommitting and taking on too many tasks at once.")
  2.  **Show Improvement (Action)**: ("To fix this, for the past year I have strictly used the GTD (Getting Things Done) method. I prioritize my tasks daily and have learned to manage expectations upward, including saying 'no' to unrealistic deadlines.")
  3.  **Positive Result**: ("This has reduced my delay rate by 90% and allowed me to focus on high-priority tasks.")

### 7.4 Practice: How to Answer "Why are you leaving your last job?"

- **The Trap**: Complaining about your old company, boss, or colleagues.
- **Golden Rule**: **Be Forward-Facing**. Emphasize "pull" factors (what you want) not "push" factors (what you're running from).
- **Templates**:
  - **Template 1 (Growth)**: "I've had a great 3 years at my last company and learned A and B. I've now reached a plateau, and this role at your company provides the challenge in (New Area, e.g., 0-to-1) that I've identified as the next step in my career plan."
  - **Template 2 (Value Match)**: "I respect my previous company, but my core passion (e.g., B2B SaaS) and the company's strategic direction (e.g., Gaming) began to diverge. I want to dedicate my focus to the B2B space, and your company is a leader in this exact field."

### 7.5 Practice: How to "Ask the Interviewer" (Reverse Questions)

- **The Trap**: Asking nothing, or only asking about "salary" and "vacation."
- **Golden Rule**: This is your **last chance** to show your "business acumen" and "Internal Skills" (内功).
- **High-Score Questions**:
  1.  (On Business) "If I were to join, what is the \#1 'pain point' you would want me to solve in the first 90 days?"
  2.  (On Team) "Could you describe the team structure? What other roles (e.g., PM, Designer) would I be collaborating with most closely?"
  3.  (On Challenge) "What do you see as the biggest challenge for this role (or this team) in the next year?"

---

## Part 8: Salary & Offer

<!-- RAG_METADATA:{"category":"salary_offer", "lang":"en"} -->

### 8.1 Core Principle: Information Asymmetry is Value

Negotiation is a game of information. The more research you do on market rates, the more leverage you have. **Never enter a negotiation unprepared.**

### 8.2 Practice: How to Research Your Salary (Do Research)

- **Method 1 (Market Benchmark)**: Use salary databases like Glassdoor, LinkedIn Salary Insights, and Payscale to research the compensation range for your "Role + Location + Experience Level".
- **Method 2 (Company Benchmark)**: If possible, check the company's pay transparency data (required by law in some states/countries).
- **Method 3 (Industry Trends)**: Understand the salary growth trends for your industry (e.g., in 2025, tech and healthcare are seeing high growth).

### 8.3 Practice: How to Answer "What are your salary expectations?"

- **The Trap**: Giving a number too early, or giving a single, fixed number (e.g., "$100k").
- **Golden Rule 1 (Give a Range)**: Always provide a well-researched "range," not a single number. The bottom of this range should be a number you are "okay" with, and the top should be what you are "excited" about.
- **Golden Rule 2 (Emphasize Value)**: Reiterate your value _before_ stating the range.
- **Answer Template**:
  > "(Emphasize Value) Based on my understanding of the role, it requires (Key JD Skill A) and (B). As we've discussed, I have X years of experience in A and a proven track record of (Z Result) in B.
  > (Give Range) Given my research on the market rate in (Your City) and the value I can bring, I am targeting a salary range in the area of ($X) to ($Y) per year. Of course, I am highly interested in this opportunity and am open to discussing the total compensation package."

### 8.4 Practice: How to Answer "What is your current salary?"

- **The Trap**: Revealing your current salary (especially if you are underpaid).
- **Golden Rule (Politely Deflect)**: Shift the conversation from the "past" (your old salary) to the "future" (the market value of this new role).
- **Answer Template**:
  > "My current compensation is based on my previous company's pay structure. I would prefer to discuss compensation based on the responsibilities of this new role, its challenges, and the market rate for (Your City). My research indicates the range for this position is typically between $X and $Y."

### 8.5 Practice: Negotiating Total Compensation (TC)

- **Core Principle**: Don't just focus on "base salary". Total Compensation (TC) determines your actual earnings.
- **Negotiating Levers** (if base pay is stuck, negotiate these):
  1.  **Performance Bonus**: What is the "guaranteed" percentage?
  2.  **Equity/Stock Options**: What is the total grant value and the vesting schedule?
  3.  **Benefits**: Extra vacation days, remote work stipends, professional development funds, better health insurance, flexible/hybrid schedules.
  4.  **Sign-on Bonus**: To compensate for bonuses or stock you are leaving behind.

---
