This is a small fix: add a read-only `remaining_capacity` property to `Cache`.

It must report `maxsize - currsize` without coercing or clamping the numeric
value. It must work consistently for every built-in cache subclass, including
timed caches, and must reflect insertions, replacements, removals, clear
operations, evictions, and expiry.

Custom `getsizeof` functions must be respected. Do not change existing eviction
behavior or public attributes. Keep the public type information in sync with
the runtime API.
