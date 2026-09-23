#!/usr/bin/env python3
"""Start مَدَد on this laptop and on the home Wi-Fi.

    python3 run.py                       # gemma3:4b, port 8080
    python3 run.py --model qwen2.5:3b
    python3 run.py --only-reviewed       # hide lessons no teacher has checked

Needs only Python 3.9+ and Ollama (https://ollama.com). No internet after setup.
"""

import argparse
import os
import socket
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from engine.curriculum import load_chunks  # noqa: E402
from engine.ollama import OllamaClient  # noqa: E402
from engine.retrieval import Index, load_synonyms  # noqa: E402
from engine.server import serve  # noqa: E402
from engine.tutor import Tutor, TutorConfig  # noqa: E402


def lan_addresses() -> list[str]:
    """Addresses a phone on the same Wi-Fi can reach. Works with no internet:
    connecting a UDP socket sends nothing, it only asks the OS for a route."""
    addrs = set()
    for probe in ("10.255.255.255", "192.168.255.255", "172.31.255.255"):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect((probe, 1))
                addrs.add(s.getsockname()[0])
        except OSError:
            pass
    try:
        addrs.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    return sorted(a for a in addrs if not a.startswith("127."))


def main():
    p = argparse.ArgumentParser(description="مَدَد — معلم ذكاء اصطناعي يعمل دون إنترنت")
    p.add_argument("--host", default=os.environ.get("MADAD_HOST", "0.0.0.0"))
    p.add_argument("--port", type=int, default=int(os.environ.get("MADAD_PORT", "8080")))
    p.add_argument("--model", default=os.environ.get("MADAD_MODEL", "gemma3:4b"))
    p.add_argument("--ollama", default=os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434"))
    p.add_argument("--curriculum", default=str(HERE / "curriculum"))
    p.add_argument("--only-reviewed", action="store_true")
    p.add_argument("--min-coverage", type=float, default=0.34)
    p.add_argument("--no-log", action="store_true", help="لا تحفظ سجل الأسئلة والإجابات")
    args = p.parse_args()

    ollama_host = args.ollama if args.ollama.startswith("http") else f"http://{args.ollama}"
    lessons, chunks = load_chunks(Path(args.curriculum), args.only_reviewed)
    if not lessons:
        sys.exit(f"لا توجد دروس في {args.curriculum}")
    llm = OllamaClient(ollama_host, args.model)
    tutor = Tutor(Index(chunks, load_synonyms(Path(args.curriculum) / "synonyms.txt")), llm, TutorConfig(
        min_coverage=args.min_coverage,
        log_dir=None if args.no_log else HERE / "logs",
    ))

    h = llm.health()
    print(f"\n  مَدَد | MADAD — {len(lessons)} درس، {len(chunks)} مقطع")
    print(f"  النموذج: {args.model} — {'جاهز ✓' if h['ok'] else 'غير جاهز ✗ ' + (h['error'] or '')}")
    print(f"\n  على هذا الجهاز:   http://localhost:{args.port}")
    for a in lan_addresses():
        print(f"  من هواتف البيت:   http://{a}:{args.port}")
    print("\n  Ctrl+C للإيقاف\n")

    httpd = serve(tutor, lessons, llm.health, args.host, args.port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
