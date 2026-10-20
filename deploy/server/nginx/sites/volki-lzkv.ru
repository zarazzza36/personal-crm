# Landing. Shows the placeholder page until the landing is deployed here.
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name volki-lzkv.ru;
    include snippets/volki-lzkv-tls.conf;

    root /var/www/stub;
    location / {
        try_files /index.html =404;
    }
}
