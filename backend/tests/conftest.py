import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_PATH", str(Path(tempfile.mkdtemp()) / "test.db"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.services.state import get_state  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def state(client):
    return get_state()
