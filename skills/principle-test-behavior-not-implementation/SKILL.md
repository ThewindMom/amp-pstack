---
name: principle-test-behavior-not-implementation
description: "Only use when named or routed by poteto-mode. Tests user-observed behavior against literal expected values when writing, changing, or retaining tests."
---

# Test Behavior, Not Implementation

A test calls the code as its users do and asserts the exact result they see. Rewrite or delete any test that would still pass if every imported function returned `undefined` or a wrong value.

These shapes fail that check:

- Loose or no assertion: no `expect`, or only `toBeDefined`, `toBeTruthy`, `not.toThrow`, `toBeInstanceOf`, `toBeGreaterThan(0)`.
- Call or absence only: `toHaveBeenCalled`, `not.toHaveBeenCalled`, `toBeUndefined`, `toEqual([])`, `toHaveLength(0)`, `not.toBe(wrongValue)`.
- Expected value computed by the code under test: `expect(f(a)).toBe(f(a))`, `expect(parsed.url).toBe(buildUrl(...))`.
- Restated constant, config default, table row, or prompt string: `expect(LIMITS.maxTools).toBe(8)`, `expect(PROMPT).toContain("You are")`. A pin like this also fails when someone edits the constant, so it blocks that edit.
- Assertions on data the test built or a value computed in `beforeEach`, with no call to the subject in the body.

Fix: call the subject in the test body with one concrete input and assert the literal output or effect, `expect(slugify("Hello, World!")).toBe("hello-world")`. For a mock, assert the payload it received or the state after the call, not that it was called. For an absence, also assert the presence on another input. For a constant, test the mechanism that reads it with one input instead of restating the value. When no such assertion exists, delete the test.

Keep relation checks across table rows (a key in two tables, a parent that exists) and `*.test-d.ts` type checks.
