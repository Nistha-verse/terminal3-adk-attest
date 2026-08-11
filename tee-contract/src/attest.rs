use crate::host::interfaces::{http as http_iface, kv_store, logging};
use crate::host::tenant::tenant_context;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct AttestSourceInput {
    url: String,
}

#[derive(Serialize)]
struct AttestSourceOutput {
    url: String,
    status: u16,
    body_len: usize,
    body_preview: String,
}

pub fn attest_source(input: &[u8]) -> Result<Vec<u8>, String> {
    let req: AttestSourceInput = serde_json::from_slice(input).map_err(|e| e.to_string())?;

    // Fetch the source. This runs inside the enclave — nothing outside can
    // see this call happen or tamper with the response before we log it.
    let resp = http_iface::call(&http_iface::Request {
        method: http_iface::Verb::Get,
        url: req.url.clone(),
        headers: None,
        payload: None,
    })
    .map_err(|e| format!("attest-source: http call failed: {e}"))?;

    let _ = logging::info(&format!(
        "attest-source: fetched {} -> HTTP {}",
        req.url, resp.code
    ));

    let preview_len = resp.payload.len().min(200);
    let output = AttestSourceOutput {
        url: req.url.clone(),
        status: resp.code,
        body_len: resp.payload.len(),
        body_preview: String::from_utf8_lossy(&resp.payload[..preview_len]).to_string(),
    };

    // Write an audit record into this tenant's own KV namespace — a durable,
    // per-tenant-isolated trail proving what was fetched and when.
    let tid = tenant_context::tenant_did();
    let map_name = format!("z:{}:attestations", hex::encode(&tid));
    let record = serde_json::to_vec(&output).map_err(|e| e.to_string())?;
    kv_store::put(&map_name, req.url.as_bytes(), &record)
        .map_err(|e| format!("attest-source: kv write failed: {e}"))?;

    serde_json::to_vec(&output).map_err(|e| e.to_string())
}