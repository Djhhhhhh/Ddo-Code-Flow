Prototype-pollution handling should be configurable independently from general
strict JSON parsing.

Add an `unsafeKeys` option that lets callers choose between dropping suspicious
keys and failing the parse, while preserving every existing default behavior.

Before implementing, confirm the exact option values, precedence when
`unsafeKeys` and `strict` are both set, warning behavior, and how `safeDestr`
should behave. Then update the runtime, exported types, tests, and documentation.
