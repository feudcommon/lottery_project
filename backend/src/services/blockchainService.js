// src/services/blockchainService.js
//
// HOW THE BACKEND TALKS TO YOUR SMART CONTRACT
//
// The function in the original spec:
//   function transfer(address to, uint amount) public { ... }
// is the WRONG function to use for this, and it's worth understanding why,
// because it's a common beginner mistake:
//
//   That `transfer` signature with `msg.sender` checking the BALANCE of
//   whoever calls it means: if your BACKEND calls it, msg.sender is your
//   backend's wallet, and it sends FROM the backend's own balance. That's
//   actually fine for a reward-payout contract (the backend acts as the
//   token treasury/faucet) — but it means your backend wallet needs to
//   hold all the tokens it will ever pay out, and its private key is the
//   single most sensitive secret in your whole system.
//
// In practice, you'd use the standard ERC-20 `transfer` from OpenZeppelin
// (audited, battle-tested) rather than hand-rolling one, and your backend
// holds a wallet whose private key is used ONLY to sign these payout
// transactions. This file shows where that integration plugs in — using
// ethers.js, the standard library for this.

const { ethers } = require('ethers');
const { AppError } = require('../middleware/errorHandler');

const RPC_URL = process.env.RPC_URL;
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const LLT_CONTRACT_ADDRESS = process.env.LLT_CONTRACT_ADDRESS;

// ─── PATCH: timeouts / retry tuning ─────────────────────────────────────────
// How long to wait for the RPC to confirm a tx before giving up and
// reporting a clear error, instead of hanging the request forever.
const TX_WAIT_TIMEOUT_MS = 60_000; // 60s per tx (mint, then transfer)
// ─────────────────────────────────────────────────────────────────────────────

const LLT_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount)",
];

// Validate env vars on startup
const REQUIRED_ENV = ['RPC_URL', 'BACKEND_PRIVATE_KEY', 'LLT_CONTRACT_ADDRESS'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.warn(`Blockchain not configured. Missing: ${missing.join(', ')}. Withdrawals will stay pending.`);
}

// Provider / Signer / Contract
let provider, signer, contract;

try {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  signer   = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);
  contract = new ethers.Contract(LLT_CONTRACT_ADDRESS, LLT_ABI, signer);
  console.log('Blockchain service initialized');
  console.log('   Network : SCAI Private Network (Chain ID: 34)');
  console.log('   RPC     :', RPC_URL);
  console.log('   Contract:', LLT_CONTRACT_ADDRESS);
} catch (error) {
  console.error('Failed to initialize blockchain service:', error.message);
}

// ─── PATCH: helper to race a promise against a timeout ──────────────────────
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms — RPC likely never accepted/propagated this tx`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── PATCH: send a contract tx safely ────────────────────────────────────────
// This wraps a single "simulate -> send -> verify accepted -> wait" flow so
// both mint() and transfer() get the same protection:
//
//   1. `callStatic` (a read-only dry run) BEFORE sending anything on-chain.
//      If the real call would revert (e.g. backend wallet lacks MINTER_ROLE,
//      insufficient balance, paused contract, etc.), this throws immediately
//      with the actual revert reason — instead of silently signing and
//      "submitting" a transaction that can never succeed.
//   2. Explicit gasLimit instead of relying on automatic estimation, since
//      some smaller/private-chain RPC implementations don't fully simulate
//      execution during eth_estimateGas and can hand back a workable-looking
//      gas figure for a call that will still fail or never be accepted.
//   3. Immediately after submission, ask the RPC directly
//      (`provider.getTransaction`) whether it actually has the tx — if the
//      node has no record of the hash it just gave us, that's the RPC
//      silently failing to accept/broadcast it, and we fail fast instead of
//      hanging on `.wait()`.
//   4. `.wait()` is time-boxed so a stalled network reports a clear timeout
//      error rather than hanging the request indefinitely.
async function sendContractTx(methodName, args, label) {
  // 1. Dry-run first — surfaces revert reasons (e.g. missing MINTER_ROLE)
  //    before we ever sign/broadcast anything.
  try {
    await contract[methodName].staticCall(...args);
  } catch (simError) {
    throw new Error(
      `${label} would revert on-chain: ${simError.reason || simError.shortMessage || simError.message}`
    );
  }

  // 2. Explicit gas limit — don't trust auto-estimation on this network.
  //    Adjust this figure if your contract's mint/transfer genuinely needs
  //    more gas; better to hardcode too much than silently under-estimate.
  const overrides = { gasLimit: 200_000n };

  const tx = await contract[methodName](...args, overrides);
  console.log(`${label} tx submitted:`, tx.hash);

  // 3. Confirm the RPC node actually has this transaction before waiting.
  //    A null result here means the node handed us a hash but never
  //    accepted the tx into its own mempool — the exact "hash exists
  //    locally but explorer never sees it" symptom.
  const seenByNode = await provider.getTransaction(tx.hash);
  if (!seenByNode) {
    throw new Error(
      `${label} tx ${tx.hash} was signed but the RPC node has no record of it — ` +
      `it was never accepted into the mempool. Check RPC_URL/CHAIN_ID configuration.`
    );
  }

  // 4. Wait for confirmation, but don't hang forever.
  const receipt = await withTimeout(tx.wait(1), TX_WAIT_TIMEOUT_MS, `${label} confirmation`);
  console.log(`${label} confirmed:`, tx.hash);

  return { tx, receipt };
}

/**
 * Mints LLT tokens and transfers them to the user's wallet.
 *
 * @param {string} toAddress   - User's wallet address
 * @param {number} amountCoins - Number of coins to convert (1 coin = 1 LLT token)
 * @returns {Promise<{ success, mintHash, transferHash, blockNumber, explorerUrl, error }>}
 */
async function sendTokensOnChain(toAddress, amountCoins) {
  if (missing.length > 0) {
    throw new AppError(
      `Blockchain not configured. Missing env vars: ${missing.join(', ')}. ` +
      `Withdrawal saved as 'pending' — configure env vars to process automatically.`,
      503
    );
  }

  if (!ethers.isAddress(toAddress)) {
    throw new AppError('Invalid wallet address', 400);
  }

  try {
    console.log(`Sending ${amountCoins} LLT to ${toAddress}`);

    const decimals = await contract.decimals();
    const amountTokens = ethers.parseUnits(amountCoins.toString(), decimals);

    // Mint tokens to backend wallet first
    console.log('Minting tokens...');
    const { tx: mintTx } = await sendContractTx('mint', [signer.address, amountTokens], 'Mint');

    // Transfer from backend wallet to user
    console.log('Transferring to user...');
    const { tx: transferTx, receipt: transferReceipt } = await sendContractTx(
      'transfer',
      [toAddress, amountTokens],
      'Transfer'
    );

    return {
      success: true,
      mintHash: mintTx.hash,
      transferHash: transferTx.hash,
      blockNumber: transferReceipt.blockNumber,
      explorerUrl: `https://explorer.securechain.ai/tx/${transferTx.hash}`,
    };
  } catch (error) {
    console.error('Blockchain error:', error.message);
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
    console.error('Failed to get balance:', error.message);
    return '0';
  }
}

async function getNetworkInfo() {
  try {
    const network = await provider.getNetwork();
    const balance = await getBackendBalance();
    return {
      network:         network.name,
      chainId:         network.chainId.toString(),
      rpc:             RPC_URL,
      backendAddress:  signer.address,
      contractAddress: LLT_CONTRACT_ADDRESS,
      backendBalance:  balance,
    };
  } catch (error) {
    console.error('Failed to get network info:', error.message);
    return null;
  }
}

module.exports = { sendTokensOnChain, getBackendBalance, getNetworkInfo, LLT_ABI };