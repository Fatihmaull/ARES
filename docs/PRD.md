# ASST CLI Product Requirements Document (PRD)

## 1. Vision
ASST (ARES Solana Security Tool) is a high-performance, agentic CLI platform designed to automate the security lifecycle of Solana programs. Moving from a web-based interface to a developer-first terminal interface, ASST provides persistent, context-aware assistance for developers and security auditors.

## 2. Core Features

### 2.1 Agentic REPL (asst chat)
- **Persistent Shell**: An interactive terminal session that maintains context across multiple turns.
- **Session History**: Conversation logs stored in a local SQLite database (`asst.db`) allowing for historical context retrieval.
- **Tool Access**: The agent has capability to read/write files and execute terminal commands (with safety confirmations).

### 2.2 Security Assurance Pipeline (asst scan)
- **L1-L6 Security Lanes**: Comprehensive scanning covering RPC analysis, dependency hygiene, secret scanning, and deep program audit.
- **Two-Step Workflow**:
    1. **Findings Generation**: The agent perform tools execution and reports all vulnerabilities/issues.
    2. **Proposed Fixes**: After reporting, the agent proposes specific code modifications which can be applied with user approval.

### 2.3 Semantic Codebase Search
- **Code Indexing**: Local indexing of the codebase for fast, semantic search.
- **Maximized Depth**: Ability for the agent to perform deep-dives into the repository structure to find related security patterns.

### 2.4 Modular Tool Registry
- **ARES Engine Integration**: Seamless integration with the existing Solana security tools (`engine/` lane tools).
- **Extensibility**: Easy-to-add custom tools via the `ASSTAgentEngine` registry.

## 3. UI/UX Design

### 3.1 Aesthetic
- **Color Palette**: Deep Charcoal background with Terracotta, Coral, and Mint highlights (via `chalk`).
- **Interactive Prompts**: Using `@clack/prompts` for a modern, fluid CLI experience.
- **Boxed Layouts**: Using `boxen` to encapsulate reports and important outputs.

### 3.2 Safety
- **Mandatory Confirmation**: Every "write" or "execute" action proposed by the agent requires an explicit `(y/n)` confirmation from the user.

## 4. Technical Stack
- **Runtime**: Node.js (TypeScript)
- **Execution**: `tsx` (TypeScript Execution)
- **LLM Orchestration**: `LangGraph` & `OpenRouter`
- **Database**: SQLite3
- **CLI Framework**: `commander.js`

## 5. Deployment & Installation
- **Launcher**: `Launch_ASST.bat` for Windows users to provide an instant, persistent terminal environment.
- **Pathing**: Uses absolute path resolution to ensure the CLI can be launched from any location (e.g., Desktop).
