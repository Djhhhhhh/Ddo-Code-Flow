from __future__ import annotations

import sys
from pathlib import Path


EVAL_ROOT = Path(__file__).resolve().parents[1]
if str(EVAL_ROOT) not in sys.path:
    sys.path.insert(0, str(EVAL_ROOT))
