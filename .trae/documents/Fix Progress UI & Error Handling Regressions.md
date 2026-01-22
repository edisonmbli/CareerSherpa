# Fix Progress UI & Error Handling Regressions

## Problem Analysis
The previous refactoring introduced several regressions:
1.  **Store Status Conflict**: `workbench.store.ts` forces status to `MATCH_STREAMING` upon receiving *any* token, even for `job_vision_summary` (which should remain in a summary phase). This causes the UI to jump to "Match" state prematurely.
2.  **TaskId Disconnect**: `ServiceDisplay.tsx` and `useSseStream` have conflicting logic for handling the transition from Summary to Match. `ServiceDisplay` holds onto the `job_` ID while `useSseStream` auto-switches to `match_`, breaking the event stream connection.
3.  **Missing Progress Simulation**: Progress simulation is not triggered for `OCR_PENDING` or `SUMMARY_PENDING` stages, leading to a static progress bar.
4.  **Queue Feedback**: Users lack immediate "Queued" feedback because the `QUEUED` state is not explicitly handled or emitted.

## Implementation Plan

### Phase 1: Store & State Logic Repair
**Goal**: Ensure correct state transitions and prevent premature jumping to "Match" phase.
1.  **Update `lib/stores/workbench.store.ts`**:
    *   Modify `ingestEvent` to handle `token` events contextually. Do **not** force `MATCH_STREAMING` if the current status is `SUMMARY_PENDING` (or related). Instead, update `streamingResponse` while maintaining the current phase.
    *   Add `startProgressSimulation()` calls for `OCR_PENDING` and `SUMMARY_PENDING` in `ingestEvent`.
    *   Refine `appendStreamToken` to strictly append (avoiding duplication logic issues) or use a more robust duplicate check.

2.  **Update `lib/utils/workbench-stage.ts`**:
    *   Refine `M9_STATUS_CONFIG` to include `SUMMARY_PENDING` (15%) and `OCR_PENDING` (5%) with `useDynamic: true`.
    *   Add logic to `deriveGlobalStatusMessage` to handle "Queued" messages if `statusDetail` indicates it.

### Phase 2: UI & Stream Panel Enhancement
**Goal**: Fix the "Disconnect" and ensure smooth streaming.
1.  **Update `components/app/ServiceDisplay.tsx`**:
    *   Modify `computedTaskId` logic: If `status` is `SUMMARY_COMPLETED` (or related), explicitly return the `match_` task ID. This synchronizes the frontend with `useSseStream`'s auto-switch.
    *   Ensure `StreamPanel` receives the correct content for `job_vision_summary` (which will now be in `streamingResponse` but under `SUMMARY_PENDING` status).

2.  **Update `components/workbench/StreamPanel.tsx`**:
    *   Optimize the "Typewriter" effect in `useEffect`. Increase the minimum step size and frequency to prevent "stuttering" during high-speed token bursts.
    *   Ensure `ocr` and `summary` modes correctly display streaming content if provided.

### Phase 3: Immediate Feedback (Queue & Rate Limit)
**Goal**: Reduce user anxiety by showing immediate status.
1.  **Update `lib/queue/producer.ts`**:
    *   Emit a `status` event (e.g., `code: 'queued'`) to the SSE channel immediately after `client.queue().enqueueJSON(...)` succeeds. This gives immediate feedback before the worker starts.

2.  **Update `lib/worker/handlers.ts`**:
    *   (Optional) Verify `job_vision_summary` emits `SUMMARY_PENDING` correctly (already confirmed in analysis, but will double-check during implementation).

## Verification Plan
1.  **Manual Test**: Run a "Free Tier" task (Job Vision Summary -> Match).
    *   Verify "Queued" appears immediately.
    *   Verify `job_vision_summary` streams text without jumping to "Match" UI.
    *   Verify smooth transition to `job_match` streaming.
    *   Verify progress bar moves smoothly throughout.
