---
name: principle-migrate-callers-then-delete-legacy-apis
description: "Only use when named or routed by poteto-mode. Migrates callers and deletes a legacy internal API in one wave when introducing its replacement."
---

# Migrate Callers Then Delete Legacy APIs

- Update tests to assert the new contract, and delete tests that only protect pre-refactor implementation details

**When this applies:**
- No external users depend on backward compatibility
- The project can absorb coordinated breaking changes
- The new API is part of a simplification or refactor initiative
