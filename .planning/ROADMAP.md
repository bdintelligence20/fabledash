# Roadmap: FableDash

## Overview

Complete overhaul of FableDash from a broken CRUD prototype into a production-grade CEO Operations Intelligence Hub. The journey starts with tearing down the Supabase dependency and rebuilding on Firebase/Firestore, then systematically builds the core data layer, time logging, financial integrations (Sage), meeting intelligence (Read AI + Fireflies), a two-tier autonomous AI agent ecosystem, and the OpsAI conversational intelligence layer. Culminates in Health & Vitality dashboards providing quarterly and YTD comparative reports across operational efficiency, financial performance, and process quality.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation & Infrastructure** — Firebase setup, tear down Supabase, project scaffolding, auth
- [ ] **Phase 2: Core Data Layer** — Firestore collections, FastAPI endpoints for all core entities
- [ ] **Phase 3: Frontend Architecture** — Design system, app shell, routing, responsive layout
- [ ] **Phase 4: Client & Task Management** — Full CRUD, Kanban views, filtering, client detail pages
- [ ] **Phase 5: Advanced Time Logging** — Time entry, auto-duration, activity logs, time allocation by group
- [ ] **Phase 6: Sage Financial Integration** — Sage API connection, weekly snapshots, P&L/Excel uploads
- [ ] **Phase 7: Financial Dashboards** — Revenue growth, cost-benefit (ZAR/Hr), cash position, volume vs rate
- [ ] **Phase 8: Meeting Intelligence** — Read AI + Fireflies integration, contextual linking, automated briefing
- [ ] **Phase 9: AI Agent Ecosystem** — Two-tier agents, RAG, document processing, model selection, parallel execution
- [ ] **Phase 10: OpsAI Intelligence Layer** — Conversational AI, proactive alerts, cross-source queries
- [ ] **Phase 11: Health & Vitality Reports** — Operational efficiency, process quality, quarterly/YTD comparatives
- [ ] **Phase 12: Integration & Deployment** — Google Drive, Mail/Calendar, GCP deployment, polish

## Phase Details

### Phase 1: Foundation & Infrastructure
**Goal**: Remove all Supabase dependencies, set up Firebase/Firestore project, configure Firebase Auth with role-based access (CEO + team), establish clean project structure for the rebuild
**Depends on**: Nothing (first phase)
**Research**: Likely (Firebase/Firestore setup patterns, Firebase Auth with FastAPI)
**Research topics**: Firebase Admin SDK for Python/FastAPI, Firestore data modeling best practices, Firebase Auth token verification in FastAPI middleware
**Plans**: 5 plans

Plans:
- [ ] 01-01: Strip Supabase — remove all Supabase client code, dependencies, and config from frontend and backend
- [ ] 01-02: Firebase project setup — initialize Firebase, configure Firestore, set up Firebase Admin SDK in FastAPI
- [ ] 01-03: Firebase Auth — implement authentication with CEO and team member roles, FastAPI middleware for token verification
- [ ] 01-04: Backend restructure — clean FastAPI app structure with Firebase integration, health checks, CORS, error handling
- [ ] 01-05: Frontend project reset — clean React app entry point, environment config, Firebase client SDK setup

### Phase 2: Core Data Layer
**Goal**: Define Firestore collections and build FastAPI CRUD endpoints for all core entities — clients, tasks, task statuses, time logs
**Depends on**: Phase 1
**Research**: Unlikely (standard Firestore CRUD patterns established in Phase 1)
**Plans**: 4 plans

Plans:
- [ ] 02-01: Firestore schema design — define collections, subcollections, and indexes for clients, tasks, time logs, and supporting entities
- [ ] 02-02: Client endpoints — FastAPI CRUD for clients with Firestore, including partner group assignment (Collab, EDCP, Direct, Separate)
- [ ] 02-03: Task endpoints — FastAPI CRUD for tasks with statuses, comments, attachments, client association, priority, due dates
- [ ] 02-04: Time log endpoints — FastAPI CRUD for time entries with auto-duration calculation, client/task linkage

### Phase 3: Frontend Architecture
**Goal**: Build the design system, app shell, navigation, and responsive layout that all feature pages will use
**Depends on**: Phase 1
**Research**: Unlikely (React + TailwindCSS internal patterns)
**Plans**: 4 plans

Plans:
- [ ] 03-01: Design system — color palette, typography, spacing, component tokens reflecting Fable's Clarity/Creativity/Human-Centricity values
- [ ] 03-02: UI component library — buttons, cards, inputs, modals, tables, badges, stat cards, tabs built on the design system
- [ ] 03-03: App shell and routing — authenticated layout with sidebar navigation, header, breadcrumbs, route structure for all pages
- [ ] 03-04: Dashboard page skeleton — CEO dashboard layout with widget grid, placeholder sections for metrics, charts, and alerts

### Phase 4: Client & Task Management
**Goal**: Full client and task management UI — client list/detail pages, task CRUD with Kanban/list/calendar views, filtering by status/client/date
**Depends on**: Phase 2, Phase 3
**Research**: Unlikely (internal CRUD UI patterns)
**Plans**: 5 plans

Plans:
- [ ] 04-01: Client list and creation — client list page with search/filter, create/edit client modal with partner group assignment
- [ ] 04-02: Client detail page — client overview with associated tasks, agents, time logs, and financial summary
- [ ] 04-03: Task list and filtering — task list page with status/client/priority/date filters, bulk actions
- [ ] 04-04: Task detail and editing — task detail view with comments, attachments, status transitions, time log association
- [ ] 04-05: Kanban and calendar views — drag-and-drop Kanban board by status, calendar view for due dates

### Phase 5: Advanced Time Logging
**Goal**: Advanced time entry system with date/client/description/start-end/auto-duration, Gemini-style activity logs, time allocation tracking by partner group
**Depends on**: Phase 2, Phase 3
**Research**: Unlikely (internal feature, standard patterns)
**Plans**: 5 plans

Plans:
- [ ] 05-01: Time entry UI — time log creation form with client/task selection, start/end time pickers, auto-calculated duration
- [ ] 05-02: Activity log — Gemini-style granular activity logging with running timer, quick entry, and daily summary
- [ ] 05-03: Time log list and filtering — sortable/filterable time log list by date range, client, task, partner group
- [ ] 05-04: Time allocation dashboard — breakdown by partner group (Collab, EDCP, Direct Clients, Separate Businesses), visual charts
- [ ] 05-05: Utilization rate calculation — billable vs total hours tracking, utilization rate metric, saturation leaderboards

### Phase 6: Sage Financial Integration
**Goal**: Connect to Sage API for weekly financial snapshots, support CSV/Excel upload for P&L and revenue forecasts
**Depends on**: Phase 2
**Research**: Likely (Sage API — external service, South African accounting software)
**Research topics**: Sage Business Cloud Accounting API authentication (OAuth2), available endpoints for invoices/payments/accounts, API rate limits, South African instance specifics
**Plans**: 5 plans

Plans:
- [ ] 06-01: Sage API research and connection — OAuth2 authentication, API client setup, credential storage in Firebase
- [ ] 06-02: Financial data sync — weekly automated pull of invoices, payments, accounts, cash position from Sage
- [ ] 06-03: P&L document upload — CSV/Excel upload endpoint for monthly P&L (Actuals vs Forecasts), data parsing and storage
- [ ] 06-04: Revenue forecast upload — 90-day revenue outlook document upload and parsing
- [ ] 06-05: Financial data API — FastAPI endpoints serving aggregated financial data for dashboard consumption

### Phase 7: Financial Dashboards
**Goal**: Financial Performance dashboard with revenue growth rate (QoQ), cost-benefit analysis (ZAR/Hr), cash position, pass-through handling, volume vs rate analysis
**Depends on**: Phase 5, Phase 6
**Research**: Unlikely (internal dashboards from captured data)
**Plans**: 5 plans

Plans:
- [ ] 07-01: Revenue tracking — revenue growth rate (QoQ), period-over-period comparison charts
- [ ] 07-02: Cost-benefit analysis — ZAR/Hr ranked table from "Most Valuable" to "Least Valuable" clients, pass-through project identification
- [ ] 07-03: Cash position — real-time cash on hand display from Sage data, trend visualization
- [ ] 07-04: Volume vs rate analysis — evaluate high-volume clients for per-hour efficiency, identify rate compression
- [ ] 07-05: Financial overview page — combined financial dashboard with all metrics, quarterly comparison selectors (Q1 vs Q2 vs YTD)

### Phase 8: Meeting Intelligence
**Goal**: Integrate Read AI and Fireflies for meeting transcription, auto-map notes to Client/Job IDs, convert transcripts to formal briefs via the "Fable Ops Gem"
**Depends on**: Phase 2
**Research**: Likely (Read AI API, Fireflies API — external services)
**Research topics**: Read AI API for calendar-based transcription access, Fireflies.ai API for ad-hoc transcription retrieval, webhook patterns for real-time transcript delivery
**Plans**: 5 plans

Plans:
- [ ] 08-01: Read AI integration — API connection for calendar-based meeting transcripts, webhook for new transcripts
- [ ] 08-02: Fireflies integration — API connection for ad-hoc meeting transcripts, transcript retrieval
- [ ] 08-03: Transcript storage and processing — store transcripts in Firestore, extract key entities, auto-link to clients/jobs
- [ ] 08-04: Contextual linking — automatic mapping of transcript notes to Client/Job IDs, "Why behind the What" linking
- [ ] 08-05: Automated briefing (Fable Ops Gem) — AI-powered conversion of meeting notes into formal briefs dispatched by Ops/Traffic Agent

### Phase 9: AI Agent Ecosystem
**Goal**: Two-tier autonomous agent system — Tier 1 Ops/Traffic Agent for dispatching briefs, Tier 2 Client-Based Agents for repeatable work, with RAG, document processing, model selection, and parallel execution
**Depends on**: Phase 2, Phase 3
**Research**: Likely (autonomous agent architecture, OpenAI function calling, multi-model orchestration)
**Research topics**: OpenAI Assistants API vs custom agent loop, function calling patterns for autonomous execution, multi-model routing (GPT-4 vs Claude), vector store options for Firestore (replacing pgvector)
**Plans**: 7 plans

Plans:
- [ ] 09-01: Agent data model and CRUD — Firestore schema for agents (parent/child hierarchy), FastAPI endpoints, agent configuration
- [ ] 09-02: Document processing pipeline — upload, extract text (PDF/DOCX/TXT), chunk, and generate embeddings for RAG
- [ ] 09-03: Vector storage and RAG — embedding storage solution (replacing pgvector), similarity search, context retrieval for agent conversations
- [ ] 09-04: Agent chat system — conversation interface with message history, context injection from RAG, streaming responses
- [ ] 09-05: Tier 1 Ops/Traffic Agent — CEO-compiled briefs, dispatch to client agents, proactive alert capabilities
- [ ] 09-06: Tier 2 Client-Based Agents — dedicated per-client agents with client-specific document context, repeatable task execution
- [ ] 09-07: Model selection and parallel execution — best-fit model routing (Deep Research vs Creative Nimble), concurrent agent execution

### Phase 10: OpsAI Intelligence Layer
**Goal**: The "Holy Grail" — conversational AI that pulls from dashboard data, Sage, Google Drive, transcripts to answer business questions, plus proactive intelligence surfacing issues
**Depends on**: Phase 5, Phase 6, Phase 7, Phase 8, Phase 9
**Research**: Likely (cross-source data aggregation, proactive alert architecture)
**Research topics**: Function calling for multi-source data retrieval, alert/notification system design, query routing across Firestore collections, real-time vs scheduled intelligence
**Plans**: 5 plans

Plans:
- [ ] 10-01: Data aggregation layer — unified API that queries across time logs, financials, clients, transcripts, agents
- [ ] 10-02: OpsAI conversational interface — chat UI where CEO asks business questions and gets data-backed answers
- [ ] 10-03: Function calling tools — OpenAI function calling tools for querying each data source (financials, utilization, clients, etc.)
- [ ] 10-04: Proactive intelligence engine — scheduled analysis detecting over-servicing, utilization drops, cash position alerts, scope creep
- [ ] 10-05: Alert and notification system — surface proactive insights on dashboard, notification feed, configurable alert thresholds

### Phase 11: Health & Vitality Reports
**Goal**: Quarterly and YTD comparative Health & Vitality reports covering operational efficiency, financial performance, and internal process quality
**Depends on**: Phase 5, Phase 7, Phase 10
**Research**: Unlikely (internal dashboards from existing aggregated data)
**Plans**: 5 plans

Plans:
- [ ] 11-01: Operational efficiency report — utilization rate, time allocation by group, saturation leaderboards, productivity score
- [ ] 11-02: Financial performance report — revenue growth (QoQ), cost-benefit rankings, cash position, pass-through analysis
- [ ] 11-03: Internal process quality report — communication overhead metrics, task efficiency by service, "Human Metric"
- [ ] 11-04: Comparative framework — Q1 vs Q2 vs YTD comparison engine, period selector, trend visualization
- [ ] 11-05: Report generation — exportable Health & Vitality reports, PDF/summary generation, executive overview

### Phase 12: Integration & Deployment
**Goal**: Google Drive and Mail/Calendar integrations, GCP deployment pipeline, performance optimization, final polish
**Depends on**: All previous phases
**Research**: Likely (Google Drive API, Gmail/Calendar API, GCP Cloud Build config)
**Research topics**: Google Drive API v3 for client document access, Gmail API for communication pattern analysis, Google Calendar API for meeting density metrics, Cloud Build + Cloud Run deployment patterns
**Plans**: 6 plans

Plans:
- [ ] 12-01: Google Drive integration — API connection for client document access, file browsing, document linking to clients
- [ ] 12-02: Mail/Calendar integration — Gmail API for communication patterns, Calendar API for meeting density analysis
- [ ] 12-03: Communication overhead dashboard — mail volume tracking, meeting frequency analysis, "email volume creep" detection
- [ ] 12-04: GCP deployment pipeline — Cloud Build configs for frontend (App Engine) and backend (Cloud Run), environment management
- [ ] 12-05: Performance and error handling — API response optimization, error boundaries, loading states, caching strategy
- [ ] 12-06: Final polish — responsive design audit, accessibility, edge cases, production environment verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

Note: Phases 2 and 3 can run in parallel (both depend only on Phase 1). Phases 4 and 5 can run in parallel (both depend on 2+3). Phase 8 and 9 can start once Phase 2+3 complete.

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Foundation & Infrastructure | 5/5 | Complete | 2026-02-25 |
| 2. Core Data Layer | 0/4 | Not started | - |
| 3. Frontend Architecture | 0/4 | Not started | - |
| 4. Client & Task Management | 0/5 | Not started | - |
| 5. Advanced Time Logging | 0/5 | Not started | - |
| 6. Sage Financial Integration | 0/5 | Not started | - |
| 7. Financial Dashboards | 0/5 | Not started | - |
| 8. Meeting Intelligence | 0/5 | Not started | - |
| 9. AI Agent Ecosystem | 0/7 | Not started | - |
| 10. OpsAI Intelligence Layer | 0/5 | Not started | - |
| 11. Health & Vitality Reports | 0/5 | Not started | - |
| 12. Integration & Deployment | 0/6 | Not started | - |
