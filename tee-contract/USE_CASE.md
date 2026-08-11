# Use Case: TEE-Attested Data Fetches for Oracle Consensus

## What `attest-source` does

`attest-source` is a third function added to the `z-tenant-flight` reference
contract. Given a URL, it:

1. Fetches the URL from inside the TEE, using the host's `http` interface
2. Logs the fetch (`logging::info`)
3. Writes a record — URL, HTTP status, response length, a body preview — into
   the calling tenant's own isolated KV namespace (`z:<tid>:attestations`),
   keyed by URL

The result: a durable, per-tenant-scoped record that a given URL was fetched,
what came back, and when — written from inside a sealed execution environment
that even the platform operator cannot tamper with mid-flight.

## The problem this is a minimal version of

Multi-model AI oracle consensus systems (e.g. adjudicating a real-world event
for a prediction market) need each model's answer to be provably grounded in
the real external data source at query time — not fabricated, not stale, and
not silently altered between fetch and judgment.

The common approach today is TLSNotary-style session attestation, which
proves the *transport* was authentic (the bytes really came from that server
over a real TLS session) but says nothing about what happened to the data
*after* it left the wire — parsing, reformatting, or handing it to a model.

## How this extends to that problem

Scaling `attest-source` from "fetch and log" to "oracle data feed" is a
matter of extending the same pattern:

1. Each oracle node's external data fetch (price feed, news API, match
   result) runs as a TEE contract call, same shape as `attest-source`.
2. Instead of just logging a preview, the contract signs the full response
   and the exact transformation applied before forwarding it to a judging
   model — closing the gap TLSNotary leaves between "the API said X" and
   "the model was actually shown X."
3. During adversarial challenge resolution, any party can query the KV
   audit trail directly, rather than trusting a submitted screenshot or an
   off-chain TLS proof.
4. This also helps diagnose disagreement between models: the audit log can
   distinguish "different source data" from "same source data, different
   reasoning" — otherwise one of the hardest failure modes to isolate in
   multi-model consensus.

## Why this is worth building on T3N specifically

The KV write already being scoped per-tenant (`z:<tid>:attestations`) maps
directly onto per-oracle-node isolation with no extra work — each node's
attestations are naturally segregated without building that isolation layer
myself. `attest-source` is the smallest possible proof that this data-flow
shape works end-to-end on the ADK.