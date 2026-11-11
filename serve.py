"""Local dev server with NO caching — use this instead of `python -m http.server`.
Run:  python serve.py        then open  http://localhost:8080
(Stops the browser from showing old JS/CSS after you replace files.)"""
import http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0].rstrip("/") in ("/terms", "/terms-of-service", "/tos"): self.path = "/terms.html"   # same as vercel.json
        super().do_GET()
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", 8080), H) as s:
    print("Serving (no-cache) on http://localhost:8080"); s.serve_forever()
