"""Minimal Ollama client over urllib — the laptop needs nothing but Python."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Iterator


class OllamaError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self, host: str, model: str, timeout: float = 300):
        self.host = host.rstrip("/")
        self.model = model
        self.timeout = timeout

    def _post(self, path: str, payload: dict, timeout: float):
        req = urllib.request.Request(
            self.host + path,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            raise OllamaError(f"Ollama HTTP {e.code}: {detail}") from e
        except (urllib.error.URLError, OSError) as e:
            raise OllamaError(f"لا يمكن الوصول إلى Ollama على {self.host}: {e}") from e

    def health(self) -> dict:
        try:
            with urllib.request.urlopen(self.host + "/api/tags", timeout=3) as r:
                models = [m["name"] for m in json.load(r).get("models", [])]
        except (urllib.error.URLError, OSError, ValueError) as e:
            return {"ok": False, "error": str(e), "model": self.model, "models": []}
        present = self.model in models or f"{self.model}:latest" in models
        return {"ok": present, "model": self.model, "models": models,
                "error": None if present else f"النموذج {self.model} غير محمّل. شغّل: ollama pull {self.model}"}

    def chat_stream(self, messages: list[dict], options: dict | None = None) -> Iterator[str]:
        payload = {"model": self.model, "messages": messages, "stream": True,
                   "options": options or {}}
        with self._post("/api/chat", payload, self.timeout) as resp:
            for line in resp:
                if not line.strip():
                    continue
                data = json.loads(line)
                if data.get("error"):
                    raise OllamaError(data["error"])
                piece = data.get("message", {}).get("content", "")
                if piece:
                    yield piece
                if data.get("done"):
                    return
