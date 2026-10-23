"""Bounded process-local TTL cache for immutable API response snapshots."""
from __future__ import annotations

from collections import OrderedDict
from copy import deepcopy
from dataclasses import dataclass
from threading import Lock, RLock
from time import monotonic
from typing import Callable, Generic, TypeVar

T = TypeVar("T")


@dataclass
class _CacheEntry(Generic[T]):
    value: T
    expires_at: float
    generation: int
    tag: str


@dataclass
class _Flight:
    lock: Lock
    users: int = 0


class TTLResponseCache:
    """A small, thread-safe cache with tag invalidation and stale-fill guards.

    Values are copied on write and read so a handler cannot mutate a snapshot
    shared by later requests. Per-key locks prevent duplicate work on misses;
    generation checks prevent a load started before invalidation from
    repopulating the cache afterwards.
    """

    def __init__(self, max_entries: int = 128, clock: Callable[[], float] = monotonic):
        self._max_entries = max_entries
        self._clock = clock
        self._entries: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._generations: dict[str, int] = {}
        self._lock = RLock()
        self._flight_locks: dict[str, _Flight] = {}

    def get_or_create(self, key: str, *, tag: str, ttl_seconds: float, loader: Callable[[], T]) -> T:
        with self._lock:
            flight = self._flight_locks.setdefault(key, _Flight(Lock()))
            flight.users += 1

        try:
            with flight.lock:
                with self._lock:
                    now = self._clock()
                    entry = self._entries.get(key)
                    generation = self._generations.get(tag, 0)
                    if (
                        entry is not None
                        and entry.tag == tag
                        and entry.generation == generation
                        and entry.expires_at > now
                    ):
                        self._entries.move_to_end(key)
                        return deepcopy(entry.value)
                    if entry is not None:
                        del self._entries[key]

                value = loader()

                with self._lock:
                    if self._generations.get(tag, 0) == generation and self._max_entries > 0:
                        self._purge_expired_locked()
                        self._entries[key] = _CacheEntry(
                            value=deepcopy(value),
                            expires_at=self._clock() + ttl_seconds,
                            generation=generation,
                            tag=tag,
                        )
                        self._entries.move_to_end(key)
                        while len(self._entries) > self._max_entries:
                            self._entries.popitem(last=False)
                return deepcopy(value)
        finally:
            with self._lock:
                flight.users -= 1
                if flight.users == 0 and self._flight_locks.get(key) is flight:
                    del self._flight_locks[key]

    def invalidate(self, tag: str) -> None:
        with self._lock:
            self._generations[tag] = self._generations.get(tag, 0) + 1
            expired_or_tagged = [key for key, entry in self._entries.items() if entry.tag == tag]
            for key in expired_or_tagged:
                del self._entries[key]

    def clear(self) -> None:
        with self._lock:
            for tag in {entry.tag for entry in self._entries.values()} | set(self._generations):
                self._generations[tag] = self._generations.get(tag, 0) + 1
            self._entries.clear()

    def _purge_expired_locked(self) -> None:
        now = self._clock()
        for key in [key for key, entry in self._entries.items() if entry.expires_at <= now]:
            del self._entries[key]


response_cache = TTLResponseCache(max_entries=128)
