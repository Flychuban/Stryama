# Project Brief: Stryama - AI-Powered No-Code Development Platform

## Executive Summary

**Stryama** is a full-stack web application that democratizes software development. It enables non-technical users to build functional, production-ready web applications through natural language prompts. The platform combines advanced AI code generation (Claude) with an interactive, sandboxed development environment (E2B), allowing users to create, preview, and refine applications in real-time. Uniquely, Stryama emphasizes ownership: users can export their creations to GitHub or deploy them directly to the web via Netlify.

**Primary Problem:** The technical barrier to software creation excludes millions of innovators. Existing no-code tools are often restrictive, while hiring developers is expensive.

**Key Value Proposition:** Transform natural language into web applications that are not locked into the platform—users own the code.

## Problem Statement

**Current State & Pain Points:**

1.  **High Learning Curve:** Traditional coding takes months or years to master.
2.  **Vendor Lock-in:** Most no-code platforms trap users in their proprietary ecosystem.
3.  **Prototype vs. Production Gap:** Many AI tools generate snippets, not deployable applications.

**Urgency:** The AI revolution enables code generation, but a unified platform that handles generation, execution, and deployment is missing for the non-technical market.

## Proposed Solution

**Core Capabilities:**

1.  **Intelligent Translation:** Converts prompts into full-stack Next.js applications using Claude Code Agents SDK.
2.  **Live Sandbox:** Immediate, secure preview of generated apps via E2B.
3.  **Ownership & Export:** One-click export to GitHub and deployment to Netlify.
4.  **Iterative Refinement:** Conversational interface to tweak and improve the app.

**Tech Stack:**

- **Frontend:** Next.js 15+ (App Router), React 19, Tailwind CSS 3.4, ShadCN/UI.
- **Backend:** tRPC, Prisma, PostgreSQL (Neon).
- **AI/Sandbox:** Anthropic Claude, E2B.
- **State Management:** TanStack React Query.

## Target Users

### Primary: Entrepreneurial Innovators

- **Profile:** Founders, consultants, business analysts.
- **Goal:** Rapidly prototype and validate ideas without hiring a dev team.
- **Need:** Speed, low cost, and the ability to "graduate" from the platform (export code).

### Secondary: Creative Professionals

- **Profile:** Designers, marketers, educators.
- **Goal:** Build interactive portfolios, landing pages, or custom internal tools.

## Goals & Success Metrics

### Business Objectives

- **User Acquisition:** 10,000 registered users in 12 months.
- **Conversion:** 5% conversion to paid plans (Builder/Pro).
- **Retention:** High usage of "Export" and "Deploy" features indicates value realization.

### User Success Metrics

- **Time to First App:** < 15 minutes.
- **Code Quality:** 85% of generated apps run without errors on first try.
- **Latency:** Sub-30 second prompt-to-preview updates for minor changes.

## MVP Scope

### Core Features (Implemented)

1.  **Conversational Interface:** Chat-based interaction for defining requirements.
2.  **AI Code Generation:** Automated generation of Next.js/React code structure and content.
3.  **Live Preview:** Sandboxed execution of user apps.
4.  **Project Management:** CRUD operations for projects and files.
5.  **GitHub Integration:** Connect GitHub account and export project repositories.
6.  **Netlify Integration:** Connect Netlify account and deploy live sites.
7.  **Usage Tracking:** Token/cost monitoring per user.
8.  **Feedback System:** Integrated user feedback collection.

### Technical Constraints

- **Web Only:** Focus on web applications (no mobile native).
- **Stack:** Generated apps are exclusively Next.js/Tailwind/TypeScript.
- **Limits:** Rate limiting applied based on user tiers (MVP uses in-memory limits).

## Risks & Mitigations

- **AI Hallucinations:** Mitigated by strict prompt engineering and iterative correction workflow.
- **Security:** User code runs strictly in E2B sandboxes, never on the host server.
- **Cost:** Usage limits and tiered pricing protect against high API costs.
