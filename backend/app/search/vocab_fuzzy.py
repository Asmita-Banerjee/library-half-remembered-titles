"""Typo-tolerant term lookup: a Trie over the index vocabulary searched with a
Levenshtein DP row per depth (same technique as the C engine's ts_fuzzy).

Edit budget follows the Meilisearch convention: words of 1-4 letters must be
exact, 5-8 letters allow 1 edit, 9+ letters allow 2.
"""

from __future__ import annotations


def typo_budget(word: str) -> int:
    n = len(word)
    return 0 if n <= 4 else 1 if n <= 8 else 2


class _Node:
    __slots__ = ("children", "word")

    def __init__(self) -> None:
        self.children: dict[str, _Node] = {}
        self.word: str | None = None


class VocabTrie:
    def __init__(self, words) -> None:
        self.root = _Node()
        self.size = 0
        for w in words:
            node = self.root
            for ch in w:
                node = node.children.setdefault(ch, _Node())
            if node.word is None:
                node.word = w
                self.size += 1

    def search(self, word: str, max_dist: int, limit: int = 5) -> list[tuple[str, int]]:
        """Vocabulary words within max_dist edits of word, closest first."""
        if max_dist <= 0:
            return []
        out: list[tuple[str, int]] = []
        first = list(range(len(word) + 1))

        def walk(node: _Node, ch: str, prev: list[int]) -> None:
            row = [prev[0] + 1]
            for j in range(1, len(word) + 1):
                row.append(min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + (word[j - 1] != ch)))
            if node.word is not None and 0 < row[-1] <= max_dist:
                out.append((node.word, row[-1]))
            if min(row) <= max_dist:
                for c, child in node.children.items():
                    walk(child, c, row)

        for c, child in self.root.children.items():
            walk(child, c, first)
        out.sort(key=lambda t: (t[1], t[0]))
        return out[:limit]
