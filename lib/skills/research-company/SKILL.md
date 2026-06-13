---
name: research-company
description: Comprehensive company research — mission, operations, leadership, products/services deep-dive, and ~5 years of recent news
category: researching
model: claude-sonnet-4-6
effort: high
argument-hint: <company name> [URL]
disable-model-invocation: false
user-invocable: true
---

# Research Company

Perform comprehensive research on a company using web search and news sources. Write findings as structured markdown files under `.docs/company-context/<slug>/`.

---

**Company**: $ARGUMENTS

---

## Phase 1: Parse Input

Extract from `$ARGUMENTS`:
- **Company name** — canonical name to use in searches
- **URL** (if provided) — use as a primary source for official information
- **Research focus** (if any) — e.g. "focus on engineering culture" or "hiring context"

Derive a **slug** from the company name: lowercase, spaces → hyphens, no special characters (e.g. "Acme Corp" → `acme-corp`).

The output directory is: `.docs/company-context/<slug>/`

If a URL was provided, fetch it first via WebFetch to extract mission, products, and leadership directly from the source.

---

## Phase 2: Core Company Profile

**CRITICAL**: Brave Search has a hard rate limit of **1 request per second**. All searches MUST be sequential, never parallel.

Search sequentially for each of the following. Use the company name (and domain if known) in queries.

### 2a. Mission & Overview
- Query: `"<company name>" mission vision what does <company> do`
- Extract: founding year, HQ, employee count, mission statement, core value proposition

### 2b. Products & Services
- Query: `"<company name>" products services offerings 2024 2026`
- Extract: product lines, key features, target customers/market, pricing model if public

### 2c. Business Model & Market Position
- Query: `"<company name>" business model revenue customers market`
- Extract: revenue model (SaaS/marketplace/services/etc.), key customers, market segment, competitive moat

### 2d. Leadership & Key People
- Query: `"<company name>" CEO leadership team executives founders`
- Extract: CEO, CTO, founders, notable board members, leadership changes in last 2 years

### 2e. Company Size & Growth
- Query: `"<company name>" employees headcount growth funding valuation`
- Extract: headcount, funding rounds (amounts, investors, dates), valuation if known, growth trajectory

---

## Phase 2f: Products & Services Deep Dive

Dig into the product/service portfolio in detail. Sequential, 1 req/sec.

### 2f-i. Product Catalogue
- Query: `"<company name>" products features pricing tiers plans`
- Extract: full list of named products/plans, what each does, who it targets, and public pricing tiers or price signals (e.g. "starts at $X/month", "custom enterprise pricing")

### 2f-ii. Platform & Integration Ecosystem
- Query: `"<company name>" integrations API platform partners ecosystem`
- Extract: key integrations (native and marketplace), API availability, developer platform features, SDK or webhook support

### 2f-iii. Customer Use Cases & Case Studies
- Query: `"<company name>" case study customer success how customers use`
- Extract: 3–5 named customer examples or verticals, the problem solved, measurable outcomes if stated

### 2f-iv. Recent Product Changes & Roadmap Signals
- Query: `"<company name>" product launch update new feature changelog 2024 2026`
- Query: `"<company name>" roadmap upcoming release beta 2026`
- Extract: notable launches in the last 18 months, deprecations, and any publicly telegraphed roadmap direction

### 2f-v. Free Tier, Trial & GTM Motion
- Query: `"<company name>" free trial freemium self-serve enterprise sales`
- Extract: whether there is a free/trial tier, self-serve vs. sales-led GTM, typical deal size signals if public

---

## Phase 3: Recent News (last ~5 years, 2021–2026)

Search year-band by year-band to avoid recency bias. Sequential, 1 req/sec.

### 3a. Major Announcements & Milestones
- Query: `"<company name>" announcement milestone launch 2023 2024 2026`
- Query: `"<company name>" news 2021 2022`

### 3b. Funding, M&A, Partnerships
- Query: `"<company name>" funding acquisition merger partnership`
- Extract: rounds, acqui-hires, strategic partnerships, IPO status

### 3c. Product / Strategy Shifts
- Query: `"<company name>" pivot strategy product change rebrand`

### 3d. Challenges & Controversies (if any)
- Query: `"<company name>" layoffs lawsuit controversy regulation problem`
- Report factually; skip this section entirely if nothing material surfaces

### 3e. Competitive Landscape
- Query: `"<company name>" competitors alternatives vs market`
- Extract: top 3–5 named competitors, how the company differentiates

---

## Phase 4: Engineering & Culture (optional — include if relevant)

Include this phase if the research context suggests hiring, partnering, or technical evaluation.

- Query: `"<company name>" engineering blog tech stack open source`
- Query: `"<company name>" culture values glassdoor employee review`
- Query: `"<company name>" engineering team size remote hybrid`

---

## Phase 5: Write Output Files

Create the directory `.docs/company-context/<slug>/` and write the following files. Omit any file whose section has no reliable data — never fabricate content.

### `index.md` — master summary & navigation
```
---
company: <Company Name>
slug: <slug>
researched: <YYYY-MM-DD>
url: <official URL if known>
---

# <Company Name>

> One-sentence description.

## Files in this profile

| File | Contents |
|------|----------|
| [overview.md](overview.md) | Mission, products, business model, size & funding |
| [products.md](products.md) | Product/service deep-dive — catalogue, pricing, integrations, use cases, roadmap |
| [leadership.md](leadership.md) | Executives, founders, board |
| [news.md](news.md) | Chronological news 2021–2026 |
| [competitive.md](competitive.md) | Competitors and differentiation |
| [culture.md](culture.md) | Engineering culture and tech stack *(if researched)* |

## Quick Summary

<3–5 bullet highlights>
```

### `overview.md` — mission, products, business model, size & funding
```
---
company: <Company Name>
section: overview
---

# <Company Name> — Overview

## Mission & Values
- Mission statement (quoted or paraphrased with source)
- Core values (if public)

## Products & Services
- **<Product>**: brief description
- ...

## Business Model
- Revenue model: ...
- Key customer segments: ...
- Competitive moat: ...

## Size & Funding
- Founded: YYYY  HQ: <city>
- Employees: ~N *(source, date)*
- Total funding: $X  Latest round: Series X ($Y, Month YYYY)
- Key investors: ...
- Valuation / ARR: ... *(if public)*
```

### `products.md` — product/service deep-dive
```
---
company: <Company Name>
section: products
---

# <Company Name> — Products & Services

## Product Catalogue

| Product / Plan | Description | Target Customer | Pricing |
|----------------|-------------|-----------------|---------|
| ...            | ...         | ...             | ...     |

## Platform & Integrations
- **Native integrations**: ...
- **API / SDK**: ...
- **Marketplace / ecosystem**: ...

## Customer Use Cases

| Customer / Vertical | Problem Solved | Outcome |
|---------------------|----------------|---------|
| ...                 | ...            | ...     |

## Recent Product Launches & Changes *(last 18 months)*
- **<Mon YYYY>**: <feature/launch> — [source](<url>)
- ...

## Roadmap Signals
- ...  *(publicly announced or inferred from blog/conference)*

## GTM Motion
- Free tier / trial: ...
- Self-serve vs. sales-led: ...
- Typical deal size signals: ...
```

### `leadership.md` — executives, founders, board
```
---
company: <Company Name>
section: leadership
---

# <Company Name> — Leadership

| Name | Role | Notes |
|------|------|-------|
| ...  | CEO  | ...   |

## Recent Changes
- <Date>: <name> joined/departed as <role>
```

### `news.md` — chronological news 2021–2026
```
---
company: <Company Name>
section: news
period: 2021–2026
---

# <Company Name> — News & Developments (2021–2026)

## 2026
- **<Mon YYYY>**: <event> — [source](<url>)

## 2024
- ...

## 2023
- ...

## 2022
- ...

## 2021
- ...

## 2021
- ...
```

### `competitive.md` — competitive landscape
```
---
company: <Company Name>
section: competitive
---

# <Company Name> — Competitive Landscape

## Main Competitors

| Company | How they compare |
|---------|-----------------|
| ...     | ...             |

## Differentiators
- ...

## Market Position
- ...
```

### `culture.md` — engineering culture & tech stack *(write only if Phase 4 was researched)*
```
---
company: <Company Name>
section: culture
---

# <Company Name> — Engineering & Culture

## Tech Stack
- ...

## Engineering Culture
- ...

## Work Style
- Remote / hybrid / in-office: ...
- Notable perks or policies: ...

## Employee Sentiment *(Glassdoor / public reviews)*
- ...
```

---

## Phase 6: Confirm & Suggest Next Steps

After writing the files, tell the user:
- Which files were written (list paths)
- Any sections skipped due to insufficient data
- Suggested follow-on actions based on context:
  - **Hiring prep**: "Run `/research-company <name> focus on engineering culture` to deepen culture.md"
  - **Partnership/sales**: flag key decision-makers and recent strategic priorities from `leadership.md` and `news.md`
  - **Competitive analysis**: offer to run research on the top competitors surfaced in `competitive.md`

---

## CRITICAL Rules

1. **Brave Search rate limit**: 1 request/second, sequential only — never fire parallel searches
2. **Cite every claim**: include source URL inline where possible
3. **Flag uncertainty**: if a figure (headcount, valuation) is estimated or unverified, mark it *(estimated)* or *(unverified)*
4. **No hallucination**: omit entire sections/files rather than inventing plausible-sounding details
5. **Recency over quantity**: prefer sources from the last 3 years; flag anything older than 2022 as potentially outdated
6. **Use Write tool** for all output files — do not print the file contents inline to the conversation
