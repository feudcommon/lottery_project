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
//
// THIS IS A STUB. To make it real you need:
//   npm install ethers
//   1. Deploy an ERC-20 contract (OpenZeppelin's ERC20.sol is the standard base)
//   2. Set these env vars: RPC_URL, BACKEND_WALLET_PRIVATE_KEY, TOKEN_CONTRACT_ADDRESS
//   3. Uncomment the ethers logic below

/**
 * Sends `amount` SCAI tokens to `toAddress`.
 * Returns the transaction hash once confirmed.
 *
 * NOTE: this is intentionally a stub that throws — wire up real ethers.js
 * calls (commented below) once you have a deployed contract + funded
 * backend wallet. Keeping it as an explicit stub is safer than silently
 * "pretending" to send tokens.
 */
// src/services/blockchainService.js
const { ethers } = require('ethers');
const { AppError } = require('../middleware/errorHandler');

const RPC_URL = process.env.RPC_URL;
const BACKEND_PRIVATE_KEY = process.env.BACKEND_PRIVATE_KEY;
const LLT_CONTRACT_ADDRESS = process.env.LLT_CONTRACT_ADDRESS;

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
    const mintTx = await contract.mint(signer.address, amountTokens);
    console.log('Mint tx submitted:', mintTx.hash);  
    await mintTx.wait(1);
    console.log('Mint confirmed:', mintTx.hash);

    // Transfer from backend wallet to user
    console.log('Transferring to user...');
    const transferTx = await contract.transfer(toAddress, amountTokens);
    const transferReceipt = await transferTx.wait(1);
    console.log('Transfer confirmed:', transferTx.hash);

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