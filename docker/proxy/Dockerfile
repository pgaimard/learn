FROM caddy:2.11.9-alpine
RUN adduser -D -H -u 1000 app && chown -R app:app /data /config
COPY docker/proxy/Caddyfile /etc/caddy/Caddyfile
USER app
