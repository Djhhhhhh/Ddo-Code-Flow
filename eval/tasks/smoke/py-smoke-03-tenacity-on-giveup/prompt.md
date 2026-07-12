Add an optional terminal hook named `on_giveup` to Tenacity's public retry
configuration.

The hook receives the final RetryCallState and runs exactly once when a
retryable outcome is terminated by the configured stop policy. It runs after
the normal per-attempt `after` hook, and before either `retry_error_callback` or
the final exception is produced.

The hook must work with Retrying and AsyncRetrying. AsyncRetrying must await an
async on_giveup callback, while still accepting a synchronous callback.
`copy()`, decorated functions, and `retry_with()` must preserve the hook and
allow it to be overridden or disabled.

Do not call the hook after success, when retrying is disabled, or when an
outcome is rejected by the retry predicate before the stop policy is evaluated.
If the hook itself raises, propagate that exception and do not continue with
the normal terminal action.

Existing behavior must remain unchanged when the hook is omitted. Keep public
typing and documentation synchronized.
