const { ethers } = require("ethers");
const { AppError } = require("../middleware/errorHandler");

const RPC_URL = process.env.RPC_URL;
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const LLT_CONTRACT_ADDRESS = process.env.LLT_CONTRACT_ADDRESS;

const LLT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount)",
  "function owner() view returns (address)",
];

const REQUIRED_ENV = ["RPC_URL", "BACKEND_PRIVATE_KEY", "LLT_CONTRACT_ADDRESS"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);

if (missing.length > 0) {
  console.warn(
    `Blockchain not configured. Missing: ${missing.join(
      ", ",
    )}. Withdrawals will stay pending.`,
  );
}

if (
  BACKEND_PRIVATE_KEY &&
  !/^0x[a-fA-F0-9]{64}$/.test(BACKEND_PRIVATE_KEY)
) {
  throw new Error(
    "BACKEND_PRIVATE_KEY must be a 0x-prefixed 64-character hex string",
  );
}

let provider = null;
let signer = null;
let contract = null;

try {
  if (RPC_URL) {
    provider = new ethers.JsonRpcProvider(RPC_URL);
  }

  if (provider && BACKEND_PRIVATE_KEY && LLT_CONTRACT_ADDRESS) {
    signer = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);
    contract = new ethers.Contract(LLT_CONTRACT_ADDRESS, LLT_ABI, signer);
    console.log("Blockchain service initialized");
    console.log("   Network : SCAI Private Network (Chain ID: 34)");
    console.log("   RPC     :", RPC_URL);
    console.log("   Contract:", LLT_CONTRACT_ADDRESS);
  }
} catch (error) {
  console.error("Failed to initialize blockchain service:", error.message);
}

// ─── RPC sync-lag guard ───────────────────────────────────────────────────
// Some RPC providers (especially on smaller/private chains like SCAI) can
// silently serve a node that hasn't synced up to the block where our
// contract was deployed. Calls like decimals()/balanceOf() then return
// empty data ("0x"), which ethers surfaces as a confusing low-level
// BAD_DATA "could not decode result data" error. We check for that
// specific situation up front and fail with a clear, actionable message
// instead, so withdrawals fail gracefully rather than crashing on a decode
// error.
class RpcNotReadyError extends AppError {
  constructor(message) {
    super(message, 503);
    this.name = "RpcNotReadyError";
  }
}

// RPC_URL and LLT_CONTRACT_ADDRESS are fixed/known-good (verified against
// the deployment and a block explorer showing months of live activity at
// this address), so a single empty-bytecode response is almost certainly
// NOT the contract being missing — it's most likely mainnet-rpc.scai.network
// being a load-balanced endpoint that occasionally routes a request to a
// lagging/inconsistent node behind it. A single bad response used to fail
// the whole withdrawal immediately; now we retry a few times first, since
// a follow-up request very likely lands on a healthy node.
async function assertRpcIsCaughtUp(maxAttempts = 3) {
  if (!provider || !LLT_CONTRACT_ADDRESS) return;

  let lastCode = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let code;
    try {
      code = await provider.getCode(LLT_CONTRACT_ADDRESS);
    } catch (error) {
      // Network/connection-level failure talking to the RPC at all — also
      // worth a retry, for the same reason as above.
      console.error(
        `[Blockchain] getCode attempt ${attempt}/${maxAttempts} failed to reach RPC: ${error.message}`,
      );
      if (attempt === maxAttempts) {
        throw new RpcNotReadyError(
          "Blockchain network is temporarily unreachable — withdrawals are paused, please try again later.",
        );
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      continue;
    }

    if (code && code !== "0x") {
      // Got real bytecode — RPC node behind this request is caught up.
      return;
    }

    lastCode = code;
    console.error(
      `[Blockchain] getCode attempt ${attempt}/${maxAttempts}: RPC at ${RPC_URL} returned empty ` +
        `bytecode for ${LLT_CONTRACT_ADDRESS}.`,
    );
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  // Every attempt came back empty. Since the contract address is fixed and
  // known-deployed, this means every node we happened to hit behind the RPC
  // endpoint currently has a stale/incomplete view — genuinely worth
  // surfacing as "try again later" rather than a silent retry loop forever.
  console.error(
    `[Blockchain] All ${maxAttempts} attempts returned empty bytecode (last: ${lastCode}) for ` +
      `${LLT_CONTRACT_ADDRESS} via ${RPC_URL}. If this persists, the RPC endpoint itself likely ` +
      "has an unhealthy/unsynced node behind its load balancer — worth checking with the RPC provider.",
  );
  throw new RpcNotReadyError(
    "Blockchain network is temporarily syncing — withdrawals are paused, please try again later.",
  );
}

async function sendWithRetry(txPromiseFactory, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await txPromiseFactory();
      const receipt = await tx.wait(1);
      return { tx, receipt };
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error.message}. Retrying...`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastError;
}

async function sendTokensOnChain(toAddress, amountCoins) {
  if (missing.length > 0) {
    throw new AppError(
      `Blockchain not configured. Missing env vars: ${missing.join(
        ", ",
      )}. Withdrawal saved as 'pending' — configure env vars to process automatically.`,
      503,
    );
  }

  if (!ethers.isAddress(toAddress)) {
    throw new AppError("Invalid wallet address", 400);
  }

  try {
    console.log(`Sending ${amountCoins} LLT to ${toAddress}`);

    await assertRpcIsCaughtUp();

    const decimals = await contract.decimals();
    const amountTokens = ethers.parseUnits(amountCoins.toString(), decimals);

    console.log("Minting tokens...");
    const { tx: mintTx } = await sendWithRetry(() =>
      contract.mint(signer.address, amountTokens),
    );
    console.log("Mint confirmed:", mintTx.hash);

    console.log("Transferring to user...");
    const { tx: transferTx, receipt: transferReceipt } = await sendWithRetry(() =>
      contract.transfer(toAddress, amountTokens),
    );
    console.log("Transfer confirmed:", transferTx.hash);

    return {
      success: true,
      mintHash: mintTx.hash,
      transferHash: transferTx.hash,
      blockNumber: transferReceipt.blockNumber,
      explorerUrl: `https://explorer.securechain.ai/tx/${transferTx.hash}`,
    };
  } catch (error) {
    console.error("Blockchain error:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getBackendBalance() {
  try {
    const balance = await contract.balanceOf(signer.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error("Failed to get balance:", error.message);
    return "0";
  }
}

async function getNetworkInfo() {
  try {
    const network = await provider.getNetwork();
    const balance = await getBackendBalance();
    return {
      network: network.name,
      chainId: network.chainId.toString(),
      rpc: RPC_URL,
      backendAddress: signer.address,
      contractAddress: LLT_CONTRACT_ADDRESS,
      backendBalance: balance,
    };
  } catch (error) {
    console.error("Failed to get network info:", error.message);
    return null;
  }
}

module.exports = {
  sendTokensOnChain,
  getBackendBalance,
  getNetworkInfo,
  LLT_ABI,
};