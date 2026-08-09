"""HTTP adapter for the frozen ML Fund Engine V3 bundle."""

import sys
from pathlib import Path


# Keep the copied bundle directly runnable without requiring an editable install.
_SOURCE_ROOT = Path(__file__).resolve().parents[1] / "src"
if str(_SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SOURCE_ROOT))
