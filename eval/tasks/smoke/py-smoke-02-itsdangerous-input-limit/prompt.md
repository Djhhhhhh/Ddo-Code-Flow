Our service accepts signed values from untrusted clients. Add an opt-in
input-size limit so oversized tokens are rejected before expensive
verification, decoding, or decompression.

Existing callers must behave exactly as before when no limit is configured.
Please clarify any public API, measurement, boundary, entry-point, or
error-semantics decisions that could affect users before implementing them.
