# @rip-lang/gate

Tiny cookie-auth middleware for `@rip-lang/server`. Encrypted-cookie session (Rack::Session::Cookie-style, but AES-256-GCM). Argon2id passwords. Two ways to use it.

## Install

```bash
bun add @rip-lang/gate
```

## Mode 1: Middleware in a Rip app

Drop it into any Rip server app and everything below is protected:

```coffee
import { get, start } from '@rip-lang/server'
import { gate } from '@rip-lang/gate'

use gate
  secret: process.env.GATE_SECRET
  users:
    alice: '$argon2id$v=19$m=65536,t=2,p=1$...'

get '/' -> "Hello, #{@session.user}!"

start port: 3000
```

Unauthenticated browser requests redirect to `/_gate/login`; API requests (no `Accept: text/html`) get `401`. After login, `@session.user` is set and handlers run normally.

Generate an Argon2id hash for the `users` map:

```bash
bun -e "console.log(await Bun.password.hash(process.argv[1], { algorithm: 'argon2id' }))" 'hunter2'
```

## Mode 2: Standalone behind a reverse proxy

For protecting non-Rip apps (Incus, third-party tools), run gate as its own service and let the front proxy ask it whether each request is allowed. `index.rip` is both the middleware module AND a self-bootstrapping app entry — when `rip server` runs it as the entry, it reads `GATE_*` env vars and installs itself.

```bash
hash() { bun -e "console.log(await Bun.password.hash(process.argv[1], { algorithm: 'argon2id' }))" "$1"; }
export GATE_SECRET="$(openssl rand -base64 32)"
export GATE_USER_ALICE="$(hash 'hunter2')"
export NODE_ENV=production            # forces Secure cookies + __Host- prefix
rip server packages/gate
```

### Caddy

```caddyfile
app.example.com {
  # /_gate/* is gate's UI surface (login, logout confirmation).
  handle /_gate/* {
    reverse_proxy 127.0.0.1:9090
  }

  # Everything else is auth-gated, with the protected app's identity
  # populated from gate's Remote-User response header. The pre-auth
  # request_header strip prevents clients from spoofing it.
  handle {
    request_header -Remote-User
    forward_auth 127.0.0.1:9090 {
      uri /_gate/check
      copy_headers Remote-User
    }
    reverse_proxy 127.0.0.1:3000
  }
}
```

### nginx

`ngx_http_auth_request_module` only treats `2xx` as allow and `401`/`403` as deny — any `3xx` from the auth endpoint becomes a `500`. Two adjustments make Gate work with it:

1. Send `Accept: application/json` on the subrequest so Gate returns `401` (not its browser-friendly `302`).
2. Wire `error_page 401` to a named location that redirects to `/_gate/login`.

```nginx
server {
  listen 443 ssl;
  server_name app.example.com;
  # ... TLS config ...

  # Gate's UI surface
  location /_gate/ {
    proxy_pass http://127.0.0.1:9090;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Internal subrequest endpoint for auth_request
  location = /_gate/auth {
    internal;
    proxy_pass                       http://127.0.0.1:9090/_gate/check;
    proxy_pass_request_body          off;
    proxy_set_header Content-Length  "";
    proxy_set_header X-Forwarded-Uri    $request_uri;
    proxy_set_header X-Forwarded-Method $request_method;
    proxy_set_header X-Forwarded-Host   $host;
    proxy_set_header X-Forwarded-Proto  $scheme;
    proxy_set_header Cookie             $http_cookie;
    proxy_set_header Accept             "application/json";  # → Gate returns 401, not 302
  }

  # Protected app
  location / {
    proxy_set_header Remote-User "";   # strip client-supplied Remote-User
    auth_request                /_gate/auth;
    auth_request_set $remote_user $upstream_http_remote_user;
    error_page 401 = @gate_login;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Remote-User $remote_user;
    proxy_set_header Host        $host;
  }

  location @gate_login {
    return 302 /_gate/login?return_to=$request_uri;
  }
}
```

Traefik's `forwardAuth` and Envoy's `ext_authz` behave like Caddy (Gate's `302` forwards directly, no extra config).

## Options

| Option       | Default                                | Notes                                                                                  |
| ------------ | -------------------------------------- | -------------------------------------------------------------------------------------- |
| `secret`     | (required)                             | Cookie encryption + CSRF signing key                                                   |
| `users`      | `{}`                                   | `{ username: argon2id-hash }` map                                                      |
| `verify`     | -                                      | `async (user, pass) -> {user, ...} \| null` — overrides `users` for custom backends    |
| `template`   | built-in HTML form                     | `({csrfToken, error, returnTo, host}) -> HTML` — bring your own login page             |
| `ttl`        | `28800` (8h)                           | Session lifetime in seconds                                                            |
| `secure`     | `NODE_ENV=production`                  | Force `Secure` cookie attribute                                                        |
| `cookieName` | `__Host-rip_gate` / `rip_gate`         | Override cookie name                                                                   |
| `protect`    | `'all'`                                | `'all'`: auto-redirect unauthenticated requests. `'none'`: only expose `/_gate/*`      |

## Env vars (standalone mode)

| Var                  | Default               | Notes                                  |
| -------------------- | --------------------- | -------------------------------------- |
| `GATE_SECRET`        | (required)            | Cookie encryption key                  |
| `GATE_PORT`          | `9090`                | Standalone listen port                 |
| `GATE_SESSION_TTL`   | `28800`               | Session lifetime in seconds            |
| `GATE_PROTECT`       | `all`                 | `all` or `none`                        |
| `GATE_USER_<NAME>`   | -                     | One per user; value is the Argon2id hash |
| `NODE_ENV=production`| -                     | Forces `Secure` cookies + `__Host-` prefix |

## Endpoints

- `GET /_gate/check` — for `forward_auth`. `204` + `Remote-User` if authenticated, else `302` (browser) or `401` (API).
- `GET /_gate/login` — renders the login form.
- `POST /_gate/login` — verifies credentials, sets session cookie, redirects to `return_to`.
- `GET /_gate/logout` — renders a tiny "Sign out as X" confirmation form (side-effect free).
- `POST /_gate/logout` — clears session (CSRF-required).

## How the crypto compares

Rack::Session::Cookie defaults to `Base64(JSON)--HMAC-SHA1` — tamper-proof but client-readable. Gate uses Rip's existing `sessions({encrypt: true})` middleware, which is AES-256-GCM AEAD — tamper-proof AND confidential. Same operational shape, stronger storage.

CSRF tokens are derived from the session via `HMAC(secret, "csrf:" + session.created)` — no second cookie needed. Forms post the token as `_csrf`.

## Notes

- A single `use gate({...})` does two things: installs the `sessions` middleware and registers the `/_gate/*` routes. Don't call it more than once.
- **Logout is stateless.** `POST /_gate/logout` deletes the browser's cookie, but a copy captured before logout remains usable until `ttl` expires. Short TTLs are the revocation mechanism; if you need server-side revocation, that's a v0.2 extension.
- Gate doesn't throttle login attempts on its own — put it behind CrowdSec or Caddy `rate_limit` if you need that.

## Files

- `index.rip` — middleware + standalone bootstrap (fires only when this file is the app entry)
- `test.rip` — end-to-end tests with inline harness

That's the whole package.

## License

MIT
