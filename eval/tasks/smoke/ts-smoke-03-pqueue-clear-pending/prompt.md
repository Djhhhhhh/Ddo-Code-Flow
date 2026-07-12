Extend `PQueue.clear()` with an opt-in way to settle promises for tasks that are
discarded before they start.

Calling `clear()` without arguments must remain exactly backward-compatible.
Calling `clear({rejectPending: true, reason?})` must remove all waiting tasks and
reject the promises returned by their `add()` calls. Tasks that have already
started must continue normally.

Without an explicit reason, use a DOMException whose name is `AbortError`. When
a reason is supplied, forward that exact value. Clean up queued AbortSignal
listeners, prevent double settlement during abort/clear races, and preserve
current queue, rate-limit, and event behavior. Export a public `ClearOptions`
type and document the new behavior.
