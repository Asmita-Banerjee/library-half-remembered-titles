"""Author retrieval: a prefix Trie over author-name tokens.

Every token of every author name ("arthur", "conan", "doyle") and the full
folded name ("arthur conan doyle") is inserted. Each Trie node keeps the set
of author ids below it, so autocomplete for any typed prefix is
O(len(prefix) + results) and matching is case- and accent-insensitive.
"""

from __future__ import annotations

import re

from .text import fold

_WORD = re.compile(r"[a-z0-9]+")


def fold_name(name: str) -> str:
    return " ".join(_WORD.findall(fold(name)))


class _Node:
    __slots__ = ("children", "authors")

    def __init__(self) -> None:
        self.children: dict[str, _Node] = {}
        self.authors: set[int] = set()


class AuthorIndex:
    def __init__(self, authors: dict[int, str], books_by_author: dict[int, list[int]]):
        self.names = authors
        self.books_by_author = books_by_author
        self.root = _Node()
        self.by_full_name: dict[str, int] = {}
        for aid, name in authors.items():
            full = fold_name(name)
            self.by_full_name[full] = aid
            keys = set(full.split()) | {full, full.replace(" ", "")}
            for key in keys:
                self._insert(key, aid)

    def _insert(self, key: str, aid: int) -> None:
        node = self.root
        for ch in key:
            node = node.children.setdefault(ch, _Node())
            node.authors.add(aid)

    def _prefix(self, key: str) -> set[int]:
        node = self.root
        for ch in key:
            node = node.children.get(ch)
            if node is None:
                return set()
        return node.authors

    def match(self, query: str) -> list[int]:
        """Authors whose full name equals the query, or where every query word
        is a prefix of some name token (so "doyle", "conan d", "AGATHA" work)."""
        q = fold_name(query)
        if not q:
            return []
        if q in self.by_full_name:
            return [self.by_full_name[q]]
        sets = [self._prefix(w) for w in q.split()]
        found = set.intersection(*sets) if sets else set()
        if not found:
            found = self._prefix(q.replace(" ", ""))
        return sorted(found, key=lambda a: (-len(self.books_by_author.get(a, [])), self.names[a]))

    def autocomplete(self, query: str, limit: int = 8) -> list[int]:
        return self.match(query)[:limit]
