class EvalError(RuntimeError):
    """Base class for expected evaluation failures."""


class ManifestError(EvalError):
    """A public or private manifest is invalid."""


class InfrastructureError(EvalError):
    """The harness failed before an agent result could be judged."""
