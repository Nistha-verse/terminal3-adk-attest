import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
} from "@terminal3/t3n-sdk";

setEnvironment("testnet"); // SDK defaults to production — must set this explicitly

const T3N_API_KEY = process.env.T3N_API_KEY!;
const wasmComponent = await loadWasmComponent(); // all crypto runs inside this component
const address = eth_get_address(T3N_API_KEY);

const t3n = new T3nClient({
  wasmComponent,
  handlers: {
    EthSign: metamask_sign(address, undefined, T3N_API_KEY),
  },
});

await t3n.handshake();
const did = await t3n.authenticate(createEthAuthInput(address));
const tenantDid = did.value;

console.log("Connected as:", tenantDid);
import { readFile } from "fs/promises";
import { TenantClient, getNodeUrl } from "@terminal3/t3n-sdk";

const WASM_PATH = "../tee-contract/target/wasm32-wasip2/release/z_tenant_flight.wasm";
const CONTRACT_TAIL = "attest-flight";
const CONTRACT_VERSION = "0.1.3";

const tenant = new TenantClient({
  t3n,
  tenantDid,
  baseUrl: getNodeUrl(),
});

const wasmBytes = await readFile(WASM_PATH);

const result = await tenant.contracts.register({
  tail: CONTRACT_TAIL,
  version: CONTRACT_VERSION,
  wasm: wasmBytes,
});

const contractId = result.contract_id;
const tenantIdOnly = tenantDid.slice("did:t3n:".length);
const scriptName = `z:${tenantIdOnly}:${CONTRACT_TAIL}`;

console.log(`registered ${scriptName} as contract id ${contractId}`);
// Create the "attestations" KV map with write access scoped to our
// registered contract (by numeric contract_id, not tail/DID).
await tenant.maps.create({
  tail: "attestations",
  visibility: "private",
  writers: { only: [contractId] },
  readers: { only: [contractId] },
});
console.log("Created attestations map, writable by contract", contractId);
import { getScriptVersion } from "@terminal3/t3n-sdk";

//  Step 4: Invoke the contract (self-call, using the funded tenant identity) 

const scriptVersion = await getScriptVersion(getNodeUrl(), scriptName);

// Self-grant: tenant authorizes itself (agentDid = own DID) to call
// attest-source, scoped to one allowed outbound host.
const userContractVersion = await getScriptVersion(getNodeUrl(), "tee:user/contracts");
await t3n.execute({
  script_name: "tee:user/contracts",
  script_version: userContractVersion,
  function_name: "agent-auth-update",
  input: {
    agents: [{
      agentDid: tenantDid,
      scripts: [{
        scriptName: scriptName,
        versionReq: scriptVersion,
        functions: ["attest-source"],
        allowedHosts: ["example.com"],
      }],
    }],
  },
});
console.log("Self-granted attest-source access");

const attestResult = await t3n.executeAndDecode({
  script_name: scriptName,
  script_version: scriptVersion,
  function_name: "attest-source",
  input: { url: "https://example.com" },
});
console.log("attest-source result:", attestResult);