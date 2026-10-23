from __future__ import annotations

from threading import Event, Thread

from response_cache import TTLResponseCache


def test_cache_reuses_values_until_ttl_and_keeps_keys_separate():
    now = [100.0]
    cache = TTLResponseCache(clock=lambda: now[0])
    calls = {"valencia": 0, "miami": 0}

    def load(key: str) -> list[str]:
        calls[key] += 1
        return [key]

    assert cache.get_or_create("office=Valencia", tag="products", ttl_seconds=5, loader=lambda: load("valencia")) == ["valencia"]
    assert cache.get_or_create("office=Valencia", tag="products", ttl_seconds=5, loader=lambda: load("valencia")) == ["valencia"]
    assert cache.get_or_create("office=Miami", tag="products", ttl_seconds=5, loader=lambda: load("miami")) == ["miami"]
    assert calls == {"valencia": 1, "miami": 1}

    now[0] += 5
    assert cache.get_or_create("office=Valencia", tag="products", ttl_seconds=5, loader=lambda: load("valencia")) == ["valencia"]
    assert calls["valencia"] == 2


def test_invalidation_clears_all_variants_and_prevents_stale_repopulation():
    cache = TTLResponseCache(clock=lambda: 10.0)
    started = Event()
    finish = Event()
    result: list[str] = []

    def stale_loader() -> list[str]:
        started.set()
        assert finish.wait(timeout=2)
        return ["antes del cambio"]

    worker = Thread(
        target=lambda: result.append(
            cache.get_or_create("office=Valencia", tag="products", ttl_seconds=30, loader=stale_loader)
        )
    )
    worker.start()
    assert started.wait(timeout=2)
    cache.invalidate("products")
    finish.set()
    worker.join(timeout=2)
    assert not worker.is_alive()
    assert result == [["antes del cambio"]]

    calls = 0

    def fresh_loader() -> list[str]:
        nonlocal calls
        calls += 1
        return ["después del cambio"]

    assert cache.get_or_create("office=Valencia", tag="products", ttl_seconds=30, loader=fresh_loader) == ["después del cambio"]
    assert cache.get_or_create("office=Valencia", tag="products", ttl_seconds=30, loader=fresh_loader) == ["después del cambio"]
    assert calls == 1


def test_cache_copies_mutable_results_and_does_not_store_failures():
    cache = TTLResponseCache(clock=lambda: 1.0)
    original = {"items": [1]}
    first = cache.get_or_create("key", tag="tag", ttl_seconds=5, loader=lambda: original)
    first["items"].append(2)
    assert cache.get_or_create("key", tag="tag", ttl_seconds=5, loader=lambda: {"items": [3]}) == {"items": [1]}

    attempts = 0

    def fail_once() -> str:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("consulta fallida")
        return "ok"

    try:
        cache.get_or_create("error", tag="tag", ttl_seconds=5, loader=fail_once)
    except RuntimeError as error:
        assert str(error) == "consulta fallida"
    assert cache.get_or_create("error", tag="tag", ttl_seconds=5, loader=fail_once) == "ok"
    assert attempts == 2


def test_cache_keeps_memory_bounded_with_lru_eviction():
    cache = TTLResponseCache(max_entries=2, clock=lambda: 1.0)
    calls = 0

    def load() -> str:
        nonlocal calls
        calls += 1
        return "value"

    for key in ("one", "two", "three"):
        cache.get_or_create(key, tag="tag", ttl_seconds=30, loader=load)
    cache.get_or_create("one", tag="tag", ttl_seconds=30, loader=load)
    assert calls == 4
