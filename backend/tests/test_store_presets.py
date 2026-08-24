import uuid

import pytest
from pydantic import ValidationError

from app.api.routes import StorePresetIn, store_preset_out


def test_store_preset_requires_at_least_one_store():
    with pytest.raises(ValidationError):
        StorePresetIn(name="Центр", store_ids=[])


def test_store_preset_serializer_returns_ids_and_names():
    stores = [type("Store", (), {"id": uuid.uuid4(), "name": "Первый"})()]
    preset = type("Preset", (), {"id": uuid.uuid4(), "name": "Центр", "stores": stores})()

    result = store_preset_out(preset)

    assert result["store_ids"] == [stores[0].id]
    assert result["stores"] == ["Первый"]
