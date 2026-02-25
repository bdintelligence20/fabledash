# FableDash — CEO Operations Intelligence Hub

## What This Is

A centralized Operations Intelligence hub for Fable, a South African creative agency. FableDash provides the CEO with a "direct line" to the health and vitality of the business through real-time metrics, financial visibility, AI-powered agents, and meeting intelligence. It replaces a broken prototype with a production-grade system that integrates Sage accounting, Read AI, Fireflies, Google Drive, and advanced time logging — all powered by an AI layer (OpsAI) that can answer questions about the business and proactively surface issues.

## Core Value

The CEO can ask "How's the business doing?" at any moment and get a real, data-backed answer — pulling from financials, time logs, client data, and meeting transcripts — while AI agents autonomously handle repeatable client work.

## Requirements

### Validated

- ✓ React + TypeScript frontend with Vite — existing, keeping
- ✓ FastAPI Python backend — existing, keeping
- ✓ TailwindCSS styling — existing, keeping
- ✓ GCP deployment (Cloud Run + App Engine) — existing, keeping
- ✓ Basic client management (CRUD) — existing, rebuilding
- ✓ Basic task management (CRUD) — existing, rebuilding
- ✓ AI agent chat with OpenAI — existing, rebuilding
- ✓ Document upload and processing — existing, rebuilding
- ✓ RAG with vector embeddings — existing, rebuilding

### Active

**Health & Vitality Framework**
- [ ] Operational Efficiency dashboard — utilization rate, time allocation by group (Collab, EDCP, Direct Clients, Separate Businesses), saturation leaderboards, productivity score
- [ ] Financial Performance dashboard — revenue growth rate (QoQ), cost-benefit analysis (ZAR/Hr), pass-through project handling, volume vs rate analysis, cash position
- [ ] Internal Process Quality dashboard — communication overhead (mail/calendar analysis), task efficiency by service
- [ ] Quarterly & YTD comparative reports (Q1 vs Q2 vs YTD)

**Data Capture & Time Logging**
- [ ] Advanced time logs — date, client, description, start/end, auto-calculated duration
- [ ] Gemini-style activity logs for granular timekeeping
- [ ] CSV/Excel document upload for P&L (Actuals vs Forecasts) and 90-day revenue outlooks

**Integrations**
- [ ] Sage API integration — weekly financial snapshots
- [ ] Read AI integration — calendar-based meeting transcription
- [ ] Fireflies integration — ad-hoc meeting transcription
- [ ] Google Drive integration — client documentation access
- [ ] Mail/Calendar snapshots — communication pattern analysis

**AI Agent Ecosystem**
- [ ] Tier 1: Operations/Traffic Agent — dispatches briefs compiled by CEO, proactive alerts
- [ ] Tier 2: Client-Based Agents — dedicated autonomous agents per client for repeatable work
- [ ] Parallel Resource Execution — agents working concurrently following detailed briefs
- [ ] Model Selection — choose best fit model (Deep Research vs Creative Nimble) per task
- [ ] OpsAI conversational interface — ask questions about business state, get data-backed answers
- [ ] OpsAI proactive intelligence — surfaces issues before asked (over-servicing, utilization drops, etc.)

**Meeting Intelligence**
- [ ] Automated feed from Read AI and Fireflies into "Fable Ops Gem"
- [ ] Contextual linking — notes auto-mapped to Client/Job IDs
- [ ] Automated briefing — transcription Gem converts meeting notes to formal briefs

**Infrastructure**
- [ ] Migrate from Supabase to Firebase/Firestore
- [ ] Firebase Authentication — CEO + small team with basic role separation
- [ ] Rebuild frontend from scratch with proper architecture
- [ ] Rebuild backend with Firebase integration and all new endpoints

### Out of Scope

- Full multi-user role-based access control — small team only, basic roles sufficient
- Mobile native app — web-first, responsive design only
- Custom ML model training — use OpenAI/Anthropic APIs
- White-labeling or multi-tenancy — single agency (Fable) only
- Historical data migration from current Supabase — fresh start

## Context

**Business Context:**
- Fable is a South African creative agency operating in ZAR
- The CEO needs a "direct line" to business health without relying on manual reports
- Values: Clarity, Creativity, Human-Centricity
- Goal: Scale without extra employees by using AI agents for traffic and repeatable client work
- Current cash position benchmark: ~R270,000
- Partner groupings: Collab, EDCP, Direct Clients, Separate Businesses

**Current State:**
- Existing prototype is a basic CRUD app with ~5,660 lines frontend, ~2,798 lines backend
- Currently uses Supabase (PostgreSQL) — migrating to Firebase/Firestore
- Has basic agent/chat/document/client/task functionality that doesn't deliver real value
- Deployed on GCP (Cloud Run for backend, App Engine for frontend)
- OpenAI integration exists for chat and embeddings

**Key Integrations Required:**
- Sage API — South African accounting software, weekly financial data pulls
- Read AI — calendar-based meeting transcription service
- Fireflies.ai — ad-hoc meeting transcription service
- Google Drive — client document access
- Google Calendar/Mail — communication pattern analysis

## Constraints

- **Platform**: GCP (Cloud Run, App Engine) — existing infrastructure
- **Frontend**: React + TypeScript + Vite + TailwindCSS — team familiarity
- **Backend**: FastAPI (Python) — team familiarity
- **Database**: Firebase/Firestore — replacing Supabase
- **Auth**: Firebase Authentication — small team access
- **Currency**: ZAR — all financial metrics in South African Rand
- **AI**: OpenAI API for embeddings and chat — existing integration

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Migrate Supabase → Firebase/Firestore | User preference, reduce lock-in to Supabase ecosystem | — Pending |
| Keep React + FastAPI stack | Team familiarity, existing GCP deployment infrastructure | — Pending |
| Firebase Auth for team access | Small team (CEO + few members), basic roles sufficient | — Pending |
| Full autonomous agents in v1 | Core to scaling without extra employees — not a "later" feature | — Pending |
| Build all integrations in v1 | Brief IS the scope — Sage, Read AI, Fireflies, Google Drive, Calendar | — Pending |
| Complete rebuild (not incremental) | Current app "sucks" — overhaul, not patch | — Pending |

---
*Last updated: 2026-02-25 after initialization*
