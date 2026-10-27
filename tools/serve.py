"""Static dev server with caching disabled, so edited ES modules always reload."""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) == 2 else 8080
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass

# Threaded: browsers fetch ES modules in parallel, and a single-threaded
# server refuses the extra connections.
class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

with Server(('', PORT), NoCache) as httpd:
    print(f'Ashen Vigil running at http://localhost:{PORT}')
    httpd.serve_forever()
