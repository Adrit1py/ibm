"""Test-only sys.path setup, scoped to core/parser/tests.

core/ is a PEP 420 namespace package (no core/__init__.py needed/created —
that file lives outside my /core/parser boundary and other pillars will
add their own subpackages under it). This conftest just ensures the repo
root is importable as `core.parser...` when running `pytest` from
anywhere, without requiring a top-level pytest.ini/pyproject.toml change.
"""

import os
import sys

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
