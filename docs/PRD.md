# ASST Web-First Product Requirements Document (PRD)

## 1. Vision
ASST (ARES Solana Security Tool) is a web-first security platform for automating Solana security workflows with deterministic outputs, production-safe API contracts, and operational observability.

## 2. Core Features

### 2.1 Agentic Web Console (`/dashboard/console`)
- **Persistent Session Context**: Conversation history retained through orchestrator persistence.
- **Session History Stream**: Console loads and streams recent activity via SSE.
- **Protected API Access**: Chat and scan endpoints require auth and rate limits in production.

### 2.2 Security Assurance Pipeline (`/api/scan`)
- **L1-L6 Security Lanes**: Comprehensive scanning covering RPC analysis, dependency hygiene, secret scanning, and deep program audit.
- **Two-Step Workflow**:
    1. **Findings Generation**: The agent perform tools execution and reports all vulnerabilities/issues.
    2. **Proposed Fixes**: After reporting, the agent proposes specific code modifications which can be applied with user approval.

### 2.3 Deterministic API Contracts
- **Stable Envelopes**: Standard success/error JSON shape with request IDs.
- **Deterministic Responses**: No random/mock fields on production endpoints.

### 2.4 Modular Tool Registry
- **ARES Engine Integration**: Seamless integration with the existing Solana security tools (`engine/` lane tools).
- **Extensibility**: Easy-to-add custom tools via the `ASSTAgentEngine` registry.

## 3. UI/UX Design

### 3.1 Aesthetic
- **Dashboard Theme**: Deep-charcoal inspired dashboard with light/dark mode support.
- **Operational Surfaces**: Console, findings, reports, and posture pages with consistent visual language.

### 3.2 Safety
- **Protected Public Routes**: API key auth + route-level rate limiting.
- **Path Safety**: Strict file path validation and repository boundary checks.

## 4. Technical Stack
- **Runtime**: Node.js (TypeScript)
- **Execution**: `tsx` (TypeScript Execution)
- **LLM Orchestration**: `LangGraph` & `OpenRouter`
- **Database**: SQLite3
- **Web Framework**: `Next.js` (App Router)

## 5. Deployment & Installation
- **Primary Surface**: `apps/web`
- **Runtime Services**: `apps/mcp-server` and `apps/chain-intake`
