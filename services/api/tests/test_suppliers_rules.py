"""Reglas de negocio de /suppliers que test_suppliers.py no cubre: limites de
validacion, combinaciones pais/moneda, filtros, idempotencia y borrado."""
from __future__ import annotations

import pytest

SPAIN = {
    "name": "Factorial", "country": "Spain", "categories": ["software"],
    "monthly_rate": 540.0, "currency": "EUR", "status": "active",
}
USA = {
    "name": "Stripe", "country": "USA", "categories": ["payments"],
    "monthly_rate": 420.0, "currency": "USD", "status": "active",
}
ALL_CATEGORIES = [
    "software", "infrastructure", "logistics", "marketing", "payments", "security", "other",
]


def create(client, payload: dict) -> dict:
    response = client.post("/suppliers", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# ─── POST: camino feliz y limites ───────────────────────────────────────


def test_create_with_every_optional_field(user_client):
    payload = {
        **USA, "contract_renewal_date": "2027-03-01",
        "contact_email": "billing@stripe.example", "notes": "Renovar en Q1",
    }

    body = create(user_client, payload)

    assert body["contract_renewal_date"] == "2027-03-01"
    assert body["contact_email"] == "billing@stripe.example"
    assert body["notes"] == "Renovar en Q1"


def test_create_without_optional_fields_leaves_them_empty(user_client):
    body = create(user_client, SPAIN)

    assert body["contract_renewal_date"] is None
    assert body["contact_email"] is None
    assert body["notes"] is None


@pytest.mark.parametrize("country,currency", [("Spain", "EUR"), ("USA", "USD")])
def test_valid_country_currency_pairs(user_client, country: str, currency: str):
    create(user_client, {**SPAIN, "country": country, "currency": currency})


@pytest.mark.parametrize("country,currency,expected", [
    ("Spain", "USD", "Para contratos en Spain, la moneda debe ser 'EUR'."),
    ("USA", "EUR", "Para contratos en USA, la moneda debe ser 'USD'."),
])
def test_country_currency_mismatch_is_rejected_with_a_clear_message(
    user_client, country: str, currency: str, expected: str
):
    response = user_client.post(
        "/suppliers", json={**SPAIN, "country": country, "currency": currency}
    )

    assert response.status_code == 422
    assert expected in str(response.json()["detail"])
    assert user_client.get("/suppliers").json() == []


def test_create_accepts_all_seven_categories(user_client):
    body = create(user_client, {**SPAIN, "categories": ALL_CATEGORIES})

    assert body["categories"] == ALL_CATEGORIES


@pytest.mark.parametrize("rate", [0.01, 1, 999_999_999.99])
def test_create_accepts_rate_boundaries(user_client, rate: float):
    assert create(user_client, {**SPAIN, "monthly_rate": rate})["monthly_rate"] == rate


@pytest.mark.parametrize("name", ["A", "  x  ", "Ñandú S.L. 🚀", "x" * 5000])
def test_create_accepts_unusual_names(user_client, name: str):
    assert create(user_client, {**SPAIN, "name": name})["name"] == name


def test_create_accepts_whitespace_only_name(user_client):
    # Comportamiento actual: min_length=1 no recorta espacios.
    assert create(user_client, {**SPAIN, "name": "   "})["name"] == "   "


def test_duplicate_names_are_allowed_and_get_distinct_ids(user_client):
    # Comportamiento actual: solo el seed evita duplicados por nombre.
    first, second = create(user_client, SPAIN), create(user_client, SPAIN)

    assert first["id"] != second["id"]
    assert len(user_client.get("/suppliers").json()) == 2


def test_duplicate_category_is_kept_as_sent(user_client):
    assert create(user_client, {**SPAIN, "categories": ["software", "software"]})[
        "categories"
    ] == ["software", "software"]


@pytest.mark.parametrize("date,ok", [
    ("2024-02-29", True), ("2000-01-01", True), ("2099-12-31", True),
    ("2023-02-29", False), ("2026-13-01", False), ("01/03/2027", False), ("manana", False),
])
def test_contract_renewal_date_validation(user_client, date: str, ok: bool):
    response = user_client.post("/suppliers", json={**SPAIN, "contract_renewal_date": date})

    assert (response.status_code == 201) is ok


def test_ids_are_not_reused_after_deleting_the_last_supplier(user_client):
    first = create(user_client, SPAIN)
    user_client.delete(f"/suppliers/{first['id']}")

    second = create(user_client, SPAIN)

    assert second["id"] != first["id"]


def test_sequential_creates_get_distinct_ids(user_client):
    ids = {create(user_client, {**SPAIN, "name": f"P{n}"})["id"] for n in range(10)}

    assert len(ids) == 10


# ─── POST: errores de validacion ────────────────────────────────────────


@pytest.mark.parametrize("override", [
    {"country": "spain"}, {"country": "France"}, {"country": ""},
    {"currency": "eur"}, {"currency": "GBP"},
    {"categories": []}, {"categories": ["Software"]}, {"categories": ["nope"]},
    {"categories": "software"},
    {"status": "ACTIVE"}, {"status": "pending"}, {"status": None},
    {"name": ""}, {"name": None},
    {"monthly_rate": 0}, {"monthly_rate": -1}, {"monthly_rate": "mucho"},
    {"monthly_rate": None},
    {"contact_email": "no-es-email"}, {"contact_email": "a@"},
    {"id": 1}, {"updated_at": "2026-01-01T00:00:00"}, {"campo_extra": "x"},
])
def test_create_rejects_invalid_payloads(user_client, override: dict):
    response = user_client.post("/suppliers", json={**SPAIN, **override})

    assert response.status_code == 422
    assert user_client.get("/suppliers").json() == []


@pytest.mark.parametrize("missing", ["name", "country", "categories", "monthly_rate",
                                     "currency", "status"])
def test_create_requires_mandatory_fields(user_client, missing: str):
    payload = {k: v for k, v in SPAIN.items() if k != missing}

    assert user_client.post("/suppliers", json=payload).status_code == 422


# ─── GET: filtros ───────────────────────────────────────────────────────


def test_list_is_ordered_by_creation(user_client):
    ids = [create(user_client, {**SPAIN, "name": f"P{n}"})["id"] for n in range(4)]

    assert [s["id"] for s in user_client.get("/suppliers").json()] == ids


def test_list_on_empty_database(user_client):
    assert user_client.get("/suppliers").json() == []


def test_category_filter_matches_suppliers_with_several_categories(user_client):
    multi = create(user_client, {**SPAIN, "categories": ["software", "security"]})
    create(user_client, {**SPAIN, "categories": ["logistics"]})

    for category in ("software", "security"):
        result = user_client.get("/suppliers", params={"category": category}).json()
        assert [s["id"] for s in result] == [multi["id"]]


def test_combined_filters_use_and_and_can_return_nothing(user_client):
    create(user_client, SPAIN)
    create(user_client, USA)

    both = user_client.get("/suppliers", params={"country": "USA", "category": "payments"})
    none = user_client.get("/suppliers", params={"country": "Spain", "category": "payments"})

    assert [s["name"] for s in both.json()] == ["Stripe"]
    assert none.json() == []


@pytest.mark.parametrize("params", [
    {"country": "spain"}, {"country": "France"}, {"category": "Software"},
    {"category": "nope"}, {"country": ""},
])
def test_invalid_filter_values_are_rejected(user_client, params: dict):
    assert user_client.get("/suppliers", params=params).status_code == 422


def test_listing_is_public(anon_client):
    assert anon_client.get("/suppliers").status_code == 200


# ─── GET por id ─────────────────────────────────────────────────────────


@pytest.mark.parametrize("supplier_id", [0, -1, 2**31, 999])
def test_get_unknown_ids_return_404(user_client, supplier_id: int):
    response = user_client.get(f"/suppliers/{supplier_id}")

    assert response.status_code == 404
    assert response.json()["detail"] == "Proveedor no encontrado."


# ─── PATCH rate / status ────────────────────────────────────────────────


@pytest.mark.parametrize("rate", [0.01, 1, 1_000_000])
def test_update_rate_boundaries(user_client, rate: float):
    supplier = create(user_client, SPAIN)

    response = user_client.patch(f"/suppliers/{supplier['id']}/rate", json={"monthly_rate": rate})

    assert response.status_code == 200
    assert response.json()["monthly_rate"] == rate


@pytest.mark.parametrize("body", [
    {"monthly_rate": 0}, {"monthly_rate": -5}, {"monthly_rate": None},
    {"monthly_rate": "abc"}, {}, {"monthly_rate": 10, "status": "suspended"},
])
def test_update_rate_rejects_invalid_bodies_and_changes_nothing(user_client, body: dict):
    supplier = create(user_client, SPAIN)

    response = user_client.patch(f"/suppliers/{supplier['id']}/rate", json=body)

    assert response.status_code == 422
    assert user_client.get(f"/suppliers/{supplier['id']}").json() == supplier


def test_update_rate_keeps_every_other_field(user_client):
    supplier = create(user_client, {**USA, "notes": "n"})

    updated = user_client.patch(
        f"/suppliers/{supplier['id']}/rate", json={"monthly_rate": 1.5}
    ).json()

    assert {k: v for k, v in updated.items() if k not in ("monthly_rate", "updated_at")} == {
        k: v for k, v in supplier.items() if k not in ("monthly_rate", "updated_at")
    }


def test_status_can_flip_in_any_direction_and_is_idempotent(user_client):
    # Comportamiento actual: no hay maquina de estados, solo active/suspended.
    supplier = create(user_client, SPAIN)
    url = f"/suppliers/{supplier['id']}/status"

    sequence = ["suspended", "suspended", "active", "active", "suspended"]
    results = [user_client.patch(url, json={"status": s}) for s in sequence]

    assert [r.status_code for r in results] == [200] * 5
    assert [r.json()["status"] for r in results] == sequence


@pytest.mark.parametrize("body", [{"status": "ACTIVE"}, {"status": "closed"},
                                  {"status": None}, {}, {"status": "active", "x": 1}])
def test_status_rejects_invalid_bodies(user_client, body: dict):
    supplier = create(user_client, SPAIN)

    assert user_client.patch(f"/suppliers/{supplier['id']}/status", json=body).status_code == 422


@pytest.mark.parametrize("suffix,body", [
    ("rate", {"monthly_rate": 10}), ("status", {"status": "suspended"}),
])
def test_patch_unknown_supplier_returns_404(user_client, suffix: str, body: dict):
    assert user_client.patch(f"/suppliers/999/{suffix}", json=body).status_code == 404


def test_update_refreshes_updated_at(user_client):
    supplier = create(user_client, SPAIN)

    updated = user_client.patch(
        f"/suppliers/{supplier['id']}/status", json={"status": "suspended"}
    ).json()

    assert updated["updated_at"] >= supplier["updated_at"]


# ─── DELETE ─────────────────────────────────────────────────────────────


def test_delete_removes_only_the_target(user_client):
    keep, drop = create(user_client, SPAIN), create(user_client, USA)

    assert user_client.delete(f"/suppliers/{drop['id']}").status_code == 204

    assert [s["id"] for s in user_client.get("/suppliers").json()] == [keep["id"]]


def test_delete_allows_removing_an_active_supplier(user_client):
    # Comportamiento actual: no hay proteccion para proveedores activos.
    supplier = create(user_client, {**SPAIN, "status": "active"})

    assert user_client.delete(f"/suppliers/{supplier['id']}").status_code == 204


def test_double_delete_returns_404_the_second_time(user_client):
    supplier = create(user_client, SPAIN)
    user_client.delete(f"/suppliers/{supplier['id']}")

    assert user_client.delete(f"/suppliers/{supplier['id']}").status_code == 404


# ─── Proteccion ─────────────────────────────────────────────────────────


@pytest.mark.parametrize("method,path,body", [
    ("post", "/suppliers", SPAIN),
    ("patch", "/suppliers/1/rate", {"monthly_rate": 5}),
    ("patch", "/suppliers/1/status", {"status": "suspended"}),
    ("delete", "/suppliers/1", None),
])
def test_mutations_without_token_do_not_touch_data(anon_client, method: str, path: str, body):
    kwargs = {"json": body} if body is not None else {}

    assert getattr(anon_client, method)(path, **kwargs).status_code == 401
    assert anon_client.get("/suppliers").json() == []
