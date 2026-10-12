---
name: principle-guard-the-context-window
description: "Only use when named or routed by poteto-mode. Protects a filling context window by routing large outputs, long reads, and fan-out detail away while keeping summaries."
---

# Guard the Context Window

**Why:** Context overflow degrades reasoning quality, creates compression artifacts, and halts progress.

**Pattern:**
- **Size phases and cap scope.** Limit files per phase, set turn budgets, account for mechanism costs.
