---
name: principle-laziness-protocol
description: "Only use when named or routed by poteto-mode. Biases refactors and diff sizing toward deletion and the smallest change when abstractions or layers are tempting."
---

# Laziness Protocol

- **Consolidate decisions.** Do not repeat the same choice in several places. Put it behind one source of truth and pass the result as a simple flag.
- **Minimize the diff.** Make the smallest change that solves the problem. Fewer lines beat "elegant" boilerplate.
