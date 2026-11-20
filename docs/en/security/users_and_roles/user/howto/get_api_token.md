---
weight: 10
---

# Obtain an API Access Token

This guide explains how to obtain an ACP platform access token via API calls. It is intended for scenarios where you need to access platform APIs programmatically.

## Overview

ACP uses a Dex-based OIDC authentication system. The login flow follows the OAuth 2.0 Authorization Code Flow and consists of five API calls that **must be completed within the same HTTP session (sharing cookies)**.

```text
Step 1: Retrieve login metadata
    GET /console-platform/api/v1/token/login

Step 2: Obtain the Dex request ID (req_id)
    GET /dex/api/v1/authorize  ← uses query parameters from the auth_url returned in Step 1

Step 3: Retrieve the RSA public key
    GET /dex/pubkey

Step 4: Submit encrypted credentials and obtain the authorization code
    POST /dex/api/v1/authorize/{idp}?req={req_id}

Step 5: Exchange the authorization code for a token
    GET /console-platform/api/v1/token/callback
```

:::warning

The entire flow must use the same HTTP session (shared cookie jar). Step 2 sets the `cpaas_oidc_auth_flow` session cookie, which Step 5 requires to issue a token. Without this cookie, Step 5 returns `invalid authentication session`.

:::

## Prerequisites

| Parameter | Description | Value |
|-----------|-------------|-------|
| `PLATFORM_URL` | Platform HTTPS base URL (no trailing path) | `https://<platform>` |
| `CLIENT_ID` | OAuth client ID (fixed) | `alauda-auth` |
| `SCOPE` | Requested permission scopes (fixed) | `openid profile offline_access email groups ext` |
| `REDIRECT_URI` | Callback URL (fixed) | `{PLATFORM_URL}/dex/callback` |
| `IDP` | Identity provider ID | `local` (default for local accounts), `ldap`, `oidc`, etc. |

## Steps

### Step 1: Retrieve Login Metadata

**Request:**

```text
GET /console-platform/api/v1/token/login
```

Query parameters:

| Parameter | Value |
|-----------|-------|
| `client_id` | `alauda-auth` |
| `redirect_uri` | `https://{platform}/dex/callback` |
| `response_type` | `code` |
| `scope` | `openid profile offline_access email groups ext` |

**Response (200 OK):**

```json
{
  "auth_url": "https://{platform}/console-dex/auth?access_type=offline&client_id=alauda-auth&code_challenge=...&state=...&...",
  "state": "VpweqrTxqHxpXZzjNOUe1Zbqe7fPIYFN3_HoEYAxWnA",
  "logout_url": "https://{platform}/dex/logout?post_logout_redirect_uri=...&state=..."
}
```

:::note

The `code_challenge` and related parameters in `auth_url` are generated server-side for the server-to-Dex PKCE exchange and stored in the `cpaas_oidc_auth_flow` cookie. You do not need to interpret them. In Step 2, pass the **complete query string** from `auth_url` as-is.

:::

---

### Step 2: Obtain the Dex Request ID

Use the query parameters from the `auth_url` returned in Step 1.

**This step sets the `cpaas_oidc_auth_flow` session cookie. All subsequent requests must carry this cookie.**

**Request:**

```text
GET /dex/api/v1/authorize?{query_from_auth_url}
```

Where `{query_from_auth_url}` is the complete query string extracted from the Step 1 `auth_url` (forward it unchanged):

```text
access_type=offline&client_id=alauda-auth&code_challenge=...&code_challenge_method=S256
&nonce=...&redirect_uri=...&response_type=code&scope=...&state=...
```

**Response (200 OK):**

```json
{
  "req": "kyrqxpv6tvnj5a3efhkou3seocnehfxout42rb3p75q3g3oue6u"
}
```

---

### Step 3: Retrieve the RSA Public Key

**Request:**

```text
GET /dex/pubkey
```

**Response (200 OK):**

```json
{
  "ts": "1779940350",
  "pubkey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...\n-----END PUBLIC KEY-----\n",
  "pubkey_encode": "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0K..."
}
```

| Field | Description |
|-------|-------------|
| `ts` | Timestamp. Must be included in the encrypted payload. Fetch a fresh value for each login attempt. |
| `pubkey` | RSA public key in PEM format, used to encrypt the password. |
| `pubkey_encode` | Base64-encoded form of `pubkey`. Equivalent to `pubkey`. |

---

### Step 4: Submit Encrypted Credentials and Obtain the Authorization Code

**Password encryption:**

1. Construct a JSON payload: `{"ts": "<ts from Step 3>", "password": "<plaintext password>"}`
2. Encrypt the JSON bytes using the RSA public key with **PKCS#1 v1.5** padding
3. Base64-encode the encrypted result (standard encoding, not URL-safe)

**Request:**

```text
POST /dex/api/v1/authorize/{idp}?req={req_id}
Content-Type: application/json
Cookie: cpaas_oidc_auth_flow=...
```

Path parameter:

| Parameter | Description |
|-----------|-------------|
| `{idp}` | Identity provider ID: `local` (local accounts), `ldap`, etc. |

Query parameter:

| Parameter | Value |
|-----------|-------|
| `req` | The `req` ID returned in Step 2 |

Request body:

```json
{
  "account": "admin",
  "password": "<RSA-encrypted Base64 string>"
}
```

**Response (200 OK):**

```json
{
  "session_state": "",
  "redirect_url": "https://{platform}/dex/callback?code=qdul75ionlvlsn3ggg2m...&state=VpweqrTxqH..."
}
```

Extract the `code` and `state` parameters from `redirect_url` for use in Step 5.

---

### Step 5: Exchange the Authorization Code for a Token

**Request:**

```text
GET /console-platform/api/v1/token/callback
Cookie: cpaas_oidc_auth_flow=...
```

Query parameters:

| Parameter | Source | Required |
|-----------|--------|----------|
| `code` | Extracted from `redirect_url` in Step 4 | Yes |
| `state` | Extracted from `redirect_url` in Step 4 | Yes |

**Response (200 OK):**

```json
{
  "token_type": "bearer",
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "refresh_token": "CjNuY3V3bmRvcW90NjRwaHl4NXB5bndiY2Zuc2MzcXhkdGhud2...",
  "expire_at": "2025-01-02T12:00:00Z",
  "issued_at": "2025-01-01T12:00:00Z",
  "token_storage": "local"
}
```

| Field | Description |
|-------|-------------|
| `access_token` | JWT for API access. Pass as `Authorization: Bearer <token>` in request headers. |
| `id_token` | JWT containing user identity claims (email, username, etc.). |
| `refresh_token` | Opaque string used to refresh the `access_token`. |
| `expire_at` | Expiry time of the `access_token` (UTC). |
| `issued_at` | Issue time of the `access_token` (UTC). |
| `token_storage` | Token storage location. Fixed value: `local`. |

## Complete Example

### Shell Script (curl)

curl maintains the session by sharing a cookie jar file via `-c` (write cookies) and `-b` (read cookies).

**Dependencies:** `curl`, `jq` (JSON parsing), `openssl` (RSA encryption)

**Usage:**

```bash
# Option 1: edit the configuration section in the script, then run it
bash acp-login.sh

# Option 2: pass credentials via environment variables (recommended — avoids plaintext passwords in the script)
ACP_PLATFORM=https://<platform> ACP_USERNAME=admin ACP_PASSWORD=xxx bash acp-login.sh

# Extract the access_token
bash acp-login.sh | jq -r '.access_token'
```

```bash
#!/usr/bin/env bash
# ACP platform API login script — obtains an access token via the OAuth2 Authorization Code Flow
# Dependencies: curl jq openssl

set -euo pipefail

# ============================================================
# Configuration (can be overridden by environment variables of the same name)
# ============================================================
PLATFORM="${ACP_PLATFORM:-https://your.platform.com}"   # Platform base URL, no trailing path
USERNAME="${ACP_USERNAME:-admin}"                       # Username
PASSWORD="${ACP_PASSWORD:-}"                            # Password (recommended: pass via ACP_PASSWORD env var)
IDP="${ACP_IDP:-local}"                                # Identity provider: local | ldap | oidc
# ============================================================

CLIENT_ID="alauda-auth"
SCOPE="openid profile offline_access email groups ext"
REDIRECT_URI="${PLATFORM}/dex/callback"

log() { echo "$*" >&2; }
die() { echo "ERROR: $*" >&2; exit 1; }

check_deps() {
    local missing=()
    for cmd in curl jq openssl; do
        command -v "$cmd" &>/dev/null || missing+=("$cmd")
    done
    [[ ${#missing[@]} -eq 0 ]] || die "Missing required tools: ${missing[*]}"
}

check_vars() {
    [[ -n "${PLATFORM}" ]] || die "PLATFORM must not be empty"
    [[ -n "${USERNAME}" ]] || die "USERNAME must not be empty"
    [[ -n "${PASSWORD}" ]] || die "PASSWORD must not be empty (set the ACP_PASSWORD environment variable or fill it in the script)"
}

urlencode() { jq -rn --arg v "$1" '$v|@uri'; }

# Extract a field from a JSON response; print the response and exit if the field is missing
get_field() {
    local json="$1" field="$2" label="$3"
    local val
    val=$(printf '%s' "$json" | jq -r --arg f "$field" '.[$f] // empty' 2>/dev/null) \
      || die "${label}: jq parse failed"
    [[ -n "$val" ]] || die "${label}: field '${field}' missing from response
$(printf '%s' "$json" | jq . 2>/dev/null || printf '%s' "$json")"
    printf '%s' "$val"
}

# Extract a query parameter value from a URL
query_param() {
    printf '%s' "$1" | grep -o "${2}=[^&]*" | cut -d= -f2-
}

main() {
    check_deps
    check_vars

    local COOKIE_JAR PUBKEY_RESP PUBKEY_PEM PAYLOAD
    COOKIE_JAR=$(mktemp /tmp/acp-login-XXXXXX.jar)
    PUBKEY_RESP=$(mktemp /tmp/acp-pubkey-XXXXXX.json)
    PUBKEY_PEM=$(mktemp /tmp/acp-key-XXXXXX.pem)
    PAYLOAD=$(mktemp /tmp/acp-payload-XXXXXX.json)
    trap "rm -f '$COOKIE_JAR' '$PUBKEY_RESP' '$PUBKEY_PEM' '$PAYLOAD'" EXIT

    # Step 1: Retrieve login metadata
    log "[1/5] Retrieving login metadata..."
    local STEP1 AUTH_URL
    STEP1=$(curl -sk -c "$COOKIE_JAR" \
      "${PLATFORM}/console-platform/api/v1/token/login?client_id=${CLIENT_ID}&redirect_uri=$(urlencode "${REDIRECT_URI}")&response_type=code&scope=$(urlencode "${SCOPE}")") \
      || die "Step 1: curl request failed"
    AUTH_URL=$(get_field "$STEP1" "auth_url" "Step 1")

    # Step 2: Obtain the Dex request ID (also writes the cpaas_oidc_auth_flow cookie)
    log "[2/5] Obtaining Dex request ID..."
    local AUTH_QUERY STEP2 REQ_ID
    AUTH_QUERY="${AUTH_URL#*\?}"
    STEP2=$(curl -sk -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
      "${PLATFORM}/dex/api/v1/authorize?${AUTH_QUERY}") \
      || die "Step 2: curl request failed"
    REQ_ID=$(get_field "$STEP2" "req" "Step 2")

    # Step 3: Retrieve the RSA public key (save response to a file to avoid newline truncation in bash variables)
    log "[3/5] Retrieving RSA public key..."
    curl -sk -b "$COOKIE_JAR" "${PLATFORM}/dex/pubkey" -o "$PUBKEY_RESP" \
      || die "Step 3: curl request failed"
    local TS
    TS=$(jq -r '.ts // empty' "$PUBKEY_RESP")
    [[ -n "$TS" ]] || die "Step 3: 'ts' field missing from response"
    jq -r '.pubkey_encode' "$PUBKEY_RESP" | base64 -d > "$PUBKEY_PEM"
    [[ -s "$PUBKEY_PEM" ]] || die "Step 3: public key decode failed"

    # Step 4: Encrypt credentials, submit them, and obtain the authorization code
    log "[4/5] Submitting credentials and obtaining authorization code..."
    jq -cn --arg ts "$TS" --arg pwd "$PASSWORD" '{"ts":$ts,"password":$pwd}' > "$PAYLOAD"
    local ENCRYPTED STEP4 REDIRECT_URL CODE STATE
    ENCRYPTED=$(openssl pkeyutl -encrypt -pubin -inkey "$PUBKEY_PEM" \
      -pkeyopt rsa_padding_mode:pkcs1 -in "$PAYLOAD" 2>/dev/null | base64 | tr -d '\n') \
      || die "Step 4: password encryption failed"
    STEP4=$(curl -sk -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -X POST "${PLATFORM}/dex/api/v1/authorize/${IDP}?req=${REQ_ID}" \
      -H "Content-Type: application/json" \
      -d "$(jq -cn --arg account "$USERNAME" --arg password "$ENCRYPTED" '{"account":$account,"password":$password}')") \
      || die "Step 4: curl request failed"
    REDIRECT_URL=$(get_field "$STEP4" "redirect_url" "Step 4 (check username/password and IDP parameter)")
    CODE=$(query_param "$REDIRECT_URL" "code")
    STATE=$(query_param "$REDIRECT_URL" "state")
    [[ -n "$CODE"  ]] || die "Step 4: 'code' parameter missing from redirect_url"
    [[ -n "$STATE" ]] || die "Step 4: 'state' parameter missing from redirect_url"

    # Step 5: Exchange the authorization code for an access token
    log "[5/5] Exchanging authorization code for access token..."
    local TOKENS
    TOKENS=$(curl -sk -b "$COOKIE_JAR" \
      "${PLATFORM}/console-platform/api/v1/token/callback?code=${CODE}&state=$(urlencode "${STATE}")") \
      || die "Step 5: curl request failed"
    get_field "$TOKENS" "access_token" "Step 5" > /dev/null

    local EXPIRE_AT
    EXPIRE_AT=$(printf '%s' "$TOKENS" | jq -r '.expire_at // "unknown"')
    log ""
    log "Login successful | User: ${USERNAME} | Token expires at: ${EXPIRE_AT}"
    log ""
    printf '%s\n' "$TOKENS" | jq .
}

main "$@"
```

## Using the Token

Include the `access_token` in the `Authorization` header of all subsequent API requests:

```bash
curl -sk https://your.platform.com/kubernetes/{cluster}/api/v1/namespaces \
  -H "Authorization: Bearer <access_token>"
```

## Important Notes

1. **Session cookie must be shared**: The entire login flow must use the same HTTP session (shared cookie jar) so that the `cpaas_oidc_auth_flow` cookie is automatically carried through each step. Without this cookie, Step 5 returns `invalid authentication session (400)`.

2. **The `ts` timestamp cannot be reused**: The `ts` returned in Step 3 is unique per request. It must be combined with the password into a JSON payload before encryption. Reusing a previous `ts` value will cause Step 4 authentication to fail.

3. **Choosing the `IDP` parameter**:
   - `local`: ACP local accounts (default)
   - `ldap`: LDAP/AD domain accounts; the exact ID depends on your platform configuration

4. **TLS certificate verification**: The `-k` flag in the example script skips certificate verification. This is only suitable for test environments with self-signed certificates. In production, remove `-k` and either configure a valid CA certificate or add the platform CA to your system trust store.
