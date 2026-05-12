# Approach: Crosscheck

> Working document filled in as decisions were made during the build.

---

## What I'm Building

### One-liner

Crosscheck is an AI research tool that verifies whether AI-generated answers are actually supported by their cited sources.

### Live URL

<https://crosscheck.pratham.click/>

---

## Why This Problem

### Why Option 3 (Clone and Improve) over Options 1 and 2

* Option 3 gave me the best opportunity to show both product thinking and engineering execution.
* I wanted to build something AI-native, interactive, and polished within one focused day.
* Reverse engineering APIs would spend too much time on infrastructure instead of product experience.
* Browser extensions felt more limited in terms of interaction design and system depth.

### Why this clone target

* Tools like Perplexity are useful, but citations can sometimes be misleading.
* The answer may sound correct, but the cited source does not always support the claim.
* That creates trust issues, especially for research workflows.
* I wanted to improve trust and verification instead of only focusing on answer generation.

---

## What "Better" Means Here

* Verify whether citations actually support the generated answer
* Reduce hallucinated or weak citations
* Make verification visible directly in the UI
* Keep the experience fast, clean, and easy to understand

---

## Target User

* AI/ML researchers
* Engineers exploring technical topics
* Users who want more trustworthy AI-generated answers

---

## Stack

| Layer         | Choice                              | Why                                           |
| ------------- | ----------------------------------- | --------------------------------------------- |
| Framework     | Next.js 16 App Router + TypeScript  | Fast development and strong streaming support |
| LLM           | Claude Sonnet 4.6                   | Strong reasoning and citation formatting      |
| Verifier      | Claude Haiku 4.5                    | Faster and cheaper for verification tasks     |
| Streaming SDK | Vercel AI SDK v6                    | Simple streaming integration                  |
| Search        | Tavily                              | Supports domain-restricted search             |
| UI            | Tailwind + shadcn/ui                | Fast way to build polished UI                 |
| Deploy        | Vercel                              | Easy deployment with Next.js                  |

### Tradeoffs

* Focused on a single-provider flow instead of multi-provider comparison
* Prioritized streaming UX and verification over persistence or accounts
* Kept the system stateless to reduce complexity and improve shipping speed

---

## Scope

### P0 (shipped)

* Streaming AI answers
* Inline citation chips
* Citation verification
* Side panel with verification details
* Research-focused source filtering
* Error handling and loading states
* Live deployment

### P1 (intentionally cut for time)

* Multi-provider comparison
* Saved conversations
* Mobile-first redesign
* Authentication and accounts

### P2 (future work)

* Multi-turn research threads
* Citation exports
* Better paper previews
* Persistent storage
* Citation tracing at sentence level

---

## Architecture

```txt
Next.js App Router
│
├── app/page.tsx
│   Main client UI
│
├── app/api/research/route.ts
│   Search, answer generation, citation verification
│
├── components/
│   Citation chips, side panel, answer renderer
│
└── lib/
    AI provider configs and Tavily wrapper
```

### Key Design Decisions

* Used a simple retrieval pipeline instead of agent workflows to reduce latency and complexity
* Performed citation verification after answer generation to keep streaming responsive
* Verified citations in parallel for faster UI updates
* Restricted search to research-focused domains to improve answer quality
* Kept verification states binary for simpler UX clarity

---

## What Breaks First Under Pressure

* API overload or provider downtime
* Rate limits from external services
* Multiple verification requests running in parallel
* Network interruption during streaming
* Mobile layout limitations

During my smoke testing of the verifier, Claude Sonnet 4.6 actually went into a 529 "Overloaded" state. The Anthropic status page showed elevated errors for that exact model right while I was testing. I added proper error handling rather than a 60-second retry loop, but multi-provider fallback would be the right long-term fix.

The mobile layout also has known issues. The deployed build renders at desktop width on mobile devices, with content overflowing horizontally. The viewport meta tag is set correctly, but a fixed-positioned component (likely the source side panel) is forcing wider-than-viewport rendering. I attempted a fix with overflow-x: clip and break-words on the answer container, but I could not fully diagnose the root cause within the time budget. A proper mobile-first redesign (bottom-sheet panel, single-column source list) is in "What I'd Build Next."

---

## What I'd Build Next

* Multi-provider comparison between Claude, GPT, and Gemini
* Follow-up research conversations
* Saved searches and persistent accounts
* Better paper previews and abstracts
* Citation export support
* Better mobile experience

---

## How I Directed the AI Tools

I used Claude Code throughout the project, but I kept approvals manual so I could review changes before applying them.

### Pushbacks and Course Corrections

* Claude proposed a 7-day plan in the planning phase. I pushed back since the brief said one day, so I compressed it into four roughly 45-minute slices with demoable end-states for each.

* Claude wrote a full prose APPROACH.md draft early on with invented decision rationale, like picking Perplexity over Cursor or Notion AI when I had not deliberated those alternatives. I rejected the draft and asked for a skeleton with placeholder bullets that I would fill in as decisions actually got made.

* Claude wrote two memory files without my approval during scaffolding. I caught it and set a rule: propose every memory in chat first with its name, type, and content, then wait for explicit approval before writing.

* Mid-build I noticed Slice 2c had become "polish" instead of the planned citation verifier. The actual differentiator had been dropped from the slice plan. I re-inserted it as Slice 3 before any more polish work, since polish without the differentiator is gilding.

* During polish, Claude added a "type at least 10 characters" validation that I had not asked for. I caught the scope creep, loosened it to 5, and questioned whether the validation was even needed.

### Where My Judgment Shaped the Result

* Focused the product around verification instead of generic AI chat
* Prioritized shipping a polished core experience over adding more features
* Reduced scope aggressively to avoid unfinished functionality
* Chose faster verification models to keep latency lower
* Kept the UI minimal and research-focused instead of making it feel like a generic AI SaaS app

---

_Last updated: build in progress._
