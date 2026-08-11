# Terminal3 ADK Bounty Submission — Nistha

Terminal3 ADK community bounty: quickstart, walkthrough, and a custom TEE
contract function extending the reference example.

## Structure

- `quickstart-app/` — Node/TypeScript app completing the Quickstart (connect + authenticate)
- `tee-contract/` — Rust TEE contract based on Terminal3's `z-tenant-flight` reference, extended with a custom `attest-source` function

## 1. Quickstart

```bash
cd quickstart-app
npm install
$env:T3N_API_KEY="your_key_here"
npx tsx quickstart.ts
```

Connects and authenticates against the T3N testnet, printing the tenant DID.

## 2. Walkthrough — TEE contract

```bash
cd tee-contract
cargo build --target wasm32-wasip2 --release
```

Builds `search-offers` and `book-offer` from Terminal3's reference implementation, plus a custom third function, `attest-source`.

## 3. Custom addition: `attest-source`

Added a third exported function to the contract (`wit/world.wit`, `src/attest.rs`,
wired in `src/lib.rs`). It fetches a given URL from inside the TEE and writes
a signed audit record — HTTP status, response size, and a preview — into the
tenant's own isolated KV namespace, keyed by URL.

**Why:** this is a minimal version of a data-provenance primitive needed for
a separate project — a multi-model AI oracle consensus system, where each
node's external data fetch needs to be verifiably tied to what a judging
model actually saw, not just trusted. See `USE_CASE.md` for the full writeup.

## 4. Bugs found

1. **Critical transitive dependency vulnerability.** A clean `npm install @terminal3/t3n-sdk`
   (v4, latest) pulls in `decompress`, which has a critical Zip Slip
   advisory (GHSA-mp2f-45pm-3cg9, GHSA-h39j-r5qq-r9mm), via
   `@bytecodealliance/weval → componentize-js → jco`. Flagged by `npm audit`
   on install with no other dependencies added.
2. **SDK v4 `handshake()` broken.** `t3n.handshake()` throws
   `TypeError: Cannot read properties of undefined (reading 'unsafe_trust_server')`
   inside `assertNodeTrusted`, on the official quickstart script copied verbatim
   from docs. Reproduced on both Node 25 and Node 20.20.2 (clean installs) — not
   a Node version issue. Confirmed by the sponsor (Ian Chong) as a known bug;
   workaround is pinning `@terminal3/t3n-sdk@3.17.0`.
3. **Minor:** on Windows PowerShell, `$env:VAR` only persists for the current
   terminal session — closing/reopening the terminal silently drops the API
   key and produces a confusing "Invalid Ethereum private key" error further
   down the stack rather than a clear "key not set" message.

## Screenshots

See `/screenshots`.