
export const MOCK_RESULT_DATA = {
  overall_assessment:
    "Your background in high-concurrency systems and microservices architecture is a strong match for this Senior Backend Engineer role. Your experience with optimizing payment systems directly addresses their need for scalability. However, the JD emphasizes Kubernetes and Cloud-Native technologies, which are less prominent in your resume.",
  score: 85,
  highlights: [
    {
      point: "High Concurrency Experience",
      evidence: "Optimized payment system QPS by 5x using MQ and caching strategies.",
      section: "Project Experience",
    },
    {
      point: "System Stability",
      evidence: "Reduced order failure rate to under 0.01% during peak traffic.",
      section: "Work Experience",
    },
    {
      point: "Architecture Refactoring",
      evidence: "Led the migration from monolithic DB to a distributed solution.",
      section: "Project Experience",
    },
  ],
  gaps: [
    {
      point: "Cloud Native / K8s",
      evidence: "JD requires deep K8s knowledge; resume focuses more on traditional VM/Docker deployments.",
      tip: {
        interview: "Highlight your understanding of container orchestration concepts even if hands-on K8s experience is limited.",
        resume: "Add a 'Skills' section mentioning familiarity with K8s concepts if applicable.",
      },
    },
  ],
  recommendations: [
    "Emphasize your architectural decision-making process in the system design interview.",
    "Prepare a case study on how you handled the 'cold/hot data separation' project.",
  ],
  dm_script:
    "Hi [Hiring Manager], I'm a Backend Engineer with 5 years of experience specializing in high-concurrency payment systems (5x QPS boost). I noticed you're looking for someone to scale your transaction infrastructure, which aligns perfectly with my recent work on [Project Name]. I'd love to connect and share how I solved similar scalability challenges.",
}

export const MOCK_INTERVIEW_DATA = {
  radar: {
    core_challenges: [
      {
        challenge: "System Scalability",
        why_important: "The platform is experiencing rapid user growth.",
        your_angle: "Discuss your '5x QPS optimization' experience.",
      },
      {
        challenge: "Data Consistency",
        why_important: "Financial transactions require zero data loss.",
        your_angle: "Explain your Event Sourcing implementation.",
      },
    ],
    interview_rounds: [
      {
        round_name: "Technical Deep Dive",
        interviewer_role: "Tech Lead",
        focus_points: ["System Design", "Database Locking", "Concurrency Control"],
      },
      {
        round_name: "Behavioral",
        interviewer_role: "Hiring Manager",
        focus_points: ["Conflict Resolution", "Project Ownership"],
      },
    ],
    hidden_requirements: [
      "Ability to mentor junior engineers",
      "Experience with on-call rotations",
    ],
  },
  hook: {
    ppf_script:
      "**Present:** Currently, I am a Senior Backend Engineer at [Current Co], leading the payment core team.\n**Past:** Previously, I specialized in database optimization and successfully refactored a monolithic system.\n**Future:** I am looking to apply my high-concurrency experience to a larger-scale platform like yours.",
    key_hooks: [
      {
        hook: "5x QPS Optimization",
        evidence_source: "Payment System Project",
      },
    ],
    delivery_tips: ["Maintain eye contact", "Speak confidently about metrics"],
  },
  evidence: [
    {
      story_title: "Payment System Optimization",
      matched_pain_point: "Scalability",
      star: {
        situation: "System timeout rate hit 2% during peak sales.",
        task: "Ensure stability and reduce latency.",
        action: "Implemented cold/hot data separation and introduced MQ.",
        result: "QPS capacity increased 5x, zero downtime.",
      },
      quantified_impact: "5x QPS, 0.01% failure rate",
      source: "detailed_resume",
    },
  ],
  defense: [
    {
      weakness: "Limited K8s Experience",
      anticipated_question: "How would you deploy this in a Kubernetes environment?",
      defense_script:
        "While my hands-on experience is mainly with Docker Swarm, I understand K8s concepts like Pods and Services...",
      supporting_evidence: "Self-study certification in progress",
    },
  ],
  reverse_questions: [
    {
      question: "What is the biggest technical debt the team is currently facing?",
      ask_intent: "Show interest in problem-solving",
      listen_for: "Honesty and technical depth",
    },
  ],
  knowledge_refresh: [
    {
      topic: "Event Sourcing",
      key_points: ["Append-only log", "Replay events to rebuild state"],
      relevance: "Crucial for financial systems",
    },
  ],
}
