"""Loading the curriculum from disk.

Layout:  curriculum/<grade-id>/<subject-id>/<lesson>.md

Each lesson is Markdown with a small front-matter block:

    ---
    title: الكسور
    grade: الصف الرابع الابتدائي
    subject: رياضيات
    source: كتاب الرياضيات، الفصل الدراسي الأول، ص 40
    reviewed: true
    reviewer: أ. فلان
    ---

`## ` headings split a lesson into sections; long sections are split again by
paragraph so that every chunk handed to the model is small and on one topic.
`reviewed: false` marks content no teacher has checked yet — the UI shows it,
and `--only-reviewed` drops it entirely.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

MAX_CHUNK_CHARS = 900


@dataclass
class Lesson:
    id: str
    title: str
    grade_id: str
    grade: str
    subject_id: str
    subject: str
    source: str
    reviewed: bool
    reviewer: str
    body: str


@dataclass
class Chunk:
    id: str
    lesson: Lesson
    heading: str
    text: str
    search_text: str = field(repr=False, default="")


def _parse_front_matter(raw: str) -> tuple[dict[str, str], str]:
    if not raw.startswith("---"):
        return {}, raw
    end = raw.find("\n---", 3)
    if end == -1:
        return {}, raw
    meta = {}
    for line in raw[3:end].strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, raw[end + 4:].lstrip("\n")


def _split_long(text: str) -> list[str]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]
    parts, cur = [], ""
    for para in re.split(r"\n\s*\n", text):
        if cur and len(cur) + len(para) > MAX_CHUNK_CHARS:
            parts.append(cur.strip())
            cur = ""
        cur += para + "\n\n"
    if cur.strip():
        parts.append(cur.strip())
    return parts


def load_lessons(root: Path, only_reviewed: bool = False) -> list[Lesson]:
    lessons = []
    for path in sorted(root.glob("*/*/*.md")):
        meta, body = _parse_front_matter(path.read_text(encoding="utf-8"))
        rel = path.relative_to(root)
        grade_id, subject_id = rel.parts[0], rel.parts[1]
        reviewed = meta.get("reviewed", "false").lower() in ("true", "yes", "نعم")
        if only_reviewed and not reviewed:
            continue
        lessons.append(Lesson(
            id=rel.with_suffix("").as_posix(),
            title=meta.get("title", path.stem),
            grade_id=grade_id,
            grade=meta.get("grade", grade_id),
            subject_id=subject_id,
            subject=meta.get("subject", subject_id),
            source=meta.get("source", ""),
            reviewed=reviewed,
            reviewer=meta.get("reviewer", ""),
            body=body.strip(),
        ))
    return lessons


def chunk_lesson(lesson: Lesson) -> list[Chunk]:
    sections: list[tuple[str, str]] = []
    heading, buf = "", []
    for line in lesson.body.splitlines():
        if line.startswith("## "):
            if "".join(buf).strip():
                sections.append((heading, "\n".join(buf).strip()))
            heading, buf = line[3:].strip(), []
        elif line.startswith("# "):
            continue  # lesson title duplicates front matter
        else:
            buf.append(line)
    if "".join(buf).strip():
        sections.append((heading, "\n".join(buf).strip()))

    chunks = []
    for heading, text in sections:
        for part in _split_long(text):
            n = len(chunks)
            chunks.append(Chunk(
                id=f"{lesson.id}#{n}",
                lesson=lesson,
                heading=heading,
                text=part,
                # Title and heading are searchable too: "ما هي دورة الماء" should
                # find the lesson even if the paragraph never repeats its title.
                search_text=f"{lesson.title}\n{heading}\n{heading}\n{part}",
            ))
    return chunks


def load_chunks(root: Path, only_reviewed: bool = False) -> tuple[list[Lesson], list[Chunk]]:
    lessons = load_lessons(root, only_reviewed)
    chunks = [c for lesson in lessons for c in chunk_lesson(lesson)]
    return lessons, chunks
