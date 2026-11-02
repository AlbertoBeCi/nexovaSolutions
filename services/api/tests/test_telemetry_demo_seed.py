"""Seed safety and repeatability without network or real data."""
import importlib.util
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("telemetry_demo_seed", Path(__file__).resolve().parents[3] / "scripts/seed-telemetry-demo.py")
seed_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed_module)


class FakeApi:
    def __init__(self):
        self.assets = [{"id": 100, "sku": "ORIGINAL", "name": "Original", "category": "hardware", "office": "Valencia"}]
        self.orders = []
        self.writes = 0

    def request(self, method, path, body=None):
        if path == "/auth/login":
            return {"access_token": "isolated-token"}
        if method == "GET":
            return self.assets if path.endswith("products") else self.orders
        self.writes += 1
        created = {**body, "id": 100 + self.writes}
        if path.endswith("products"):
            self.assets.append(created)
        else:
            self.orders.append({**created, "order_type": "inbound", "asset": next(a for a in self.assets if a["id"] == body["asset_id"])})
        return created


def test_twenty_synthetic_entries_are_isolated_and_idempotent(tmp_path):
    api = FakeApi()
    registry, manifest = tmp_path / "metadata.json", tmp_path / "manifest.json"
    backup = {"dump_file": "isolated-test-backup.dump"}
    result = seed_module.seed(api, registry, manifest, backup)
    assert result == {"synthetic_demo": True, "products_inserted": 6, "inbound_orders_inserted": 20, "dataset_inbound_orders": 20, "complete": True}
    assert api.assets[0]["name"] == "Original"
    assert len({p[2] for p in seed_module.PRODUCTS}) == 3
    assert len({p[1] for p in seed_module.PRODUCTS}) == 3
    assert {o["office"] for o in api.orders} == {"Valencia", "Miami"}
    assert all(o["supplier"].startswith("DEMO TELEMETRIA") for o in api.orders)
    second = seed_module.seed(api, registry, manifest, backup)
    assert second["inbound_orders_inserted"] == second["products_inserted"] == 0
    assert api.writes == 26
    data = json.loads(registry.read_text())
    assert len(data["entries"]) == 20 and data["provenance"] == "synthetic_demo"


def test_missing_manifest_never_duplicates_existing_demo(tmp_path):
    api = FakeApi()
    registry, manifest = tmp_path / "metadata.json", tmp_path / "manifest.json"
    seed_module.seed(api, registry, manifest, {"dump_file": "isolated-test.dump"})
    manifest.unlink()  # only a temporary file created by this test
    with pytest.raises(ValueError, match="sin manifiesto"):
        seed_module.seed(api, registry, manifest, {"dump_file": "isolated-test.dump"})
    assert api.writes == 26


@pytest.mark.parametrize("url", ["https://external.example", "http://external.example", "http://localhost.attacker.example"])
def test_seed_never_sends_local_admin_credentials_to_remote_host(url):
    with pytest.raises(ValueError, match="API local"):
        seed_module.Api(url)
