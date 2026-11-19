server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name test-app.volki-lzkv.ru;

    ssl_certificate /etc/letsencrypt/live/test-app.volki-lzkv.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test-app.volki-lzkv.ru/privkey.pem;
    auth_basic "CRM staging";
    auth_basic_user_file /etc/nginx/test-app.volki-lzkv.ru.htpasswd;
    # Login links carry tokens in the query string.
    access_log off;

    location / {
        proxy_pass http://127.0.0.1:3101;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Authorization "";
    }
}
