# -*- coding: utf-8 -*-
"""
dev-server.py — serveur local qui IMITE le routage Cloudflare Pages.
© 2026 IKCP · outil de dev uniquement (jamais utilisé en production).

Pourquoi : en prod, Cloudflare sert /app/bilan à partir de app/bilan.html
(URLs « propres », sans extension). Le python -m http.server standard ne le
fait pas -> 404 locaux trompeurs pendant les previews. Ce serveur ajoute :
  1. résolution sans extension : /app/bilan -> app/bilan.html
  2. page 404.html servie (avec le vrai statut 404) si rien ne correspond
Usage : python dev-server.py [port]   (défaut 5500)
"""
import http.server
import os
import sys
import urllib.parse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = os.path.dirname(os.path.abspath(__file__))


class PagesLikeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def send_head(self):
        # Sépare chemin et query (le routage ignore la query, comme Pages)
        parsed = urllib.parse.urlsplit(self.path)
        clean = urllib.parse.unquote(parsed.path)
        fs_path = self.translate_path(clean)

        # 1) Résolution sans extension : /app/bilan -> app/bilan.html
        if not os.path.exists(fs_path) and '.' not in os.path.basename(clean):
            candidate = clean.rstrip('/') + '.html'
            if os.path.exists(self.translate_path(candidate)):
                self.path = candidate + (('?' + parsed.query) if parsed.query else '')
                return super().send_head()

        # 2) 404 dédiée (vrai statut 404 + contenu 404.html), comme Pages
        if not os.path.exists(fs_path):
            page = os.path.join(ROOT, '404.html')
            if os.path.exists(page):
                body = open(page, 'rb').read()
                self.send_response(404)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                import io
                return io.BytesIO(body)

        return super().send_head()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('127.0.0.1', PORT), PagesLikeHandler) as srv:
        print(f'dev-server (routage type Cloudflare Pages) sur http://127.0.0.1:{PORT}')
        srv.serve_forever()
