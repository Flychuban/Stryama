# E2B Sandbox Integration - Implementation Plan

## Executive Summary

This document outlines the comprehensive implementation plan for integrating E2B sandbox environments into Stryama, enabling real-time code preview and execution. The implementation is divided into **6 distinct phases**, prioritized by dependencies and business value.

**Timeline**: 6-8 weeks
**Complexity**: High
**Business Impact**: Critical - Core functionality

---

## Current State Analysis

### ✅ Already Implemented

- **Authentication**: Full Clerk integration
- **Database Models**: `Project`, `File`, `AIGeneration`, `Sandbox` models exist
- **AI Integration**: Comprehensive Claude Code SDK integration
- **UI Components**: `PreviewPanel`, `CodeView`, `PromptPanel` components ready
- **API Infrastructure**: tRPC routers for `project` and `ai` operations
- **Project Management**: Full CRUD operations for projects and files

### 🚧 Missing Components (To Be Implemented)

- E2B SDK integration and configuration
- Sandbox lifecycle management service
- File synchronization system to E2B sandboxes
- Live preview URL generation and management
- Sandbox session pooling and cleanup
- Real-time preview updates
- Error handling for sandbox failures
- Resource monitoring and cost tracking

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PromptPanel  │  │  CodeView    │  │ PreviewPanel │  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  │
└─────────┼────────────────────────────────────┼──────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│                  tRPC API Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  ai.router   │  │project.router│  │sandbox.router│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼──────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│                 Service Layer                           │
│  ┌───────────────────┐      ┌────────────────────────┐  │
│  │ Claude AI Service │      │ E2B Sandbox Service    │  │
│  │ - Code Generation │      │ - Lifecycle Mgmt       │  │
│  │ - Context Analysis│      │ - File Sync            │  │
│  └───────────────────┘      │ - Preview URLs         │  │
│                             │ - Session Pooling      │  │
│                             └────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────┐         ┌──────────────────────────┐
│  Claude API      │         │  E2B Cloud Platform      │
│  - code.generate │         │  - Sandbox Creation      │
└──────────────────┘         │  - File Operations       │
                             │  - Public URLs           │
                             └──────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Foundation & Core Integration (Week 1-2)

**Priority**: CRITICAL - Everything depends on this
**Story Coverage**: 3.1, 3.2

#### Objectives

- Install and configure E2B SDK
- Create sandbox service infrastructure
- Implement basic sandbox lifecycle management
- Establish error handling patterns

#### Tasks

##### 1.1 E2B SDK Installation & Configuration

**Files to Create/Modify:**

- `src/lib/integrations/e2b/config.ts` - E2B configuration and environment validation
- `src/lib/integrations/e2b/client.ts` - E2B client singleton
- `.env.example` - Add E2B_API_KEY
- `package.json` - Add @e2b/code-interpreter dependency

**Implementation Details:**

```typescript
// src/lib/integrations/e2b/config.ts
import { z } from 'zod';

const e2bConfigSchema = z.object({
  apiKey: z.string().min(1, 'E2B_API_KEY is required'),
  defaultTimeout: z.number().default(300_000), // 5 minutes
  maxConcurrentSandboxes: z.number().default(5),
});

export const e2bConfig = e2bConfigSchema.parse({
  apiKey: process.env.E2B_API_KEY,
  defaultTimeout: 300_000,
  maxConcurrentSandboxes: 5,
});
```

**Acceptance Criteria:**

- [ ] E2B SDK installed and version locked
- [ ] Environment variables validated on startup
- [ ] E2B client singleton created with proper error handling
- [ ] Configuration tested in development environment

##### 1.2 Sandbox Service Core Architecture

**Files to Create:**

- `src/lib/integrations/e2b/services/sandbox-manager.ts` - Core sandbox management
- `src/lib/integrations/e2b/types.ts` - TypeScript types for E2B operations
- `src/lib/integrations/e2b/errors.ts` - Custom error classes
- `src/lib/integrations/e2b/index.ts` - Public exports

**Key Functionality:**

```typescript
// Sandbox creation with template support
- createSandbox(projectId: string, options?: SandboxOptions): Promise<SandboxInstance>
// Sandbox termination
- destroySandbox(sandboxId: string): Promise<void>
// Timeout management
- extendTimeout(sandboxId: string, additionalMs: number): Promise<void>
// Health checks
- getSandboxInfo(sandboxId: string): Promise<SandboxInfo>
```

**Acceptance Criteria:**

- [ ] Can create E2B sandbox with default template
- [ ] Can destroy sandbox and cleanup resources
- [ ] Timeout extension working correctly
- [ ] Health check returns sandbox status
- [ ] Database `Sandbox` model updated with creation/destruction

##### 1.3 Database Integration

**Files to Modify:**

- `prisma/schema.prisma` - Enhance Sandbox model
- `src/server/api/routers/sandbox.ts` - NEW: Create sandbox router

**Schema Enhancements:**

```prisma
model Sandbox {
  id              String        @id @default(cuid())
  e2bId           String        @unique
  status          SandboxStatus @default(ACTIVE)
  projectId       String
  previewUrl      String?       // NEW: Store preview URL
  templateId      String?       // NEW: E2B template used
  lastActivity    DateTime      @default(now()) // NEW: For cleanup
  expiresAt       DateTime?     // NEW: Timeout tracking
  metadata        Json?         // NEW: Additional E2B metadata
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
  @@index([status])
  @@index([expiresAt])
}
```

**Acceptance Criteria:**

- [ ] Sandbox model enhanced with new fields
- [ ] Migration created and tested
- [ ] Sandbox router created with basic CRUD operations

##### 1.4 Error Handling & Retry Logic

**Files to Create:**

- `src/lib/integrations/e2b/errors/retry-handler.ts`
- `src/lib/integrations/e2b/errors/error-classifier.ts`

**Error Types to Handle:**

- E2B API failures (network, auth, quota)
- Sandbox creation failures
- Timeout errors
- Resource limit errors

**Acceptance Criteria:**

- [ ] Retry logic implemented with exponential backoff
- [ ] Errors classified and user-friendly messages provided
- [ ] Fallback strategies documented

---

### Phase 2: File Synchronization System (Week 2-3)

**Priority**: HIGH - Required for preview functionality
**Story Coverage**: 3.3

#### Objectives

- Implement file upload to E2B sandboxes
- Create incremental sync for performance
- Handle file conflicts and validation

#### Tasks

##### 2.1 File Upload Service

**Files to Create:**

- `src/lib/integrations/e2b/services/file-sync.ts`
- `src/lib/integrations/e2b/utils/file-validator.ts`

**Key Functionality:**

```typescript
// Upload all project files to sandbox
- syncAllFiles(sandboxId: string, projectId: string): Promise<SyncResult>
// Upload only changed files
- syncIncrementalFiles(sandboxId: string, changedFiles: File[]): Promise<SyncResult>
// Validate file before upload
- validateFile(file: File): ValidationResult
// Build proper file structure in sandbox
- buildFileTree(files: File[]): FileTree
```

**Implementation Approach:**

1. Fetch all files from database for project
2. Validate file sizes and content
3. Upload to E2B using `sandbox.files.write()`
4. Track successful uploads in database
5. Handle partial failures gracefully

**Acceptance Criteria:**

- [ ] Can upload all project files to sandbox
- [ ] Incremental sync only uploads changed files
- [ ] Large files handled with streaming
- [ ] File validation prevents malicious content
- [ ] Sync errors don't break entire operation

##### 2.2 File Watching & Change Detection

**Files to Create:**

- `src/lib/integrations/e2b/services/change-detector.ts`

**Functionality:**

- Detect file changes in database
- Queue files for sync
- Batch multiple changes efficiently

**Acceptance Criteria:**

- [ ] Detects new, modified, deleted files
- [ ] Batches multiple changes within 1 second
- [ ] Doesn't sync unchanged files

##### 2.3 Conflict Resolution

**Files to Create:**

- `src/lib/integrations/e2b/utils/conflict-resolver.ts`

**Conflict Types:**

- Simultaneous file updates
- File deletion during sync
- Sandbox destroyed during sync

**Acceptance Criteria:**

- [ ] Handles simultaneous updates gracefully
- [ ] Rollback on critical failures
- [ ] User notified of conflicts

---

### Phase 3: Live Preview & URL Generation (Week 3-4)

**Priority**: HIGH - Core user-facing feature
**Story Coverage**: 3.4, 3.7

#### Objectives

- Generate public URLs for sandboxes
- Integrate preview URLs into PreviewPanel component
- Support multiple frameworks (Next.js, React, vanilla)

#### Tasks

##### 3.1 Preview URL Generation

**Files to Create:**

- `src/lib/integrations/e2b/services/preview-manager.ts`

**Key Functionality:**

```typescript
// Start development server in sandbox and get URL
- startPreviewServer(sandboxId: string, framework: Framework): Promise<PreviewUrl>
// Check if preview is ready
- checkPreviewHealth(previewUrl: string): Promise<boolean>
// Get logs from preview server
- getPreviewLogs(sandboxId: string): Promise<string[]>
```

**Framework Support:**

- **Next.js**: Run `npm run dev` on port 3000
- **React (Vite)**: Run `npm run dev` on port 5173
- **Vanilla**: Run `python -m http.server 3000`

**Implementation:**

1. Detect framework from project files
2. Install dependencies in sandbox (`npm install`)
3. Start appropriate dev server
4. Get public URL using `sandbox.getHost(port)`
5. Wait for server to be ready (health check)
6. Return preview URL

**Acceptance Criteria:**

- [ ] Next.js apps preview correctly
- [ ] React apps preview correctly
- [ ] Static HTML apps preview correctly
- [ ] Preview URLs accessible from browser
- [ ] Health check confirms server ready

##### 3.2 Preview Panel Integration

**Files to Modify:**

- `src/components/editor/PreviewPanel.tsx`
- `src/app/editor/[projectId]/page.tsx`

**Changes:**

1. Replace `srcDoc` iframe with `src` pointing to E2B URL
2. Add loading states during preview generation
3. Add error handling for failed previews
4. Add refresh button to restart preview

**Acceptance Criteria:**

- [ ] Preview loads E2B sandbox URL in iframe
- [ ] Loading states show during preview generation
- [ ] Errors display user-friendly messages
- [ ] Refresh button works correctly

##### 3.3 Framework Detection

**Files to Create:**

- `src/lib/integrations/e2b/utils/framework-detector.ts`

**Detection Logic:**

- Check for `next.config.js` → Next.js
- Check for `vite.config.ts` → React/Vite
- Check for `index.html` only → Vanilla

**Acceptance Criteria:**

- [ ] Correctly identifies Next.js projects
- [ ] Correctly identifies React projects
- [ ] Correctly identifies vanilla projects
- [ ] Defaults to safe fallback

---

### Phase 4: Sandbox Lifecycle & Session Management (Week 4-5)

**Priority**: MEDIUM - Performance optimization
**Story Coverage**: 3.2, 3.9

#### Objectives

- Implement sandbox pooling for faster startup
- Add automatic cleanup for expired sandboxes
- Persist sandbox state across sessions

#### Tasks

##### 4.1 Sandbox Pooling

**Files to Create:**

- `src/lib/integrations/e2b/services/sandbox-pool.ts`

**Strategy:**

- Pre-create 2-3 sandboxes on application start
- Assign sandbox from pool when user needs one
- Create new sandbox if pool empty
- Return sandbox to pool when project closed

**Acceptance Criteria:**

- [ ] Pool maintains minimum 2 ready sandboxes
- [ ] Cold start time reduced from 20s to ~2s
- [ ] Pool respects max concurrent limit
- [ ] Unused sandboxes cleaned up after 5 minutes

##### 4.2 Automatic Cleanup

**Files to Create:**

- `src/lib/integrations/e2b/services/cleanup-scheduler.ts`

**Cleanup Rules:**

- Destroy sandboxes inactive > 10 minutes
- Destroy sandboxes for deleted projects
- Clean up database records for destroyed sandboxes

**Implementation:**

- Cron job every 5 minutes
- Query database for expired sandboxes
- Call `destroySandbox()` for each
- Update database status

**Acceptance Criteria:**

- [ ] Cron job runs reliably
- [ ] Expired sandboxes destroyed
- [ ] Database records updated
- [ ] Resource limits respected

##### 4.3 Session Persistence

**Files to Modify:**

- `src/server/api/routers/sandbox.ts`

**New Endpoints:**

- `sandbox.getOrCreate` - Get existing or create new
- `sandbox.restore` - Restore previous session
- `sandbox.persist` - Save current state

**Acceptance Criteria:**

- [ ] User returns to same sandbox session
- [ ] Sandbox state persisted in database
- [ ] Old sessions cleaned up properly

---

### Phase 5: Real-Time Updates & Error Handling (Week 5-6)

**Priority**: MEDIUM - User experience enhancement
**Story Coverage**: 3.8, 3.11

#### Objectives

- Implement automatic preview updates on code changes
- Add comprehensive error handling and debugging
- Show console output from preview

#### Tasks

##### 5.1 Automatic Preview Updates

**Files to Create:**

- `src/lib/integrations/e2b/services/preview-updater.ts`

**Implementation:**

1. Listen for file changes in project
2. Sync changed files to sandbox
3. Hot reload preview (framework-dependent)
4. Show loading state during update

**Acceptance Criteria:**

- [ ] Preview updates within 3 seconds of file change
- [ ] Loading indicator shows during update
- [ ] Errors don't break preview
- [ ] User can manually refresh

##### 5.2 Error Handling & Debugging

**Files to Create:**

- `src/lib/integrations/e2b/services/error-analyzer.ts`
- `src/components/editor/PreviewErrorPanel.tsx`

**Error Categories:**

- Syntax errors (caught at generation)
- Build errors (npm install failed)
- Runtime errors (app crashed)
- Network errors (E2B unavailable)

**Debugging Tools:**

- Console output viewer
- Build logs viewer
- Error stack traces
- Suggested fixes

**Acceptance Criteria:**

- [ ] All error types caught and displayed
- [ ] User sees helpful error messages
- [ ] Console output visible in UI
- [ ] Suggested fixes provided

##### 5.3 Preview Queue Management

**Files to Create:**

- `src/lib/integrations/e2b/services/preview-queue.ts`

**Functionality:**

- Queue rapid successive preview updates
- Debounce updates (1 second delay)
- Cancel outdated updates
- Show queue status to user

**Acceptance Criteria:**

- [ ] Rapid changes don't overwhelm system
- [ ] Latest update always applied
- [ ] Queue visible to user
- [ ] No race conditions

---

### Phase 6: Advanced Features & Polish (Week 6-8)

**Priority**: LOW - Nice-to-have features
**Story Coverage**: 3.10, 3.12

#### Objectives

- Add analytics and monitoring
- Implement mobile/responsive testing
- Add cost tracking

#### Tasks

##### 6.1 Analytics & Monitoring

**Files to Create:**

- `src/lib/integrations/e2b/services/analytics.ts`

**Metrics to Track:**

- Sandbox creation time
- Preview generation time
- Error rates by type
- Resource usage per project
- User engagement with previews

**Acceptance Criteria:**

- [ ] All metrics logged to database
- [ ] Dashboard shows analytics
- [ ] Alerts for high error rates

##### 6.2 Mobile & Responsive Testing

**Files to Modify:**

- `src/components/editor/PreviewPanel.tsx`

**Features:**

- Device simulation (already exists, enhance)
- Multiple viewports side-by-side
- Touch interaction simulation
- Network throttling

**Acceptance Criteria:**

- [ ] Can preview in mobile/tablet sizes
- [ ] Orientation changes work
- [ ] Touch events simulated

##### 6.3 Cost Tracking & Optimization

**Files to Create:**

- `src/lib/integrations/e2b/services/cost-tracker.ts`

**Functionality:**

- Track E2B usage per user
- Calculate costs
- Show usage dashboard
- Implement usage limits

**Acceptance Criteria:**

- [ ] Usage tracked accurately
- [ ] Costs calculated correctly
- [ ] Limits enforced

---

## API Router Structure

### New Router: `sandbox.router.ts`

```typescript
export const sandboxRouter = createTRPCRouter({
  // Create or get existing sandbox for project
  getOrCreate: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  // Get sandbox status
  getStatus: protectedProcedure
    .input(z.object({ sandboxId: z.string() }))
    .query(async ({ ctx, input }) => {
      /* ... */
    }),

  // Start preview server
  startPreview: protectedProcedure
    .input(z.object({ sandboxId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  // Sync files to sandbox
  syncFiles: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string(),
        files: z.array(fileSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  // Destroy sandbox
  destroy: protectedProcedure
    .input(z.object({ sandboxId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  // Extend timeout
  extendTimeout: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string(),
        additionalMs: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      /* ... */
    }),

  // Get preview logs
  getLogs: protectedProcedure
    .input(z.object({ sandboxId: z.string() }))
    .query(async ({ ctx, input }) => {
      /* ... */
    }),
});
```

---

## Integration with Existing Code

### Modified Files

#### `src/server/api/routers/ai.ts`

**Changes:**

- After successful code generation, trigger sandbox file sync
- Return preview URL along with generated files
- Handle sandbox creation if needed

```typescript
// After line 118 (after aiGeneration.create)
if (input.projectId) {
  // Sync files to sandbox and get preview URL
  const sandbox = await sandboxService.getOrCreate(input.projectId);
  await sandboxService.syncFiles(sandbox.e2bId, result.data.files);
  const previewUrl = await sandboxService.startPreview(sandbox.e2bId);

  return {
    ...result.data,
    databaseId: aiGeneration.id,
    conflicts,
    warning,
    previewUrl, // NEW
  };
}
```

#### `src/app/editor/[projectId]/page.tsx`

**Changes:**

- Fetch sandbox status on load
- Pass preview URL to PreviewPanel
- Handle preview errors

---

## Testing Strategy

### Unit Tests

- [ ] E2B client initialization
- [ ] Sandbox lifecycle operations
- [ ] File sync logic
- [ ] Error handling
- [ ] Framework detection

### Integration Tests

- [ ] End-to-end sandbox creation → file sync → preview
- [ ] AI generation → sandbox update → preview refresh
- [ ] Sandbox cleanup and garbage collection
- [ ] Error recovery scenarios

### Manual Testing

- [ ] Create Next.js project and preview
- [ ] Create React project and preview
- [ ] Create vanilla HTML project and preview
- [ ] Test error scenarios (network failure, timeout, etc.)
- [ ] Test cleanup and session management

---

## Environment Variables

Add to `.env.example` and `.env`:

```bash
# E2B Configuration
E2B_API_KEY=your_e2b_api_key_here

# E2B Settings (optional, with defaults)
E2B_DEFAULT_TIMEOUT=300000  # 5 minutes in milliseconds
E2B_MAX_CONCURRENT_SANDBOXES=5
E2B_POOL_SIZE=2
```

---

## Dependencies

### New Packages to Install

```json
{
  "dependencies": {
    "@e2b/code-interpreter": "^2.0.0"
  }
}
```

---

## Risk Assessment

### High Risks

1. **E2B API Quota Limits** - Mitigation: Implement strict usage limits and pooling
2. **Preview Generation Timeouts** - Mitigation: Show progress, allow manual retry
3. **Cost Overruns** - Mitigation: Track usage, implement limits per user
4. **Sandbox Security** - Mitigation: Use E2B's built-in isolation, validate all inputs

### Medium Risks

1. **Complex Framework Support** - Mitigation: Start with Next.js, add others incrementally
2. **File Sync Performance** - Mitigation: Implement incremental sync, batching
3. **Error Recovery Complexity** - Mitigation: Comprehensive logging and monitoring

### Low Risks

1. **UI/UX Issues** - Mitigation: User testing, iterative improvements
2. **Browser Compatibility** - Mitigation: Standard iframe usage

---

## Success Metrics

### Performance

- [ ] Sandbox creation < 3 seconds (with pooling)
- [ ] Preview generation < 15 seconds
- [ ] File sync < 2 seconds (incremental)
- [ ] Preview update < 5 seconds

### Reliability

- [ ] 99% sandbox creation success rate
- [ ] < 1% preview failures
- [ ] Zero data loss during sync

### User Experience

- [ ] Clear error messages for all failures
- [ ] Loading states for all operations
- [ ] Preview works across all supported frameworks

---

## Questions for Clarification

1. **E2B Template Strategy**: Should we create custom E2B templates for each framework, or use the default template?
   - **Recommendation**: Start with default template, create custom templates in Phase 6 if needed

2. **Preview Timeout Policy**: How long should we keep sandboxes alive?
   - **Recommendation**: 5 minutes default, extend on user activity

3. **Concurrent Sandbox Limits**: How many sandboxes per user?
   - **Recommendation**: Free tier: 1 concurrent, Pro: 3 concurrent

4. **File Size Limits**: Maximum file size to sync?
   - **Recommendation**: 5MB per file, 50MB total project size

5. **Framework Priority**: Which frameworks to support first?
   - **Recommendation**: Next.js (Phase 3), React (Phase 4), Vanilla (Phase 5)

---

## Next Steps

1. **Review this plan** with the team and get approval
2. **Set up E2B account** and get API key
3. **Create Phase 1 branch** and begin implementation
4. **Daily standups** to track progress and blockers
5. **Weekly demos** to stakeholders

---

## Conclusion

This implementation plan provides a structured approach to integrating E2B sandboxes into Stryama. By breaking the work into 6 phases, we can deliver incremental value while managing complexity and risk.

**Estimated Timeline**: 6-8 weeks
**Team Size**: 1-2 developers
**Priority**: Phase 1-3 are critical, Phase 4-6 are enhancements

The plan follows the architecture document's principles, maintains type safety throughout, and integrates seamlessly with existing Claude AI code generation functionality.
