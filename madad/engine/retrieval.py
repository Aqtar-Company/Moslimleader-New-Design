"""BM25 search over curriculum chunks. Pure Python, no index files, no model.

Rebuilt at startup — a few hundred lessons index in well under a second, and
there is nothing on disk to go stale when a teacher edits a lesson.
"""

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass

from pathlib import Path

from .arabic import tokenize
from .curriculum import Chunk


def load_synonyms(path: Path) -> dict[str, frozenset[str]]:
    """Each line of synonyms.txt is a group of words that mean the same thing.

    Plain text on purpose: the teacher who spots a wrongly refused question in
    the log fixes it by adding a line, not by editing code.
    """
    groups: dict[str, frozenset[str]] = {}
    if not path.exists():
        return groups
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("#"):
            continue
        words = frozenset(t for w in line.split() for t in tokenize(w, keep_stopwords=True))
        if len(words) > 1:
            for w in words:
                groups[w] = groups.get(w, frozenset()) | words
    return groups


@dataclass
class Hit:
    chunk: Chunk
    score: float
    coverage: float  # share of the question's distinct terms present in this chunk


class Index:
    def __init__(self, chunks: list[Chunk], synonyms: dict[str, frozenset[str]] | None = None,
                 k1: float = 1.5, b: float = 0.75):
        self.chunks = chunks
        self.synonyms = synonyms or {}
        self.k1, self.b = k1, b
        self.tf = [Counter(tokenize(c.search_text)) for c in chunks]
        self.len = [sum(t.values()) for t in self.tf]
        self.avgdl = (sum(self.len) / len(self.len)) if self.len else 1.0
        df: Counter[str] = Counter()
        for t in self.tf:
            df.update(t.keys())
        n = len(chunks)
        self.idf = {term: math.log(1 + (n - f + 0.5) / (f + 0.5)) for term, f in df.items()}

    def search(self, query: str, k: int = 4, grade_id: str | None = None,
               subject_id: str | None = None) -> list[Hit]:
        terms = list(dict.fromkeys(tokenize(query)))
        if not terms:
            return []
        hits = []
        for i, chunk in enumerate(self.chunks):
            if grade_id and chunk.lesson.grade_id != grade_id:
                continue
            if subject_id and chunk.lesson.subject_id != subject_id:
                continue
            tf, dl = self.tf[i], self.len[i]
            score, matched = 0.0, 0
            for term in terms:
                # A term matches if the chunk has it or any word of its synonym group;
                # the best-scoring variant counts, once.
                best = 0.0
                for variant in self.synonyms.get(term, (term,)):
                    f = tf.get(variant)
                    if f:
                        best = max(best, self.idf[variant] * f * (self.k1 + 1) / (
                            f + self.k1 * (1 - self.b + self.b * dl / self.avgdl)))
                if best:
                    matched += 1
                    score += best
            if score > 0:
                hits.append(Hit(chunk, score, matched / len(terms)))
        hits.sort(key=lambda h: h.score, reverse=True)
        return hits[:k]
