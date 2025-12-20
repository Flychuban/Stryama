# Stryama Frontend Implementation Specification

## Core Design Principles

1.  **Conversation-First Design** - Natural language is the primary interface.
2.  **Immediate Visual Feedback** - Real-time previews build trust.
3.  **Ownership** - Prominent "Export" and "Deploy" actions to emphasize user ownership.
4.  **Simplicity** - Clean, ShadCN/UI-based aesthetic.

## Screen Layouts

### Main Editor (`/editor/[projectId]`)

- **Layout**: Split screen (Resizable panels).
- **Left Panel**:
  - **Chat Interface**: `ChatPanel`, `PromptHistory`, `AILoadingAnimation`.
  - **File Explorer**: Tree view of generated files.
- **Right Panel**:
  - **Preview**: `PreviewCodePanel` (iframe based).
  - **Code View**: Read-only syntax highlighted code.
  - **Tabs**: Switch between Preview and Code.
- **Header**: Project title, GitHub/Netlify export buttons, User profile.

### Dashboard (`/dashboard`)

- **Layout**: Grid of `ProjectCard` components.
- **Features**:
  - `CreateProjectDialog`: Modal to start new apps.
  - `UsageDashboard`: Visualizes token usage and limits.
  - Filtering/Sorting controls.

### Integrations

- **GitHub**: `GitHubConnectButton`, `GitHubExportDialog`.
- **Netlify**: `NetlifyConnectButton`, `NetlifyDeployDialog`.

## Component Specifications

### Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **UI Library**: ShadCN/UI (Radix Primitives)
- **Styling**: Tailwind CSS 3.4
- **State Management**: TanStack React Query (Server state), React Context/Hooks (Local state).
- **Icons**: Lucide React

### Core Components

#### `ChatPanel`

- **Role**: Main interaction point.
- **State**: Manages message history list.
- **Input**: Auto-expanding textarea.
- **Streaming**: Displays real-time text chunks from AI.

#### `PreviewCodePanel`

- **Role**: Renders the user app.
- **Implementation**: Sandboxed `<iframe>` pointing to E2B preview URL.
- **Features**: Reload button, Open in new tab.

#### `GitHubExportDialog`

- **Role**: Handles export flow.
- **States**:
  - _Connect_: OAuth button if not connected.
  - _Configure_: Repo name/privacy inputs.
  - _Exporting_: Progress bar.
  - _Success_: Link to new repo.

#### `UsageBanner`

- **Role**: Alert user when approaching plan limits.
- **Logic**: Checks `UserUsage` data from TRPC.

## Design System

### Colors (Tailwind Variables)

- `--primary`: Indigo/Violet shades.
- `--background`: White/Gray-50 (Light), Gray-950 (Dark).
- `--sidebar`: Distinct background for navigation context.

### Typography

- **Font**: Inter (Sans), JetBrains Mono (Code).

## Responsive Strategy

- **Desktop**: Full split view.
- **Mobile**: Tabbed view (`MobileEditorTabs`) switching between Chat and Preview.

## Accessibility

- **Compliance**: WCAG AA via ShadCN primitives.
- **Focus**: Visible focus rings on all inputs/buttons.
- **Theme**: Dark mode support via `next-themes`.
