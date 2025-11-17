# LibreChat Chat Interface Structure Documentation

## Overview
LibreChat is a modern React/TypeScript application using Vite as the build tool. The chat interface is built with:
- **UI Framework**: React 18.2
- **Styling**: Tailwind CSS + custom CSS variables
- **State Management**: Recoil (global state) + Jotai (atomic state) + React Hook Form (form state)
- **UI Components**: Radix UI primitives + custom components
- **Routing**: React Router v6
- **Data Fetching**: TanStack React Query
- **Layout**: React Resizable Panels for dynamic layouts

---

## 1. Main Application Entry Point

### File: `/home/user/LibreChat/client/src/App.jsx`

**Purpose**: Root application component that sets up all providers and global context.

**Key Providers**:
- `QueryClientProvider` - TanStack React Query for data fetching
- `RecoilRoot` - Global state management
- `ThemeProvider` - Dark/light mode theming
- `ToastProvider` - Toast notifications
- `DndProvider` - Drag-and-drop functionality
- `RouterProvider` - React Router configuration

**Structure**:
```jsx
App → Providers → RouterProvider → Router Configuration
```

---

## 2. Main Layout Structure

### File: `/home/user/LibreChat/client/src/routes/Root.tsx`

**Layout Hierarchy**:
```
Root
├── Banner (top banner)
├── Main Container (flex row)
│   ├── Nav (Sidebar - Left)
│   └── Main Content Area (flex column, flex-1)
│       ├── MobileNav (mobile hamburger menu)
│       └── Outlet (route-specific content)
│           └── ChatView (for chat routes)
```

**Styling Classes**:
- Container: `flex` with height `calc(100dvh - bannerHeight)`
- Main area: `relative flex h-full max-w-full flex-1 flex-col overflow-hidden`

**Key Providers at Root Level**:
- `SetConvoProvider` - Conversation management
- `FileMapContext` - File upload/management
- `AssistantsMapContext` - Available assistants
- `AgentsMapContext` - Available agents
- `PromptGroupsProvider` - Prompt templates

---

## 3. Chat View Component

### File: `/home/user/LibreChat/client/src/components/Chat/ChatView.tsx`

**Main Chat Interface Component** - Orchestrates the entire chat view structure.

**Component Hierarchy**:
```
ChatView
├── Presentation (layout wrapper with SidePanelGroup)
│   ├── Header
│   ├── Main Content Area
│   │   ├── MessagesView (for conversations with messages)
│   │   ├── Landing (for new conversations)
│   │   └── LoadingSpinner
│   ├── ChatForm (input area)
│   ├── ConversationStarters (on landing page)
│   └── Footer
│   └── SidePanel (right panel - resizable)
│       └── Artifacts (code, visualizations)
```

**Key Props & State**:
- `index`: Current conversation index (default: 0)
- `messagesTree`: Hierarchical message structure
- `isLoading`: Loading state from query
- `isLandingPage`: Boolean for landing page view
- `centerFormOnLanding`: User preference for form positioning

**Styling Approach**:
- Flexbox layout: `flex h-full w-full flex-col`
- Conditional classes: `cn()` utility for merging Tailwind classes
- Max-width constraints: `max-w-3xl` / `max-w-4xl` for form on landing page

**Context Providers**:
- `ChatFormProvider` - Form context with React Hook Form
- `ChatContext` - Chat operations (submit, stop, regenerate)
- `AddedChatContext` - Multi-conversation support context

---

## 4. Layout Components

### 4.1 Header Component

**File**: `/home/user/LibreChat/client/src/components/Chat/Header.tsx`

**Purpose**: Top sticky header with controls and settings.

**Structure**:
```
Header
├── Left Section
│   ├── OpenSidebar (toggle button)
│   ├── HeaderNewChat (new conversation button)
│   ├── ModelSelector (dropdown to select model)
│   ├── PresetsMenu (conversation presets)
│   ├── BookmarkMenu (saved bookmarks)
│   ├── AddMultiConvo (multi-conversation mode)
│   └── ExportAndShareMenu (mobile view)
└── Right Section (desktop)
    ├── ExportAndShareMenu (desktop view)
    └── TemporaryChat (temporary conversation indicator)
```

**Styling**:
- `sticky top-0 z-10 flex h-14 w-full items-center justify-between`
- `bg-white dark:bg-gray-800`
- Responsive transitions for nav visibility
- Gap: `gap-2`, padding: `p-2`

---

### 4.2 Footer Component

**File**: `/home/user/LibreChat/client/src/components/Chat/Footer.tsx`

**Purpose**: Footer with links and legal information.

**Content**:
- Privacy Policy link
- Terms of Service link
- Custom footer content (configurable)
- Version information

**Styling**:
- `absolute bottom-0 left-0 right-0`
- `hidden sm:flex md:px-[60px]`
- Text: `text-xs text-text-primary`

---

### 4.3 Presentation Component (Layout Wrapper)

**File**: `/home/user/LibreChat/client/src/components/Chat/Presentation.tsx`

**Purpose**: Wraps chat content with resizable panel layout and artifacts support.

**Key Features**:
- **Resizable Panels**: Horizontal layout with drag handles
- **Artifact Support**: Side-by-side viewing of generated code/visualizations
- **Responsive**: Collapses panels on mobile
- **Local Storage**: Persists layout preferences

**Layout Structure**:
```
Presentation (DragDropWrapper)
└── SidePanelGroup (ResizablePanelGroup)
    ├── ResizablePanel 1: Main Chat Area (flex-1, default 97%)
    │   └── {children} → ChatView's content
    ├── ResizablePanel 2: Artifacts Panel (optional, 3%)
    │   └── Artifacts (code editor, visualizations)
    └── ResizablePanel 3: Side Panel (3%, collapsible)
        └── SidePanel (parameters, settings, etc.)
```

**Default Layout**: `[97%, 3%]` for main content and side panel.

**Styling**:
- `relative flex w-full grow overflow-hidden`
- `bg-presentation` (custom color variable)

---

## 5. Message Rendering System

### 5.1 MessagesView Component

**File**: `/home/user/LibreChat/client/src/components/Chat/Messages/MessagesView.tsx`

**Purpose**: Container for displaying the conversation message tree.

**Structure**:
```
MessagesView
├── MessagesViewProvider (context provider)
└── MessagesViewContent
    ├── Scrollable Container
    │   ├── MultiMessage (recursive message tree renderer)
    │   └── messagesEndRef (scroll anchor)
    ├── ScrollToBottom Button (sticky)
    └── ScrollBar (native scrollbar)
```

**Key Features**:
- **Scroll Management**: Custom scroll handling with debouncing
- **Scroll-to-Bottom**: Animated button to jump to latest message
- **Screenshot Support**: Screenshot functionality for conversations
- **Font Size**: Responsive font size from user preferences
- **Empty State**: "Nothing found" message for empty conversations

**Styling**:
- Scrollable: `relative flex-1 overflow-hidden overflow-y-auto`
- Container: `flex flex-col pb-9 dark:bg-transparent`
- Messages wrapper: `scrollbar-gutter-stable`

---

### 5.2 Message Component Architecture

**Files**:
- `/home/user/LibreChat/client/src/components/Chat/Messages/Message.tsx`
- `/home/user/LibreChat/client/src/components/Chat/Messages/ui/MessageRender.tsx`
- `/home/user/LibreChat/client/src/components/Chat/Messages/Content/ContentRender.tsx`

**Component Hierarchy**:
```
Message/MessageRender
├── MessageContainer (wrapper with scroll handlers)
├── (Conditional: Single or Multi-Message Layout)
│   ├── SiblingCard Layout (side-by-side for message variants)
│   │   ├── MessageRender (left variant)
│   │   └── MessageRender (right variant)
│   └── SingleMessage Layout
│       └── MessageRender
├── MessageIcon (avatar/icon)
├── MessageContent
│   ├── ContentParts (body content)
│   │   ├── Text (markdown)
│   │   ├── Code blocks
│   │   ├── Images
│   │   ├── Files
│   │   ├── Tool calls
│   │   └── Search results
│   └── EditMessage (when editing)
├── HoverButtons (copy, regenerate, etc.)
├── SiblingSwitch (navigate variants)
├── SubRow (metadata row)
└── MultiMessage (recursive children)
```

**Message Rendering Flow**:
1. `MessagesView` → `MultiMessage` (tree traversal)
2. `MultiMessage` → `Message` (individual message)
3. `Message` → `MessageRender` (render logic)
4. `MessageRender` → `MessageContent` (display content)
5. `MessageContent` → `ContentParts` (specific content types)

**Content Parts Types** (in `/home/user/LibreChat/client/src/components/Chat/Messages/Content/`):
- `Markdown.tsx` - Markdown rendering with syntax highlighting
- `MessageContent.tsx` - Main content dispatcher
- `ContentParts.tsx` - Individual content piece renderer
- `Image.tsx` - Image display with dialog
- `ImageGen.tsx` - AI-generated images
- `Files.tsx` - File attachments
- `ToolCall.tsx` - Function call visualization
- `WebSearch.tsx` - Web search results
- `MemoryArtifacts.tsx` - Memory/context information
- `Part.tsx` - Generic content part

**Styling**:
- Message wrapper: `m-auto my-2 flex justify-center p-4 py-2`
- Single/Multi: `md:max-w-5xl xl:max-w-6xl`
- Container: `text-token-text-primary w-full border-0 bg-transparent`

---

## 6. Input/Chat Form Component

### File: `/home/user/LibreChat/client/src/components/Chat/Input/ChatForm.tsx`

**Purpose**: Main user input interface for sending messages.

**Component Structure**:
```
ChatForm
├── TextareaHeader (formatting options, token count)
├── Mention Popover (user/assistant mentions)
├── PromptsCommand (command suggestions)
├── TextareaAutosize (auto-expanding input field)
├── BadgeRow (selected models/assistants/files)
│   ├── EditBadges (edit selected items)
│   └── FileBadges (attached files)
├── PopoverButtons (+ button for attachments/tools)
│   ├── AttachFileChat (file upload)
│   ├── AudioRecorder (voice input)
│   ├── ToolsDropdown (available tools/plugins)
│   └── Additional options
├── StreamAudio (audio output playback)
├── SendButton (submit message)
└── StopButton (cancel generation)
```

**Key Features**:
- **Auto-expanding Textarea**: `TextareaAutosize` component
- **Form Management**: React Hook Form with validation
- **Message History**: Auto-save functionality
- **File Attachments**: Multi-file support
- **Voice Input/Output**: Speech-to-text and text-to-speech
- **Badge System**: Visual indicators of selected models/files/assistants
- **Keyboard Shortcuts**: Various key combos (Shift+Enter for new line, etc.)
- **RTL Support**: Right-to-left language support

**State Management**:
- `badges`: Selected items (models, files, assistants)
- `isEditingBadges`: Badge editing mode
- `showStopButton`: Show/hide stop button
- `showPlusPopover`: File/tools menu visibility
- `showMentionPopover`: User mention menu visibility
- `isCollapsed`: Input area collapse state
- `visualRowCount`: Textarea line count for responsive sizing

**Styling**:
- Form wrapper: Flexible layout with conditional widths
- Input area: `w-full max-w-3xl` / `max-w-4xl`
- Buttons: Icon buttons with hover states
- Badges: Inline display with edit toggle

---

## 7. Navigation/Sidebar Component

### File: `/home/user/LibreChat/client/src/components/Nav/Nav.tsx`

**Purpose**: Left sidebar for navigation and conversation history.

**Structure**:
```
Nav
├── New Chat Button
├── Search Bar (search conversations)
├── Conversations List
│   ├── Infinite scroll loading
│   └── Conversation Items (clickable)
├── BookmarkNav (bookmarked conversations)
├── AccountSettings
└── AgentMarketplaceButton
```

**Key Features**:
- **Infinite Scroll**: Lazy load conversations
- **Search**: Filter conversations in real-time
- **Tags**: Filter by conversation tags
- **Responsive**: Mobile menu toggling
- **Bookmarks**: Quick access to saved conversations

**Sizing**:
- Desktop: `260px` width
- Mobile: `320px` width (full-width overlay)

**Styling**:
- Sidebar: Fixed position, scrollable
- Items: Hover states with accent colors
- Mobile mask: Overlay with transition animation

---

## 8. Side Panel Component (Right Panel)

### File: `/home/user/LibreChat/client/src/components/SidePanel/SidePanelGroup.tsx` & `SidePanel.tsx`

**Purpose**: Resizable right-side panel for additional settings and information.

**Structure**:
```
SidePanelGroup (ResizablePanelGroup)
├── ResizablePanel: Main Chat (order: 1)
├── ArtifactsPanel (optional, hidden on mobile)
└── SidePanel (optional, collapsible)
    ├── SidePanelNav (tabs: Parameters, Files, Agents, etc.)
    ├── Agent Panel (agent configuration)
    ├── Bookmarks Panel (saved bookmarks)
    ├── Memories Panel (conversation memory)
    ├── Files Panel (file browser)
    ├── MCP Panel (Model Context Protocol)
    ├── Parameters Panel (temperature, top_p, etc.)
    └── Each panel content
```

**Features**:
- **Resizable**: Drag handle to adjust width
- **Collapsible**: Collapse/expand for more chat space
- **Persistent Layout**: Saves to localStorage
- **Mobile**: Hidden on small screens
- **Full Collapse**: Can be fully hidden with persistent state

**Default Layout**:
- Main content: 97%
- Side panel: 3%
- Min main size: 20-30%
- Min side panel: 20%

---

## 9. Styling Architecture

### 9.1 Styling Approach

**Tailwind CSS** is the primary styling method with:
- Custom CSS variables for colors
- Custom utility classes
- Dark mode support with `dark:` prefix

### 9.2 Main CSS Files

**File**: `/home/user/LibreChat/client/src/style.css`

**Structure**:
```css
@tailwind base;           /* Base styles */
@tailwind components;     /* Component classes */
@tailwind utilities;      /* Utility classes */

/* Custom Variables */
:root {
  --white: #fff;
  --black: #000;
  --gray-*: /* color scale */
  --green-*: /* green scale */
  --red-*: /* red scale */
  --blue-*: /* blue scale */
  /* etc. */
}

/* Custom components & utilities */
```

### 9.3 Theme System

- **Dark Mode**: Automatic detection + manual toggle
- **Custom Theme**: Environment variable support for branded colors
- **CSS Variables**: Used throughout for consistent theming
- **Responsive**: Mobile-first approach with breakpoints

### 9.4 Color Variables

**Text Colors**:
- `text-token-text-primary` - Primary text
- `text-text-primary` - Primary text
- `text-text-secondary` - Secondary/muted text
- `text-text-tertiary` - Tertiary text

**Background Colors**:
- `bg-white dark:bg-gray-800` - Default backgrounds
- `bg-presentation` - Main chat area background
- `bg-transparent` - Transparent elements

**Utility Classes Used**:
- Flexbox: `flex`, `flex-col`, `flex-row`, `gap-*`
- Spacing: `p-*`, `m-*`, `px-*`, `py-*`, etc.
- Sizing: `h-*`, `w-*`, `max-w-*`, `min-h-*`, etc.
- Display: `hidden`, `flex`, `grid`, `block`, `inline-*`
- Effects: `rounded-*`, `shadow-*`, `opacity-*`, `transition-*`
- Positioning: `absolute`, `relative`, `sticky`, `z-*`
- Overflow: `overflow-hidden`, `overflow-y-auto`, `overflow-x-auto`

---

## 10. Component Hierarchy Summary

```
App.jsx
├── QueryClientProvider
├── RecoilRoot
├── ThemeProvider
├── ToastProvider
├── DndProvider
└── RouterProvider
    └── Routes
        ├── LoginRoute
        ├── DashboardRoute
        └── ChatRoute
            └── Root.tsx
                ├── Banner
                ├── Nav (Sidebar)
                └── ChatView
                    ├── Header
                    ├── Presentation
                    │   └── SidePanelGroup (ResizablePanelGroup)
                    │       ├── MessagesView
                    │       │   └── MultiMessage
                    │       │       └── Message
                    │       │           ├── MessageIcon
                    │       │           ├── MessageContent
                    │       │           ├── HoverButtons
                    │       │           └── SubRow
                    │       ├── ArtifactsPanel (Resizable)
                    │       │   └── Artifacts
                    │       └── SidePanel (Resizable, Collapsible)
                    ├── ChatForm
                    │   ├── TextareaAutosize
                    │   ├── BadgeRow
                    │   ├── PopoverButtons
                    │   ├── SendButton
                    │   └── StopButton
                    ├── ConversationStarters (or Footer)
                    └── Footer
```

---

## 11. Key Component Files Reference

### Core Chat Components
- `ChatView.tsx` - Main chat orchestrator
- `Header.tsx` - Top controls
- `Footer.tsx` - Bottom information
- `Presentation.tsx` - Layout wrapper with resizable panels
- `ChatForm.tsx` - User input form
- `Landing.tsx` - Initial empty state

### Message Components
- `Message.tsx` - Single message renderer
- `MessageRender.tsx` - Message render logic
- `MessagesView.tsx` - Messages container
- `MultiMessage.tsx` - Recursive message tree
- `MessageParts.tsx` - Message metadata
- `MessageIcon.tsx` - Message avatar/icon
- `MessageContent.tsx` - Content wrapper
- `HoverButtons.tsx` - Message action buttons
- `Feedback.tsx` - Message feedback UI
- `Fork.tsx` - Message branching UI
- `SiblingSwitch.tsx` - Navigate message variants
- `SubRow.tsx` - Message metadata row

### Input Components
- `ChatForm.tsx` - Main form
- `SendButton.tsx` - Submit button
- `StopButton.tsx` - Cancel generation
- `BadgeRow.tsx` - Selected items display
- `EditBadges.tsx` - Edit selected items
- `PopoverButtons.tsx` - Tool/file buttons
- `Mention.tsx` - User/assistant mentions
- `PromptsCommand.tsx` - Prompt suggestions
- `AudioRecorder.tsx` - Voice input
- `StreamAudio.tsx` - Voice output

### Layout Components
- `Nav.tsx` - Sidebar navigation
- `SidePanelGroup.tsx` - Resizable panel container
- `SidePanel.tsx` - Right side panel
- `ArtifactsPanel.tsx` - Code/artifact display

### Content Components (in `/Content/`)
- `Markdown.tsx` - Markdown rendering
- `ContentParts.tsx` - Content dispatcher
- `Image.tsx` - Image display
- `ToolCall.tsx` - Function call display
- `WebSearch.tsx` - Search results
- `MemoryArtifacts.tsx` - Memory display
- `MarkdownComponents.tsx` - Custom markdown renderers

---

## 12. Data Flow

### Message Data Structure
```typescript
TMessage {
  messageId: string;
  conversationId: string;
  parentMessageId?: string;
  children?: TMessage[];
  text: string;
  isCreatedByUser: boolean;
  endpoint?: string;
  model?: string;
  iconURL?: string;
  attachments?: TAttachment[];
  // ... more fields
}
```

### Message Tree Building
1. API returns flat array of messages
2. `buildTree()` utility converts to hierarchical structure
3. Each message can have multiple children (variants/branches)
4. Rendered recursively by `MultiMessage` → `Message` components

### State Management
- **Global State (Recoil)**: Conversation, chat settings, UI toggles
- **Atomic State (Jotai)**: Font size, transient UI state
- **Form State (React Hook Form)**: Input field values
- **Query State (React Query)**: API data fetching/caching

---

## 13. Responsive Behavior

### Breakpoints
- Mobile: `max-width: 768px`
- Tablet: `768px - 1024px`
- Desktop: `> 1024px`

### Layout Changes
- **Mobile**: 
  - Sidebar collapses to overlay
  - Side panel hidden
  - Artifacts shown as modal
  - Form spans full width
  
- **Desktop**:
  - Sidebar always visible (toggleable)
  - Side panel resizable
  - Artifacts shown side-by-side
  - Form centered with max-width

### Conditional Rendering
- `max-md:hidden` - Hide on mobile
- `hidden sm:flex` - Show on small+ screens
- `isSmallScreen` hook for responsive logic

---

## 14. Key Technologies & Libraries

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI Framework | 18.2.0 |
| TypeScript | Type Safety | 5.3.3 |
| Tailwind CSS | Utility-first CSS | 3.4.1 |
| Recoil | Global State | 0.7.7 |
| Jotai | Atomic State | 2.12.5 |
| React Hook Form | Form State | 7.43.9 |
| React Query | Data Fetching | 4.28.0 |
| React Router | Routing | 6.11.2 |
| Radix UI | Component Primitives | ^1.0.0 |
| React Resizable Panels | Resizable Layout | 3.0.6 |
| React Markdown | Markdown Rendering | 9.0.1 |
| Lucide React | Icons | 0.394.0 |
| Framer Motion | Animations | 11.5.4 |
| Vite | Build Tool | 6.4.1 |

---

## 15. File Organization

```
client/src/
├── components/
│   ├── Chat/
│   │   ├── ChatView.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Presentation.tsx
│   │   ├── Landing.tsx
│   │   ├── Input/
│   │   │   ├── ChatForm.tsx
│   │   │   ├── SendButton.tsx
│   │   │   ├── BadgeRow.tsx
│   │   │   ├── PopoverButtons.tsx
│   │   │   ├── Mention.tsx
│   │   │   ├── PromptsCommand.tsx
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── StreamAudio.tsx
│   │   │   ├── Files/
│   │   │   │   ├── AttachFileChat.tsx
│   │   │   │   └── FileFormChat.tsx
│   │   │   └── (other input components)
│   │   ├── Messages/
│   │   │   ├── Message.tsx
│   │   │   ├── MessagesView.tsx
│   │   │   ├── MultiMessage.tsx
│   │   │   ├── MessageParts.tsx
│   │   │   ├── MessageIcon.tsx
│   │   │   ├── HoverButtons.tsx
│   │   │   ├── SiblingSwitch.tsx
│   │   │   ├── Feedback.tsx
│   │   │   ├── Fork.tsx
│   │   │   ├── ui/
│   │   │   │   ├── MessageRender.tsx
│   │   │   │   ├── MessageRow.tsx
│   │   │   │   └── PlaceholderRow.tsx
│   │   │   ├── Content/
│   │   │   │   ├── MessageContent.tsx
│   │   │   │   ├── ContentParts.tsx
│   │   │   │   ├── Markdown.tsx
│   │   │   │   ├── Image.tsx
│   │   │   │   ├── ToolCall.tsx
│   │   │   │   ├── WebSearch.tsx
│   │   │   │   ├── MemoryArtifacts.tsx
│   │   │   │   ├── ContentRender.tsx
│   │   │   │   └── (other content types)
│   │   └── Menus/
│   │       ├── Endpoints/
│   │       ├── BookmarkMenu.tsx
│   │       └── (other menus)
│   ├── Nav/
│   │   ├── Nav.tsx
│   │   ├── NavLink.tsx
│   │   ├── SearchBar.tsx
│   │   ├── NewChat.tsx
│   │   ├── Settings.tsx
│   │   └── (other nav components)
│   ├── SidePanel/
│   │   ├── SidePanelGroup.tsx
│   │   ├── SidePanel.tsx
│   │   ├── ArtifactsPanel.tsx
│   │   ├── Agents/
│   │   ├── Bookmarks/
│   │   ├── Files/
│   │   ├── Memories/
│   │   ├── Parameters/
│   │   └── (other panels)
│   ├── Artifacts/
│   │   ├── Artifacts.tsx
│   │   ├── Artifact.tsx
│   │   ├── ArtifactTabs.tsx
│   │   ├── ArtifactCodeEditor.tsx
│   │   ├── Code.tsx
│   │   ├── Mermaid.tsx
│   │   └── (other artifact types)
│   ├── Artifacts/ (for generative content)
│   ├── Conversations/ (conversation management)
│   ├── Files/ (file handling)
│   ├── ui/ (generic UI components)
│   └── (other feature components)
├── routes/
│   ├── Root.tsx (main layout)
│   ├── ChatRoute.tsx (chat page)
│   ├── Dashboard.tsx
│   ├── index.tsx (route configuration)
│   ├── Layouts/ (layout components)
│   └── (other routes)
├── Providers/ (context providers)
├── hooks/ (custom React hooks)
├── store/ (Recoil atoms and selectors)
├── data-provider/ (API integration)
├── utils/ (utility functions)
├── App.jsx (root component)
├── main.jsx (entry point)
├── style.css (global styles)
└── mobile.css (mobile-specific styles)
```

---

## Summary

LibreChat's chat interface is a sophisticated, modern React application with:

1. **Modular Architecture**: Clear separation between layout, messages, input, and navigation
2. **Flexible Layouts**: Resizable panels for main chat, artifacts, and side panel
3. **Responsive Design**: Tailored experience for mobile, tablet, and desktop
4. **Advanced Styling**: Tailwind CSS with custom variables for theming
5. **Robust State Management**: Combination of Recoil, Jotai, and React Hook Form
6. **Rich Message System**: Hierarchical message trees with multiple content types
7. **Accessibility**: ARIA labels, semantic HTML, keyboard navigation support
8. **Performance**: Memoization, lazy loading, and virtual scrolling where needed

The structure prioritizes user experience with smooth transitions, responsive layout changes, and efficient data handling through TanStack React Query.
