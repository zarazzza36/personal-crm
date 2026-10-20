# App: proxies to the app container, published on 127.0.0.1 only
# (deploy/app/compose.yaml). Answers 502 until the first deploy.
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.volki-lzkv.ru;
    include snippets/volki-lzkv-tls.conf;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
