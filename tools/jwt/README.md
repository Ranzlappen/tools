# JWT Decoder

> Inspect a JSON Web Token's header and payload. Nothing leaves the page.

> **Signature is not verified.** This tool decodes — it does not
> authenticate. Anyone can mint a token with whatever claims they want.
> Use this for inspection only, never to make trust decisions.

## What it does

Paste a JWT and the tool splits it into its three base64url segments,
decodes the header and payload as JSON, and shows the raw signature
bytes. Time-related claims (`iat`, `exp`, `nbf`, `auth_time`) get an
inline ISO-8601 annotation so you can read them at a glance, and the
banner tells you whether the token is currently valid based on its
`exp` claim.

## User guide

### Features

- **Three-panel layout** — Header, Payload, Signature (raw base64url).
- **Syntax-coloured JSON** for header and payload.
- **Time-claim annotations** — `iat`, `exp`, `nbf`, `auth_time` are
  decorated with the corresponding ISO timestamp comment.
- **Expiry banner** — green when `exp` is in the future ("Valid for
  Ns more"), red when it has passed ("Expired Ns ago").
- **Sample** loads a fixed HS256 token so you can poke around without
  needing one of your own.
- **Clear** empties the input and resets the panels.
- Live decode as you type — no button press required.

### How to use it

1. Paste a JWT into the **Token** textarea.
2. Read the decoded header and payload in the lower panels.
3. Note the expiry banner (if `exp` is present) and the raw signature
   in the bottom panel.

### Examples

For a token whose payload is:

```
{ "sub": "1234567890", "name": "Ada Lovelace", "iat": 1715866000, "exp": 1715952400 }
```

The payload panel will render each field syntax-coloured and add
`// 2024-05-16T13:26:40.000Z` next to the `iat` and `exp` numbers.

### Privacy

This is the right tool to inspect a sensitive token: decoding is
**purely client-side** using `atob` plus a base64url normaliser. Your
token is never sent over the network, never written to localStorage,
and never logged. (The in-app help modal you may have opened to read
this is the only network request the page makes.)

## Developer guide

### File layout

- `index.html` — token textarea, the persistent
  *signature-not-verified* warning banner, expiry banner, three
  `.jwt-segment` panels.
- `tool.js` — base64url decoder, `annotate()` pretty-printer with
  inline time annotations, expiry-banner state machine.

### Key DOM hooks

| Selector                | Role                                          |
| ----------------------- | --------------------------------------------- |
| `#jwt-in`               | Token textarea.                               |
| `#jwt-header`           | `<pre>` for the header (innerHTML-rendered).  |
| `#jwt-payload`          | `<pre>` for the payload.                      |
| `#jwt-signature`        | `<pre>` for the raw base64url signature.      |
| `#jwt-expiry` / `#jwt-expiry-text` | Expiry banner.                     |
| `[data-action="sample"]`| Loads the sample token.                       |
| `[data-action="clear"]` | Empties everything.                           |

### Dependencies

Vanilla JS only. `atob` + `TextDecoder` handle the base64url payload;
JSON parsing is the standard library.

### Extending

- **Verify a signature**: this tool is intentionally inspection-only.
  Adding verification would require importing a public key per issuer
  and crypto primitives — keep it as a separate tool if needed.
- **Add another time claim** to the annotation: extend the
  `TIME_CLAIMS` `Set` near the top of `tool.js`.
- **Custom claim formatter**: extend `annotate()` to special-case other
  numeric or string claims (e.g. render `aud` as a list).

### Limitations / gotchas

- Tokens whose header or payload aren't valid JSON show
  `Decode error: ...` in the header panel.
- The signature is shown verbatim — there's no attempt to decode it as
  ASCII (it's a binary blob).
- The expiry banner only checks `payload.exp` (Unix seconds). Tokens
  using a non-standard expiration field won't trigger it.
- Unsigned JWTs (only two segments) decode fine; the signature panel
  reads "(none — unsigned token)".
