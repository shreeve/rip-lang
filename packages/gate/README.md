# @rip-lang/gate

A bouncer for `@rip-lang/server`. Its only job: make sure nobody reaches your app without authenticating first. There is **zero interaction** between the gated app and the gate — the app just sees an authenticated request (and, behind a proxy, a `Remote-User` header).

Sessions are deliberately boring: a 128-bit random token in a cookie, backed by a file on disk. Argon2id passwords. Two ways to use it.

## How sessions work

On login, gate mints an unguessable 22-char base64url token and writes a file named after it (contents = the username) under a private session dir. "Is this session valid?" is one `stat`: the file exists and its mtime is within `ttl`.

- **No encryption, no signing.** An unguessable token *is* the proof; the filesystem is the source of truth. The cookie carries no PII.
- **Real server-side revocation** — the thing a stateless encrypted cookie can't give you:
  - log out / kill one session → `rm <dir>/<token>` (the `POST /_gate/logout` route does this)
  - kick everyone → `rm <dir>/*`
- **Sliding idle timeout** — each authed request bumps the file's mtime, so active users stay in; idle ones past `ttl` read as expired and are swept lazily.
- **Ephemeral by default** — sessions live in `/tmp/rip-gate`, so a reboot simply forces re-login (a feature for an auth gate, and no root needed).

The single `secret` is used **only** to HMAC-sign the login/logout CSRF token. It no longer encrypts anything.

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

get '/' -> "Hello! You're past the gate."

start port: 3000
```

Unauthenticated browser requests redirect to `/_gate/login`; API requests (no `Accept: text/html`) get `401`. Once past the gate, your handlers run normally. Gate keeps **no shared session** with your app — it's purely a bouncer. If a handler needs to know *who* the user is, run gate in forward-auth mode (Mode 2) and read the `Remote-User` header.

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
| `cookieName` | `__Host-rip_gate` / `rip_gate`         | Override session cookie name                                                           |
| `protect`    | `'all'`                                | `'all'`: auto-redirect unauthenticated requests. `'none'`: only expose `/_gate/*`      |
| `sessionDir` | `$XDG_RUNTIME_DIR/rip-gate` or `/tmp/rip-gate` | Where token files live. Created `0700`, refuses a dir it doesn't own.          |

`ttl` is an **idle** timeout (sliding): activity refreshes it. `verify` returning an object only uses its `.user` field (that's all gate stores and emits as `Remote-User`).

## Env vars (standalone mode)

| Var                  | Default               | Notes                                  |
| -------------------- | --------------------- | -------------------------------------- |
| `GATE_SECRET`        | (required)            | Cookie encryption key                  |
| `GATE_PORT`          | `9090`                | Standalone listen port                 |
| `GATE_SESSION_TTL`   | `28800`               | Session lifetime in seconds            |
| `GATE_PROTECT`       | `all`                 | `all` or `none`                        |
| `GATE_SESSION_DIR`   | `/tmp/rip-gate`       | Where token files live                 |
| `GATE_USER_<NAME>`   | -                     | One per user; value is the Argon2id hash |
| `NODE_ENV=production`| -                     | Forces `Secure` cookies + `__Host-` prefix |

## Endpoints

- `GET /_gate/check` — for `forward_auth`. `204` + `Remote-User` if authenticated, else `302` (browser) or `401` (API).
- `GET /_gate/login` — renders the login form.
- `POST /_gate/login` — verifies credentials, sets session cookie, redirects to `return_to`.
- `GET /_gate/logout` — renders a tiny "Sign out as X" confirmation form (side-effect free).
- `POST /_gate/logout` — deletes the session's token file server-side (CSRF-required).

## Security model

What actually guards the app, and what doesn't:

- **Access control** rests on two things a hostile client can't beat by forging headers: the **password** (Argon2id) needed to get a session, and the **128-bit random token** needed to use one. `curl` with any headers it likes still hits those walls.
- **CSRF protection** is a separate concern — it protects honest *browser* users from a malicious third-party page abusing their cookie. It is never the access wall, so "but curl can fake `Origin`" doesn't matter: a direct attacker has no victim cookie to abuse. Gate uses a **signed double-submit cookie**: the CSRF token is `nonce.HMAC(secret, nonce)`, planted in both a cookie and the form's hidden `_csrf`; `POST` requires cookie == form **and** a valid HMAC. `SameSite=Lax` keeps the cookie off cross-site POSTs.

Other defenses: server-enforced mtime TTL (a stolen-but-idle cookie expires server-side regardless of the browser), `Remote-User` is ASCII-validated before it's emitted, `return_to` is sanitized to a same-origin path, and unknown users cost the same Argon2id time as a wrong password (no timing enumeration).

## Notes

- A single `use gate({...})` registers the `/_gate/*` routes and returns the gate middleware. Call it once.
- **`Remote-User` trust:** the reverse proxy MUST strip any client-supplied `Remote-User` before the auth subrequest (the Caddy/nginx configs above do). Otherwise a client could spoof an identity.
- **Logout revokes server-side** — `POST /_gate/logout` deletes the token file, so a copy of the cookie captured beforehand stops working immediately. (A stolen cookie still works until *its* file is removed or expires — short `ttl` plus `rm` are your controls.)
- **Multi-user hosts:** `/tmp` is world-writable, so gate creates the session dir `0700` and refuses one it doesn't own (defeats symlink/pre-create tricks). On a dedicated server this is moot.
- Gate doesn't throttle login attempts — put it behind CrowdSec or Caddy `rate_limit` if you're exposed to the public internet.

## Files

- `index.rip` — middleware + standalone bootstrap (fires only when this file is the app entry)
- `test.rip` — end-to-end tests with inline harness

That's the whole package.

## License

MIT
