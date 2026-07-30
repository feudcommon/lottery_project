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