# nginx Integration

Rip Server can generate a production-hardened `nginx.conf` from your `serve.rip`
config. This gives you nginx's battle-tested TLS termination, HTTP/2, rate
limiting, and connection handling -- all driven by the same 14-line config file.

## Building nginx

Build a minimal nginx with the required modules in an Incus container, then
copy the result to the host. No build tools needed on the production machine.

### Step 1: Create a build container

```bash
incus launch images:ubuntu/24.04 build
```

### Step 2: Compile nginx in the container

```bash
nginx=1.30.0
incus exec build -- bash -c '
apt update && apt install -y build-essential libpcre2-dev libssl-dev zlib1g-dev curl
cd /tmp
curl -O https://nginx.org/download/nginx-'"$nginx"'.tar.gz
tar xzf nginx-'"$nginx"'.tar.gz
cd nginx-'"$nginx"'
./configure \
  --prefix=/opt/nginx-'"$nginx"' \
  --with-http_ssl_module \
  --with-http_v2_module \
  --with-stream \
  --with-stream_ssl_preread_module \
  --with-pcre-jit
make -j$(nproc)
make install
'
```

### Step 3: Copy to the host and symlink

```bash
sudo incus file pull -r build/opt/nginx-$nginx /opt/
sudo ln -sfn /opt/nginx-$nginx /opt/nginx
/opt/nginx/sbin/nginx -V
```

### Step 4: Clean up

```bash
incus delete build --force
```

Everything lives under `/opt/nginx-1.30.0/` -- binary, config, logs, pid file.
The symlink at `/opt/nginx` always points to the current version.

## Generating nginx.conf

Given a `serve.rip` like this:

```coffee
export default
  ssl: '/home/shreeve/ssl'
  hsts: true

  sites:
    incus:    'incus.trusthealth.com'
    zion:     'dev.zionlabshare.com'
    redmine:  'projects.trusthealth.com'
    medlabs:  '*.medlabs.health'

  apps:
    incus:    'tcp://127.0.0.1:8443 incus'
    zion:     '/home/shreeve/www zion browse'
    redmine:  'http://127.0.0.1:7101 redmine'
    medlabs:  'http://127.0.0.1:7201 medlabs'
```

Generate and deploy:

```bash
rip server -n > /opt/nginx/conf/nginx.conf
sudo /opt/nginx/sbin/nginx -t && sudo /opt/nginx/sbin/nginx -s reload
```

Or for a fresh start:

```bash
rip server -n > /opt/nginx/conf/nginx.conf
sudo /opt/nginx/sbin/nginx
```

## Generated output

The command above produces the following `nginx.conf`:

```nginx
worker_processes auto;
pid logs/nginx.pid;
pcre_jit on;

events {
    worker_connections 4096;
    multi_accept on;
}

stream {

    map $ssl_preread_server_name $tls_backend {
        incus.trusthealth.com stream_tcp_incus;
        default https_terminator;
    }

    upstream stream_tcp_incus {
        server 127.0.0.1:8443;
    }
    upstream https_terminator {
        server 127.0.0.1:4443;
    }

    server {
        listen 443;
        listen [::]:443;
        proxy_pass $tls_backend;
        ssl_preread on;
        proxy_connect_timeout 10s;
        proxy_timeout 1h;
    }
}

http {
    include mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - [$time_local] "$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" host=$host '
                    'rt=$request_time urt=$upstream_response_time';
    access_log logs/access.log main;
    error_log logs/error.log warn;

    server_tokens off;
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    keepalive_requests 1000;
    client_max_body_size 100m;
    max_headers 100;

    client_body_timeout 15s;
    client_header_timeout 15s;
    send_timeout 30s;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:50m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;
    ssl_ecdh_curve X25519:prime256v1:secp384r1;

    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 1.0.0.1 8.8.8.8 8.8.4.4 valid=300s ipv6=off;
    resolver_timeout 5s;

    limit_req_zone $binary_remote_addr zone=perip:10m rate=20r/s;
    limit_conn_zone $binary_remote_addr zone=connperip:10m;

    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 80;
        listen [::]:80;
        server_name incus.trusthealth.com dev.zionlabshare.com projects.trusthealth.com *.medlabs.health;
        return 301 https://$host$request_uri;
    }

    server {
        listen 127.0.0.1:4443 ssl;
        http2 on;
        server_name dev.zionlabshare.com;

        ssl_certificate /home/shreeve/ssl/zionlabshare.com.crt;
        ssl_certificate_key /home/shreeve/ssl/zionlabshare.com.key;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-Frame-Options "SAMEORIGIN" always;

        limit_req zone=perip burst=40 nodelay;
        limit_conn connperip 20;

        root /home/shreeve/www;
        index index.html;

        location / {
            autoindex on;
            try_files $uri $uri/ =404;
        }

        location ~ /\. {
            deny all;
        }
    }

    server {
        listen 127.0.0.1:4443 ssl;
        http2 on;
        server_name projects.trusthealth.com;

        ssl_certificate /home/shreeve/ssl/trusthealth.com.crt;
        ssl_certificate_key /home/shreeve/ssl/trusthealth.com.key;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-Frame-Options "SAMEORIGIN" always;

        limit_req zone=perip burst=40 nodelay;
        limit_conn connperip 20;

        location / {
            proxy_pass http://127.0.0.1:7101;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port 443;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 1h;
            proxy_send_timeout 1h;
        }
    }

    server {
        listen 127.0.0.1:4443 ssl;
        http2 on;
        server_name *.medlabs.health;

        ssl_certificate /home/shreeve/ssl/medlabs.health.crt;
        ssl_certificate_key /home/shreeve/ssl/medlabs.health.key;

        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header X-Frame-Options "SAMEORIGIN" always;

        limit_req zone=perip burst=40 nodelay;
        limit_conn connperip 20;

        location / {
            proxy_pass http://127.0.0.1:7201;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto https;
            proxy_set_header X-Forwarded-Host $host;
            proxy_set_header X-Forwarded-Port 443;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 1h;
            proxy_send_timeout 1h;
        }
    }

    server {
        listen 127.0.0.1:4443 ssl default_server;
        http2 on;
        server_name _;

        ssl_certificate /home/shreeve/ssl/medlabs.health.crt;
        ssl_certificate_key /home/shreeve/ssl/medlabs.health.key;

        return 421;
    }
}
```

## How it works

The `stream {}` block owns public port 443 and uses `ssl_preread` to inspect
the TLS ClientHello SNI without terminating TLS:

- `incus.trusthealth.com` is routed directly to its TCP backend (Layer 4 passthrough)
- Everything else is forwarded to `127.0.0.1:4443` where nginx terminates TLS

The `http {}` block handles TLS termination on the internal port and routes by
virtual host:

- **Static serving** with directory listing (`dev.zionlabshare.com`)
- **HTTP reverse proxy** with WebSocket support (`projects.trusthealth.com`, `*.medlabs.health`)
- **HTTP-to-HTTPS redirect** on port 80 for all hostnames
- **Default catch-all** returning 421 for unknown hostnames

When no TCP passthrough apps exist, the `stream {}` block is omitted entirely
and `http {}` listens directly on port 443.

## Multi-path sites

When a site binds multiple apps at distinct path prefixes (`site@/path` syntax
in `serve.rip`), the generator emits one `server { … }` block per hostname
with one `location <mountPath>` per route, sorted by descending path
specificity so nginx's longest-prefix rule matches the user's intent.

Given:

```coffee
sites:
  relay: 'relay.trusthealth.com'

apps:
  mqtt: 'http://127.0.0.1:9001 relay@/mqtt'
  repl: '/var/www/relay-repl relay@/repl browse'
```

`rip server -n` emits (abbreviated):

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name relay.trusthealth.com;

    ssl_certificate     /home/shreeve/ssl/trusthealth.com.crt;
    ssl_certificate_key /home/shreeve/ssl/trusthealth.com.key;

    # ... HSTS + security headers + rate limits ...

    location /mqtt {
        proxy_pass http://127.0.0.1:9001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        # ... X-Forwarded-* ...
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
        proxy_buffering off;
    }

    location = /repl { return 301 /repl/; }
    location /repl/ {
        alias /var/www/relay-repl/;
        index index.html;
        autoindex on;
        try_files $uri $uri/ =404;
    }

    location ~ /\. {
        deny all;
    }
}
```

Two conventions the generator follows:

- **Proxy mounts omit the trailing slash** (`location /mqtt`) so bare URLs
  like `wss://host/mqtt` (common for MQTT/WS firmware) match directly.
  `/mqttfake` technically matches too, but the upstream backend 4xx's it —
  harmless.
- **Static subpath mounts use trailing slash** (`location /repl/`) plus an
  exact-match redirect (`location = /repl { return 301 /repl/; }`) so bare
  `/repl` sends browsers to the canonical trailing-slash URL. `alias` then
  strips the prefix before resolving against the filesystem root.
- **Root-mounted static** keeps using `root` (no `alias`).

## Upgrading nginx

Build the new version in a container, pull it to `/opt/nginx-X.Y.Z`, and move
the symlink:

```bash
sudo ln -sfn /opt/nginx-1.32.0 /opt/nginx
sudo /opt/nginx/sbin/nginx -t && sudo /opt/nginx/sbin/nginx -s reload
```

The old version stays on disk for instant rollback.
