# M9 Progress UI Enhancement Implementation Plan

## 1. Requirement Understanding
The goal is to provide a granular, real-time UI status update for the M9 (Match) process, differentiating between Free and Paid tiers.
- **Free Tier**: Vision Summary -> Match.
- **Paid Tier**: OCR -> Job Summary -> Pre-Match -> Match.
- **Key Missing Features**: "Queued" status visibility, precise stage tracking (Vision vs. Summary, Pre-Match), and persistent content display during transitions.

## 2. Gap Analysis

| Feature | Expectation | Current Reality | Action Required |
| :--- | :--- | :--- | :--- |
| **Status Granularity** | Distinct `JOB_VISION`, `PREMATCH` states | Overloaded `SUMMARY` state | Add `JOB_VISION_*` and `PREMATCH_*` to `ExecutionStatus`. |
| **Queue Feedback** | "Queued" status displayed immediately after enqueue | Hidden; only shows active state | Update `producer.ts` to emit specific queued events; Front-end to handle `code: 'queued'`. |
| **Vision Stage** | Explicit "Job Vision" stage in UI | Treated as generic "Job Summary" | Use new `JOB_VISION` status to render specific UI text. |
| **Pre-Match Stage** | Explicit "Pre-Match" stage in UI (Paid tier) | Non-existent / merged into Match | Use new `PREMATCH` status; update `summary.ts` to transition to this state. |
| **Content Retention** | StreamPanel keeps previous content until next stream starts | Content clears/flashes on transition | Update `StreamPanel` to cache/hold previous content. |
| **Progress Logic** | Smooth 0-100% mapping across multi-stage pipelines | Simple 0-100% per stage | Update `workbench-stage.ts` with multi-stage weighted progress logic. |

## 3. Implementation Steps

### Phase 1: Schema & Backend State (Priority)
1.  **Update Prisma Schema**:
    -   Add `JOB_VISION_PENDING`, `JOB_VISION_COMPLETED`, `JOB_VISION_FAILED` to `ExecutionStatus`.
    -   Add `PREMATCH_PENDING`, `PREMATCH_COMPLETED`, `PREMATCH_FAILED` to `ExecutionStatus`.
    -   *Note*: `PREMATCH_STREAMING` is not strictly needed if we treat it as `PENDING` with streaming events, but for consistency with `MATCH_STREAMING`, we can add it or just use `PREMATCH_PENDING` + streaming flag. Let's stick to `PREMATCH_PENDING` for simplicity unless streaming requires a distinct DB state (usually it doesn't).
2.  **Update Backend Logic**:
    -   `handlers.ts`: Map `job_vision_summary` template to `JOB_VISION_PENDING`. Map `pre_match_audit` to `PREMATCH_PENDING`.
    -   `producer.ts`: Emit `queued` events with specific codes (`job_vision_queued`, `prematch_queued`, etc.).
    -   `summary.ts`:
        -   For Free Tier: Transition to `JOB_VISION_COMPLETED` on success.
        -   For Paid Tier: Transition to `PREMATCH_PENDING` (enqueue Pre-Match task).
    -   `pre_match.ts` (New/Update): Handle Pre-Match execution and transition to `PREMATCH_COMPLETED` -> `MATCH_PENDING`.

### Phase 2: Frontend State & UI
1.  **Update `workbench.store.ts`**:
    -   Handle new statuses in `ingestEvent`.
    -   Implement "content retention" logic: When switching tasks, do not clear `streamingResponse` immediately if it's a transition (e.g., Vision -> Match).
2.  **Update `workbench-stage.ts`**:
    -   Implement weighted progress logic:
        -   Free: Vision (0-40%) -> Match (40-100%).
        -   Paid: OCR (0-10%) -> Summary (10-35%) -> PreMatch (35-60%) -> Match (60-100%).
    -   Map new statuses to UI text (i18n keys).
3.  **Update `StreamPanel.tsx`**:
    -   Support "Retention Mode": Accept `previousContent` prop or handle internal state to keep showing old data until new stream tokens arrive.

### Phase 3: Verification
-   Simulate Free Tier flow: Verify Vision -> Match transition and progress bar.
-   Simulate Paid Tier flow: Verify OCR -> Summary -> PreMatch -> Match transition.

## 4. Schema Changes (Request for User)
Please apply the following changes to `prisma/schema.prisma` before I proceed with code changes:

```prisma
enum ExecutionStatus {
  IDLE
  // ... existing ...
  JOB_VISION_PENDING
  JOB_VISION_FAILED
  JOB_VISION_COMPLETED
  PREMATCH_PENDING
  PREMATCH_FAILED
  PREMATCH_COMPLETED
  // ... existing ...
}
```
(I will wait for you to apply this change to the database before writing code that depends on it.)
