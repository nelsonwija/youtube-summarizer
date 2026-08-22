#!/usr/bin/env python3
"""Local transcript server for the Chrome extension.

GET /transcript?v=<videoId> -> {"ok": true, "transcript": "...", "language": "en"}
Uses jdepoix/youtube-transcript-api. Run: pip install -r requirements.txt && python server.py
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import json

from youtube_transcript_api import YouTubeTranscriptApi

PORT = 8791
api = YouTubeTranscriptApi()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")  # ponytail: extension origin
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path != "/transcript":
            return self._send(404, {"ok": False, "error": "not found"})
        q = parse_qs(u.query)
        vid = (q.get("v") or [""])[0]
        if not vid:
            return self._send(400, {"ok": False, "error": "missing ?v=videoId"})
        lang = (q.get("lang") or [""])[0]          # preferred language, e.g. "de"
        translate = (q.get("translate") or [""])[0]  # target lang, e.g. "en"
        try:
            tlist = api.list(vid)
            # prefer requested lang, then English, else fall back to any available
            prefer = [lang, "en"] if lang else ["en"]
            try:
                t = tlist.find_transcript(prefer)
            except Exception:
                t = next(iter(tlist))  # first available track, whatever language
            if translate and translate != t.language_code and t.is_translatable:
                t = t.translate(translate)
            fetched = t.fetch()
            text = " ".join(s.text for s in fetched).replace("\n", " ").strip()
            self._send(200, {"ok": True, "transcript": text, "language": fetched.language_code})
        except Exception as e:
            # RequestBlocked / IpBlocked / NoTranscriptFound / TranscriptsDisabled / etc.
            self._send(200, {"ok": False, "error": f"{type(e).__name__}: {e}"})

    def log_message(self, *_):  # quiet
        pass


if __name__ == "__main__":
    print(f"Transcript server on http://localhost:{PORT}  (Ctrl-C to stop)")
    HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
