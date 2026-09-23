"""HTTP server for the home network. Standard library only.

Binds to 0.0.0.0 so children's phones on the same Wi-Fi can open it — the
router does not need an internet connection for that.

  GET  /                 the app (web/index.html)
  GET  /api/health       is Ollama running, is the model pulled
  GET  /api/catalog      grades → subjects → lessons
  GET  /api/lesson?id=   one lesson's full text
  POST /api/ask          streamed answer, one JSON object per line
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .curriculum import Lesson
from .tutor import Tutor

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
MAX_BODY = 64 * 1024
MAX_QUESTION = 1000


def build_catalog(lessons: list[Lesson]) -> list[dict]:
    grades: dict[str, dict] = {}
    for l in lessons:
        g = grades.setdefault(l.grade_id, {"id": l.grade_id, "name": l.grade, "subjects": {}})
        s = g["subjects"].setdefault(l.subject_id, {"id": l.subject_id, "name": l.subject, "lessons": []})
        s["lessons"].append({"id": l.id, "title": l.title, "reviewed": l.reviewed})
    return [{**g, "subjects": list(g["subjects"].values())} for g in grades.values()]


def make_handler(tutor: Tutor, lessons: list[Lesson], health):
    catalog = build_catalog(lessons)
    by_id = {l.id: l for l in lessons}

    class Handler(BaseHTTPRequestHandler):
        server_version = "Madad/0.1"

        def log_message(self, fmt, *args):  # quieter console: only errors
            if args and str(args[1]).startswith(("4", "5")):
                super().log_message(fmt, *args)

        def _json(self, obj, status=200):
            body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            url = urlparse(self.path)
            if url.path in ("/", "/index.html"):
                body = (WEB_DIR / "index.html").read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif url.path == "/api/health":
                self._json({**health(), "lessons": len(lessons)})
            elif url.path == "/api/catalog":
                self._json({"grades": catalog})
            elif url.path == "/api/lesson":
                lesson = by_id.get(parse_qs(url.query).get("id", [""])[0])
                if not lesson:
                    return self._json({"error": "not found"}, 404)
                self._json({"id": lesson.id, "title": lesson.title, "grade": lesson.grade,
                            "subject": lesson.subject, "source": lesson.source,
                            "reviewed": lesson.reviewed, "reviewer": lesson.reviewer,
                            "body": lesson.body})
            else:
                self._json({"error": "not found"}, 404)

        def do_POST(self):
            if urlparse(self.path).path != "/api/ask":
                return self._json({"error": "not found"}, 404)
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length <= 0 or length > MAX_BODY:
                return self._json({"error": "bad request size"}, 413 if length > MAX_BODY else 400)
            try:
                req = json.loads(self.rfile.read(length))
            except ValueError:
                return self._json({"error": "invalid json"}, 400)
            question = str(req.get("question", "")).strip()
            if not question or len(question) > MAX_QUESTION:
                return self._json({"error": "السؤال فارغ أو طويل جدًا"}, 400)
            history = req.get("history") if isinstance(req.get("history"), list) else []

            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                for event in tutor.answer(
                    question,
                    mode=str(req.get("mode") or ""),
                    grade_id=req.get("grade") or None,
                    subject_id=req.get("subject") or None,
                    history=history,
                ):
                    self.wfile.write((json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8"))
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass  # the child closed the page mid-answer

    return Handler


def serve(tutor: Tutor, lessons: list[Lesson], health, host: str, port: int) -> ThreadingHTTPServer:
    httpd = ThreadingHTTPServer((host, port), make_handler(tutor, lessons, health))
    httpd.daemon_threads = True
    return httpd
