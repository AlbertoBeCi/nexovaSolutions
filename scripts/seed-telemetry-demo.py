"""Create the explicitly synthetic telemetry dataset through the existing API.

Dry run by default. Requires a current backup with verified isolated restore.
No telemetry events are persisted; the private sidecar contains business metadata.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "services/api/data"
SUPPLIER = "DEMO TELEMETRIA - PROVEEDOR 01"
PRODUCTS = [
    ("Kit ventas B2B", "training_kit", "demo-ventas-b2b", "Valencia", "training_materials"),
    ("Kit ventas B2B", "training_kit", "demo-ventas-b2b", "Miami", "training_materials"),
    ("Certificacion liderazgo", "certification", "demo-liderazgo", "Valencia", "training_materials"),
    ("Certificacion liderazgo", "certification", "demo-liderazgo", "Miami", "training_materials"),
    ("Equipo incorporacion", "onboarding_equipment", "demo-onboarding", "Valencia", "hardware"),
    ("Equipo incorporacion", "onboarding_equipment", "demo-onboarding", "Miami", "hardware"),
]
# 4 + 4 + 3 + 3 + 3 + 3 = 20 inbound orders. The fourth B2B entry
# changes 1000 -> 1200 cents after three comparable 1000-cent entries.
ORDERS = [(index, 2, 1200 if position == 3 else 1000) for index, count in enumerate([4, 4, 3, 3, 3, 3]) for position in range(count)]


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def verify_backup(path):
    backup = json.loads(path.read_text(encoding="utf-8"))
    created = datetime.strptime(backup["created_at"], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - created).total_seconds()
    if not backup.get("restore_verified") or not 0 <= age <= 86400:
        raise ValueError("Se requiere un backup restaurado y verificado de las ultimas 24 horas.")
    dump = path.parent / backup["dump_file"]
    if dump.resolve().parent != path.resolve().parent or hashlib.sha256(dump.read_bytes()).hexdigest() != backup["sha256"]:
        raise ValueError("El backup no coincide con su manifiesto.")
    return backup


class Api:
    def __init__(self, base):
        parsed = urlsplit(base)
        if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1"}:
            raise ValueError("Usa exclusivamente el API local para esta carga.")
        self.base = base.rstrip("/")
        self.token = None
        self.session_id = str(uuid4())

    def request(self, method, path, body=None):
        headers = {"X-Nexova-App": "backoffice", "X-Request-ID": str(uuid4()), "X-Telemetry-Session-ID": self.session_id}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        if path == "/auth/login":
            cfg = dotenv_values(ROOT / "services/api/.env")
            data = urlencode({"username": cfg["ADMIN_EMAIL"], "password": cfg["ADMIN_PASSWORD"]}).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode() if body is not None else None
            headers["Content-Type"] = "application/json"
        with urlopen(Request(self.base + path, data=data, headers=headers, method=method), timeout=30) as response:
            return json.load(response)


def seed(api, registry_path, manifest_path, backup):
    api.token = api.request("POST", "/auth/login")["access_token"]
    assets = api.request("GET", "/inventory/products")
    orders = api.request("GET", "/inventory/orders")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {
        "dataset": "telemetry-demo-v1", "provenance": "synthetic_demo", "created_at": datetime.now(timezone.utc).isoformat(),
        "backup": backup["dump_file"], "products": [], "entries": [], "complete": False}
    registry = json.loads(registry_path.read_text(encoding="utf-8")) if registry_path.exists() else {
        "version": 1, "provenance": "synthetic_demo", "programmes": sorted({p[2] for p in PRODUCTS}),
        "products": [], "entries": [], "demo_quotes": []}
    # The API validates this sidecar again; the seed never infers classifications
    # from existing hardware/categories or changes the original six products.
    if manifest["dataset"] != "telemetry-demo-v1" or registry["provenance"] != "synthetic_demo":
        raise ValueError("Registro de demostracion incompatible.")
    existing_skus = {a["sku"]: a for a in assets}
    known_product_ids = set(manifest["products"])
    if any(a["sku"].startswith("DEMO-TEL-") and a["id"] not in known_product_ids for a in assets):
        raise ValueError("Hay productos DEMO sin manifiesto: reconciliar antes de repetir.")
    known_order_ids = {entry["order_id"] for entry in manifest["entries"]}
    if any(o["order_type"] == "inbound" and o["asset"]["id"] in known_product_ids and o["id"] not in known_order_ids for o in orders):
        raise ValueError("Hay entradas DEMO no registradas: reconciliar antes de repetir.")
    inserted_products = inserted_entries = 0
    for index, (name, category, programme, office, operational_category) in enumerate(PRODUCTS):
        sku = f"DEMO-TEL-{index + 1:03}"
        if sku in existing_skus:
            asset = existing_skus[sku]
        else:
            asset = api.request("POST", "/inventory/products", {"sku": sku, "name": "[DEMO] " + name,
                                "category": operational_category, "office": office})
            inserted_products += 1
            existing_skus[sku] = asset
            manifest["products"].append(asset["id"])
            registry["products"].append({"product_id": asset["id"], "product_category": category,
                "programme_id": programme, "threshold": 6, "threshold_version": 1})
            write_json(registry_path, registry)
            write_json(manifest_path, manifest)
    for position, (index, quantity, price) in enumerate(ORDERS):
        if position < len(manifest["entries"]):
            continue
        office = PRODUCTS[index][3]
        asset = existing_skus[f"DEMO-TEL-{index + 1:03}"]
        quote = {"product_id": asset["id"], "office": office, "supplier_label": SUPPLIER,
                 "supplier_id": "demo-supplier-01", "unit_cost_minor": price}
        registry["demo_quotes"] = [q for q in registry["demo_quotes"] if q["product_id"] != asset["id"]] + [quote]
        write_json(registry_path, registry)
        created = api.request("POST", "/inventory/orders/inbound", {"asset_id": asset["id"], "quantity": quantity,
                              "office": office, "supplier": SUPPLIER})
        metadata = {"order_id": created["id"], "product_id": asset["id"], "office": office,
                    "supplier_id": "demo-supplier-01", "unit_cost_minor": price}
        registry["entries"].append(metadata)
        manifest["entries"].append(metadata)
        write_json(registry_path, registry)
        write_json(manifest_path, manifest)
        inserted_entries += 1
    manifest["complete"] = len(manifest["entries"]) == 20
    write_json(manifest_path, manifest)
    return {"synthetic_demo": True, "products_inserted": inserted_products, "inbound_orders_inserted": inserted_entries,
            "dataset_inbound_orders": len(manifest["entries"]), "complete": manifest["complete"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup-manifest", type=Path)
    parser.add_argument("--base-url", default="http://localhost:8000")
    args = parser.parse_args()
    if not args.apply:
        print(json.dumps({"dry_run": True, "synthetic_products": len(PRODUCTS), "synthetic_inbound_orders": len(ORDERS), "writes": 0}))
        return
    if not args.backup_manifest:
        parser.error("--apply exige --backup-manifest con restauracion verificada")
    backup = verify_backup(args.backup_manifest)
    result = seed(Api(args.base_url), DATA / "telemetry-inventory-demo.json", DATA / "telemetry-demo-manifest.json", backup)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
