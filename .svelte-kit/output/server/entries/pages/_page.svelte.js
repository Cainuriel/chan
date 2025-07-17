import { V as fallback, W as attr, T as escape_html, X as bind_props, O as pop, K as push, Y as head, Z as ensure_array_like, _ as attr_class, $ as stringify } from "../../chunks/index.js";
import { ethers, toBigInt } from "ethers";
var UTXOType = /* @__PURE__ */ ((UTXOType2) => {
  UTXOType2["DEPOSIT"] = "DEPOSIT";
  UTXOType2["SPLIT"] = "SPLIT";
  UTXOType2["COMBINE"] = "COMBINE";
  UTXOType2["TRANSFER"] = "TRANSFER";
  return UTXOType2;
})(UTXOType || {});
class UTXOOperationError extends Error {
  constructor(message, operation, utxoId, details) {
    super(message);
    this.operation = operation;
    this.utxoId = utxoId;
    this.details = details;
    this.name = "UTXOOperationError";
  }
}
class UTXONotFoundError extends UTXOOperationError {
  constructor(utxoId) {
    super(`UTXO not found: ${utxoId}`, "lookup", utxoId);
    this.name = "UTXONotFoundError";
  }
}
class UTXOAlreadySpentError extends UTXOOperationError {
  constructor(utxoId) {
    super(`UTXO already spent: ${utxoId}`, "spend", utxoId);
    this.name = "UTXOAlreadySpentError";
  }
}
var WalletProviderType = /* @__PURE__ */ ((WalletProviderType2) => {
  WalletProviderType2["METAMASK"] = "metamask";
  WalletProviderType2["WALLET_CONNECT"] = "walletconnect";
  WalletProviderType2["COINBASE_WALLET"] = "coinbase";
  WalletProviderType2["INJECTED"] = "injected";
  WalletProviderType2["CUSTOM"] = "custom";
  return WalletProviderType2;
})(WalletProviderType || {});
var AccountDerivationMethod = /* @__PURE__ */ ((AccountDerivationMethod2) => {
  AccountDerivationMethod2["MESSAGE_SIGNATURE"] = "message_signature";
  AccountDerivationMethod2["TYPED_DATA_SIGNATURE"] = "typed_data_signature";
  AccountDerivationMethod2["DETERMINISTIC_HASH"] = "deterministic_hash";
  return AccountDerivationMethod2;
})(AccountDerivationMethod || {});
class EthereumError extends Error {
  constructor(message, code, data) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = "EthereumError";
  }
}
class WalletNotConnectedError extends EthereumError {
  constructor() {
    super("Wallet not connected", 4001);
    this.name = "WalletNotConnectedError";
  }
}
class UnsupportedChainError extends EthereumError {
  constructor(chainId) {
    super(`Unsupported chain: ${chainId}`, 4902, { chainId });
    this.name = "UnsupportedChainError";
  }
}
class TransactionRevertedError extends EthereumError {
  constructor(reason, txHash) {
    super(`Transaction reverted${reason ? `: ${reason}` : ""}`, -32e3, {
      reason,
      txHash
    });
    this.name = "TransactionRevertedError";
  }
}
const ETHEREUM_NETWORKS = {
  mainnet: {
    chainId: 1,
    name: "Ethereum Mainnet",
    rpcUrls: ["https://mainnet.infura.io/v3/", "https://eth-mainnet.alchemyapi.io/v2/"],
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18
    },
    blockExplorerUrls: ["https://etherscan.io"],
    testnet: false
  },
  polygon: {
    chainId: 137,
    name: "Polygon Mainnet",
    rpcUrls: ["https://polygon-rpc.com/"],
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18
    },
    blockExplorerUrls: ["https://polygonscan.com"],
    testnet: false
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrls: ["https://sepolia.infura.io/v3/"],
    nativeCurrency: {
      name: "Sepolia Ether",
      symbol: "SEP",
      decimals: 18
    },
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    testnet: true
  }
};
const ERC20_ABI_FRAGMENTS = {
  balanceOf: "function balanceOf(address owner) view returns (uint256)",
  allowance: "function allowance(address owner, address spender) view returns (uint256)",
  approve: "function approve(address spender, uint256 amount) returns (bool)",
  name: "function name() view returns (string)",
  symbol: "function symbol() view returns (string)",
  decimals: "function decimals() view returns (uint8)"
};
const UTXO_VAULT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_authorizedBackend",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "InvalidAmount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidAttestation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidNullifier",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidToken",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NullifierAlreadyUsed",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReplayAttack",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "StaleAttestation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UTXOAlreadySpent",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UTXONotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UnauthorizedBackend",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "oldBackend",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newBackend",
        "type": "address"
      }
    ],
    "name": "BackendUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "inputCommitmentHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32[]",
        "name": "outputCommitmentHashes",
        "type": "bytes32[]"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "inputNullifier",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32[]",
        "name": "outputNullifiers",
        "type": "bytes32[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "PrivateSplit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "inputCommitmentHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "outputCommitmentHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "inputNullifier",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "outputNullifier",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "PrivateTransfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "utxoId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "commitmentHash",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "nullifierHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "enum UTXOVault.UTXOType",
        "name": "utxoType",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "PrivateUTXOCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "commitmentHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "nullifier",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "revealedAmount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "PrivateWithdrawal",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      }
    ],
    "name": "TokenRegistered",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "allRegisteredTokens",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "authorizedBackend",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "tokenAddress",
            "type": "address"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct UTXOVault.CommitmentPoint",
            "name": "commitment",
            "type": "tuple"
          },
          {
            "internalType": "bytes32",
            "name": "nullifierHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "amount",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "string",
                "name": "operation",
                "type": "string"
              },
              {
                "internalType": "bytes32",
                "name": "dataHash",
                "type": "bytes32"
              },
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              },
              {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
              }
            ],
            "internalType": "struct UTXOVault.BackendAttestation",
            "name": "attestation",
            "type": "tuple"
          }
        ],
        "internalType": "struct UTXOVault.DepositParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "depositAsPrivateUTXO",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "x",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "y",
            "type": "uint256"
          }
        ],
        "internalType": "struct UTXOVault.CommitmentPoint",
        "name": "commitment",
        "type": "tuple"
      }
    ],
    "name": "doesCommitmentExist",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurrentNonce",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getRegisteredTokens",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "internalType": "uint256",
            "name": "x",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "y",
            "type": "uint256"
          }
        ],
        "internalType": "struct UTXOVault.CommitmentPoint",
        "name": "commitment",
        "type": "tuple"
      }
    ],
    "name": "getUTXOByCommitment",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "utxoId",
        "type": "bytes32"
      }
    ],
    "name": "getUTXOInfo",
    "outputs": [
      {
        "internalType": "bool",
        "name": "exists",
        "type": "bool"
      },
      {
        "internalType": "bytes32",
        "name": "commitmentHash",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "timestamp",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isSpent",
        "type": "bool"
      },
      {
        "internalType": "bytes32",
        "name": "parentUTXO",
        "type": "bytes32"
      },
      {
        "internalType": "enum UTXOVault.UTXOType",
        "name": "utxoType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "blockNumber",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "nullifier",
        "type": "bytes32"
      }
    ],
    "name": "isNullifierUsed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "tokenAddress",
        "type": "address"
      }
    ],
    "name": "isTokenRegistered",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "lastNonce",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "registeredTokens",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct UTXOVault.CommitmentPoint",
            "name": "inputCommitment",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct UTXOVault.CommitmentPoint[]",
            "name": "outputCommitments",
            "type": "tuple[]"
          },
          {
            "internalType": "bytes32",
            "name": "inputNullifier",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32[]",
            "name": "outputNullifiers",
            "type": "bytes32[]"
          },
          {
            "components": [
              {
                "internalType": "string",
                "name": "operation",
                "type": "string"
              },
              {
                "internalType": "bytes32",
                "name": "dataHash",
                "type": "bytes32"
              },
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              },
              {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
              }
            ],
            "internalType": "struct UTXOVault.BackendAttestation",
            "name": "attestation",
            "type": "tuple"
          }
        ],
        "internalType": "struct UTXOVault.SplitParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "splitPrivateUTXO",
    "outputs": [
      {
        "internalType": "bytes32[]",
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct UTXOVault.CommitmentPoint",
            "name": "inputCommitment",
            "type": "tuple"
          },
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct UTXOVault.CommitmentPoint",
            "name": "outputCommitment",
            "type": "tuple"
          },
          {
            "internalType": "bytes32",
            "name": "inputNullifier",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "outputNullifier",
            "type": "bytes32"
          },
          {
            "components": [
              {
                "internalType": "string",
                "name": "operation",
                "type": "string"
              },
              {
                "internalType": "bytes32",
                "name": "dataHash",
                "type": "bytes32"
              },
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              },
              {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
              }
            ],
            "internalType": "struct UTXOVault.BackendAttestation",
            "name": "attestation",
            "type": "tuple"
          }
        ],
        "internalType": "struct UTXOVault.TransferParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "transferPrivateUTXO",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newBackend",
        "type": "address"
      }
    ],
    "name": "updateAuthorizedBackend",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "components": [
              {
                "internalType": "uint256",
                "name": "x",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "y",
                "type": "uint256"
              }
            ],
            "internalType": "struct UTXOVault.CommitmentPoint",
            "name": "commitment",
            "type": "tuple"
          },
          {
            "internalType": "bytes32",
            "name": "nullifierHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "revealedAmount",
            "type": "uint256"
          },
          {
            "components": [
              {
                "internalType": "string",
                "name": "operation",
                "type": "string"
              },
              {
                "internalType": "bytes32",
                "name": "dataHash",
                "type": "bytes32"
              },
              {
                "internalType": "uint256",
                "name": "nonce",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "timestamp",
                "type": "uint256"
              },
              {
                "internalType": "bytes",
                "name": "signature",
                "type": "bytes"
              }
            ],
            "internalType": "struct UTXOVault.BackendAttestation",
            "name": "attestation",
            "type": "tuple"
          }
        ],
        "internalType": "struct UTXOVault.WithdrawParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "withdrawFromPrivateUTXO",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];
function createUTXOVaultContract(address, signerOrProvider) {
  return new ethers.Contract(address, UTXO_VAULT_ABI, signerOrProvider);
}
class EthereumHelpers {
  static provider = null;
  static signer = null;
  static currentEOA = null;
  /**
   * Detect and connect to available wallet provider
   * @param preferredProvider - Preferred wallet type
   * @returns Promise resolving to connection result
   */
  static async connectWallet(preferredProvider = WalletProviderType.METAMASK) {
    try {
      let provider;
      let signer;
      switch (preferredProvider) {
        case WalletProviderType.METAMASK:
          const result = await this.connectMetaMask();
          if (!result.success) {
            return result;
          }
          provider = result.provider;
          signer = result.signer;
          break;
        case WalletProviderType.INJECTED:
          if (!window.ethereum) {
            return {
              success: false,
              error: "No injected provider found"
            };
          }
          provider = new ethers.BrowserProvider(window.ethereum);
          signer = await provider.getSigner();
          break;
        default:
          return {
            success: false,
            error: `Unsupported provider type: ${preferredProvider}`
          };
      }
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const ethBalance = await provider.getBalance(address);
      const eoaData = {
        address,
        chainId: network.chainId,
        networkName: network.name,
        connected: true,
        providerType: preferredProvider,
        ethBalance: BigInt(ethBalance.toString()),
        lastBalanceUpdate: Date.now()
      };
      this.provider = provider;
      this.signer = signer;
      this.currentEOA = eoaData;
      this.setupEventListeners();
      return {
        success: true,
        eoa: eoaData,
        provider,
        signer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connection error"
      };
    }
  }
  /**
   * Detect MetaMask with improved detection logic
   * @returns MetaMaskProvider if found, null otherwise
   */
  static async detectMetaMask() {
    if (typeof window === "undefined") {
      return null;
    }
    if (window.ethereum && this.isMetaMaskProvider(window.ethereum)) {
      return window.ethereum;
    }
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (window.ethereum && this.isMetaMaskProvider(window.ethereum)) {
        return window.ethereum;
      }
      if (window.ethereum?.providers) {
        const metamaskProvider = window.ethereum.providers.find(
          (provider) => this.isMetaMaskProvider(provider)
        );
        if (metamaskProvider) {
          return metamaskProvider;
        }
      }
    }
    if (window.ethereum?.isMetaMask) {
      return window.ethereum;
    }
    if (window.web3?.currentProvider?.isMetaMask) {
      return window.web3.currentProvider;
    }
    return null;
  }
  /**
   * Connect specifically to MetaMask
   * @returns Promise resolving to connection result
   */
  static async connectMetaMask() {
    const metamaskProvider = await this.detectMetaMask();
    if (!metamaskProvider) {
      return {
        success: false,
        error: "MetaMask not detected. Please install MetaMask extension."
      };
    }
    try {
      const accounts = await metamaskProvider.request({
        method: "eth_requestAccounts"
      });
      if (!accounts || accounts.length === 0) {
        return {
          success: false,
          error: "No accounts available. Please unlock MetaMask and try again."
        };
      }
      const provider = new ethers.BrowserProvider(metamaskProvider);
      const signer = await provider.getSigner();
      return {
        success: true,
        provider,
        signer
      };
    } catch (error) {
      if (error.code === 4001) {
        return {
          success: false,
          error: "User rejected the request"
        };
      }
      if (error.code === -32002) {
        return {
          success: false,
          error: "Please open MetaMask and complete the pending request"
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "MetaMask connection failed"
      };
    }
  }
  /**
   * Disconnect wallet and cleanup
   */
  static async disconnectWallet() {
    this.provider = null;
    this.signer = null;
    this.currentEOA = null;
    if (window.ethereum) {
      window.ethereum.removeAllListeners?.();
    }
  }
  /**
   * Get current connected EOA data
   * @returns Current EOA data or null if not connected
   */
  static getCurrentEOA() {
    return this.currentEOA;
  }
  /**
   * Get current provider
   * @returns Current provider or throws if not connected
   */
  static getProvider() {
    if (!this.provider) {
      throw new WalletNotConnectedError();
    }
    return this.provider;
  }
  /**
   * Get current signer
   * @returns Current signer or throws if not connected
   */
  static getSigner() {
    if (!this.signer) {
      throw new WalletNotConnectedError();
    }
    return this.signer;
  }
  /**
   * Sign a message with the connected EOA
   * @param message - Message to sign
   * @returns Promise resolving to signature result
   */
  static async signMessage(message) {
    const signer = this.getSigner();
    const address = await signer.getAddress();
    try {
      const signature = await signer.signMessage(message);
      const sig = ethers.Signature.from(signature);
      return {
        signature,
        message,
        signer: address,
        recoveryId: sig.yParity,
        r: sig.r,
        s: sig.s,
        v: sig.v
      };
    } catch (error) {
      throw new EthereumError(
        "Failed to sign message",
        -32e3,
        { message, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Sign typed data with the connected EOA
   * @param domain - EIP-712 domain
   * @param types - EIP-712 types
   * @param value - EIP-712 value
   * @returns Promise resolving to signature result
   */
  static async signTypedData(domain, types, value) {
    const signer = this.getSigner();
    const address = await signer.getAddress();
    try {
      const signature = await signer.signTypedData(domain, types, value);
      return {
        signature,
        message: JSON.stringify({ domain, types, value }),
        signer: address
      };
    } catch (error) {
      throw new EthereumError(
        "Failed to sign typed data",
        -32e3,
        { domain, types, value, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Derive key from EOA for UTXO operations
   * @param params - Derivation parameters
   * @returns Promise resolving to key derivation data
   */
  static async deriveKeyFromEOA(params) {
    const { baseAddress, purpose, nonce, context, method } = params;
    const message = `UTXO Key Derivation
Address: ${baseAddress}
Purpose: ${purpose}
Nonce: ${nonce}
Context: ${context || ""}
Timestamp: ${Date.now()}`;
    let signature;
    switch (method) {
      case AccountDerivationMethod.MESSAGE_SIGNATURE:
        const sigResult = await this.signMessage(message);
        signature = sigResult.signature;
        break;
      case AccountDerivationMethod.TYPED_DATA_SIGNATURE:
        const typedData = {
          domain: { name: "UTXO System", version: "1" },
          types: {
            KeyDerivation: [
              { name: "baseAddress", type: "address" },
              { name: "purpose", type: "string" },
              { name: "nonce", type: "string" },
              { name: "timestamp", type: "uint256" }
            ]
          },
          value: {
            baseAddress,
            purpose,
            nonce,
            timestamp: Date.now()
          }
        };
        const typedSigResult = await this.signTypedData(typedData.domain, typedData.types, typedData.value);
        signature = typedSigResult.signature;
        break;
      case AccountDerivationMethod.DETERMINISTIC_HASH:
        signature = ethers.keccak256(ethers.toUtf8Bytes(message));
        break;
      default:
        throw new Error(`Unsupported derivation method: ${method}`);
    }
    const derivedKey = ethers.keccak256(signature);
    return {
      eoaAddress: baseAddress,
      derivedKey,
      signature,
      message,
      derivationMethod: method,
      timestamp: Date.now(),
      nonce
    };
  }
  /**
   * Get ERC20 token information
   * @param tokenAddress - Token contract address
   * @param userAddress - User address to get balance and allowance
   * @returns Promise resolving to token data
   */
  static async getERC20TokenInfo(tokenAddress, userAddress) {
    const provider = this.getProvider();
    const tokenContract = new ethers.Contract(tokenAddress, [
      ERC20_ABI_FRAGMENTS.name,
      ERC20_ABI_FRAGMENTS.symbol,
      ERC20_ABI_FRAGMENTS.decimals,
      ERC20_ABI_FRAGMENTS.balanceOf,
      ERC20_ABI_FRAGMENTS.allowance
    ], provider);
    try {
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name().catch(() => "Unknown"),
        tokenContract.symbol().catch(() => "UNK"),
        tokenContract.decimals().catch(() => 18)
      ]);
      let balance;
      let allowance;
      if (userAddress) {
        [balance] = await Promise.all([
          tokenContract.balanceOf(userAddress).catch(() => 0n)
        ]);
      }
      return {
        address: tokenAddress,
        symbol,
        name,
        decimals: Number(decimals),
        // Convert BigInt to number
        balance: balance ? BigInt(balance.toString()) : void 0,
        allowance: allowance ? BigInt(allowance.toString()) : void 0,
        verified: false
        // Would need external verification service
      };
    } catch (error) {
      throw new EthereumError(
        `Failed to get token info for ${tokenAddress}`,
        -32e3,
        { tokenAddress, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Approve ERC20 token spending
   * @param tokenAddress - Token contract address
   * @param spenderAddress - Spender contract address
   * @param amount - Amount to approve
   * @returns Promise resolving to transaction receipt
   */
  static async approveERC20(tokenAddress, spenderAddress, amount) {
    const signer = this.getSigner();
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [ERC20_ABI_FRAGMENTS.approve],
      signer
    );
    try {
      console.log("🔄 Approving token spending...", {
        tokenAddress,
        spenderAddress,
        amount: amount.toString()
      });
      const tx = await tokenContract.approve(spenderAddress, amount);
      console.log("📝 Approval transaction sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Approval confirmed:", receipt.transactionHash);
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      console.error("❌ Token approval failed:", error);
      let errorMessage = "Unknown error";
      let errorCode = -32e3;
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
          errorCode = 4001;
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for gas";
          errorCode = -32e3;
        } else if (error.message.includes("execution reverted")) {
          errorMessage = "Transaction reverted - contract may not exist or method failed";
          errorCode = -32015;
        }
      }
      throw new EthereumError(
        `Failed to approve token: ${errorMessage}`,
        errorCode,
        { tokenAddress, spenderAddress, amount: amount.toString(), originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }
  /**
   * Estimate gas for a transaction
   * @param params - Transaction parameters
   * @returns Promise resolving to gas estimation
   */
  static async estimateGas(params) {
    const provider = this.getProvider();
    this.getSigner();
    try {
      const gasLimit = await provider.estimateGas({
        to: params.to,
        value: params.value || void 0,
        data: params.data
      });
      const feeData = await provider.getFeeData();
      let gasPrice = BigInt(0);
      let maxFeePerGas;
      let maxPriorityFeePerGas;
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        maxFeePerGas = BigInt(feeData.maxFeePerGas.toString());
        maxPriorityFeePerGas = BigInt(feeData.maxPriorityFeePerGas.toString());
        gasPrice = maxFeePerGas;
      } else if (feeData.gasPrice) {
        gasPrice = BigInt(feeData.gasPrice.toString());
      }
      const estimatedCost = BigInt(gasLimit.toString()) * gasPrice;
      return {
        gasLimit: BigInt(gasLimit.toString()),
        gasPrice,
        maxFeePerGas,
        maxPriorityFeePerGas,
        estimatedCost,
        confidence: 0.9
        // Static confidence, could be improved with historical data
      };
    } catch (error) {
      throw new EthereumError(
        "Failed to estimate gas",
        -32e3,
        { params, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Send transaction with proper error handling
   * @param params - Transaction parameters
   * @returns Promise resolving to transaction receipt
   */
  static async sendTransaction(params) {
    const signer = this.getSigner();
    try {
      const txParams = {
        to: params.to,
        value: params.value || void 0,
        data: params.data,
        gasLimit: params.gasLimit || void 0,
        nonce: params.nonce
      };
      if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
        txParams.maxFeePerGas = params.maxFeePerGas;
        txParams.maxPriorityFeePerGas = params.maxPriorityFeePerGas;
        txParams.type = 2;
      } else if (params.gasPrice) {
        txParams.gasPrice = params.gasPrice;
        txParams.type = 0;
      }
      const tx = await signer.sendTransaction(txParams);
      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) {
        throw new TransactionRevertedError(void 0, receipt?.hash || tx.hash);
      }
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      if (error instanceof TransactionRevertedError) {
        throw error;
      }
      throw new EthereumError(
        "Transaction failed",
        -32e3,
        { params, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Call smart contract function
   * @param params - Contract call parameters
   * @returns Promise resolving to transaction receipt
   */
  static async callSmartContract(params) {
    const signer = this.getSigner();
    try {
      const contract = new ethers.Contract(
        params.contractAddress,
        params.abi ? [params.abi] : [],
        signer
      );
      const tx = await contract[params.functionName](...params.args, params.options || {});
      const receipt = await tx.wait();
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      throw new EthereumError(
        `Smart contract call failed: ${params.functionName}`,
        -32e3,
        { params, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Switch to a different network
   * @param networkConfig - Network configuration
   * @returns Promise resolving to success status
   */
  static async switchNetwork(networkConfig) {
    if (!window.ethereum) {
      throw new EthereumError("No wallet provider available");
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${networkConfig.chainId.toString(16)}` }]
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        return await this.addNetwork(networkConfig);
      }
      throw new UnsupportedChainError(networkConfig.chainId);
    }
  }
  /**
   * Add a new network to the wallet
   * @param networkConfig - Network configuration
   * @returns Promise resolving to success status
   */
  static async addNetwork(networkConfig) {
    if (!window.ethereum) {
      throw new EthereumError("No wallet provider available");
    }
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: `0x${networkConfig.chainId.toString(16)}`,
          chainName: networkConfig.name,
          rpcUrls: networkConfig.rpcUrls,
          nativeCurrency: networkConfig.nativeCurrency,
          blockExplorerUrls: networkConfig.blockExplorerUrls
        }]
      });
      return true;
    } catch (error) {
      throw new EthereumError(
        `Failed to add network: ${networkConfig.name}`,
        -32e3,
        { networkConfig, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
  /**
   * Set up event listeners for wallet events
   */
  static setupEventListeners() {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) {
        this.disconnectWallet();
      } else if (this.currentEOA && accounts[0] !== this.currentEOA.address) {
        this.connectWallet(this.currentEOA.providerType);
      }
    });
    window.ethereum.on("chainChanged", (chainId) => {
      if (this.currentEOA) {
        this.currentEOA.chainId = BigInt(parseInt(chainId, 16));
        this.currentEOA.networkName = this.getNetworkName(Number(this.currentEOA.chainId));
      }
    });
    window.ethereum.on("disconnect", () => {
      this.disconnectWallet();
    });
  }
  /**
   * Helper to check if provider is MetaMask
   */
  static isMetaMaskProvider(provider) {
    return provider && (provider.isMetaMask === true || provider._metamask?.isUnlocked !== void 0 || provider.selectedAddress !== void 0);
  }
  /**
   * Get network name from chain ID
   */
  static getNetworkName(chainId) {
    const network = Object.values(ETHEREUM_NETWORKS).find((n) => Number(n.chainId) === chainId);
    return network?.name || `Unknown (${chainId})`;
  }
  /**
   * Format ethers transaction receipt to our type
   */
  static formatTransactionReceipt(receipt) {
    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      gasUsed: BigInt(receipt.gasUsed.toString()),
      effectiveGasPrice: BigInt(receipt.gasPrice?.toString() || "0"),
      status: receipt.status,
      contractAddress: receipt.contractAddress,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
        removed: log.removed
      })),
      confirmations: receipt.confirmations || 0
    };
  }
  /**
   * Utility to format token amounts
   */
  static formatTokenAmount(amount, decimals) {
    return ethers.formatUnits(amount.toString(), decimals);
  }
  /**
   * Utility to parse token amounts
   */
  static parseTokenAmount(amount, decimals) {
    return BigInt(ethers.parseUnits(amount, decimals).toString());
  }
  /**
   * Check if address is valid Ethereum address
   */
  static isValidAddress(address) {
    return ethers.isAddress(address);
  }
  /**
   * Get short address format for display
   */
  static getShortAddress(address, start = 6, end = 4) {
    if (!this.isValidAddress(address)) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }
  /**
   * Wait for transaction confirmation
   */
  static async waitForConfirmation(txHash, confirmations = 1) {
    const provider = this.getProvider();
    try {
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      return this.formatTransactionReceipt(receipt);
    } catch (error) {
      throw new EthereumError(
        `Failed to wait for transaction confirmation: ${txHash}`,
        -32e3,
        { txHash, confirmations, error: error instanceof Error ? error.message : "Unknown error" }
      );
    }
  }
}
class AttestationService {
  signer = null;
  nonceCounter = /* @__PURE__ */ new Map();
  constructor() {
    this.initializeSigner();
  }
  /**
   * Inicializar el signer autorizado desde variables de entorno
   */
  initializeSigner() {
    try {
      const privateKey = process.env.PRIVATE_KEY_ADMIN;
      if (!privateKey) {
        console.warn("⚠️ No admin private key found - attestations will not be available");
        return;
      }
      if (!privateKey.match(/^[0-9a-fA-F]{64}$/)) {
        throw new Error("Invalid private key format - must be 64 hex characters");
      }
      const provider = EthereumHelpers.getProvider();
      this.signer = new ethers.Wallet("0x" + privateKey, provider);
      console.log("✅ Attestation service initialized with authorized signer:", this.signer.address);
    } catch (error) {
      console.error("❌ Failed to initialize attestation signer:", error);
      this.signer = null;
    }
  }
  /**
   * Obtener el siguiente nonce para un usuario
   */
  getNextNonce(userAddress) {
    const current = this.nonceCounter.get(userAddress.toLowerCase()) || 0n;
    const next = current + 1n;
    this.nonceCounter.set(userAddress.toLowerCase(), next);
    return next;
  }
  /**
   * Crear hash de datos para DEPOSIT
   */
  createDepositDataHash(data) {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256", "uint256", "bytes32", "uint256", "address"],
      [data.tokenAddress, data.commitmentX, data.commitmentY, data.nullifier, data.amount, data.userAddress]
    );
    return ethers.keccak256(encoded);
  }
  /**
   * Crear hash de datos para TRANSFER
   */
  createTransferDataHash(data) {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "uint256", "uint256", "bytes32", "address", "address"],
      [
        data.inputCommitmentX,
        data.inputCommitmentY,
        data.outputCommitmentX,
        data.outputCommitmentY,
        data.nullifier,
        data.newOwner,
        data.userAddress
      ]
    );
    return ethers.keccak256(encoded);
  }
  /**
   * Crear hash de datos para SPLIT
   */
  createSplitDataHash(data) {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "uint256[]", "uint256[]", "uint256[]", "address[]", "bytes32", "address"],
      [
        data.inputCommitmentX,
        data.inputCommitmentY,
        data.outputCommitmentsX,
        data.outputCommitmentsY,
        data.outputValues,
        data.outputOwners,
        data.nullifier,
        data.userAddress
      ]
    );
    return ethers.keccak256(encoded);
  }
  /**
   * Crear hash de datos para WITHDRAW
   */
  createWithdrawDataHash(data) {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "uint256", "uint256", "bytes32", "address", "address"],
      [data.commitmentX, data.commitmentY, data.amount, data.nullifier, data.recipient, data.userAddress]
    );
    return ethers.keccak256(encoded);
  }
  /**
   * Crear y firmar attestation genérica
   */
  async createAttestation(operation, dataHash, userAddress) {
    if (!this.signer) {
      throw new Error("Attestation signer not initialized");
    }
    const nonce = this.getNextNonce(userAddress);
    const timestamp = BigInt(Math.floor(Date.now() / 1e3));
    const attestationData = {
      operation,
      dataHash,
      nonce,
      timestamp
    };
    const messageHash = ethers.solidityPackedKeccak256(
      ["string", "bytes32", "uint256", "uint256"],
      [operation, dataHash, nonce, timestamp]
    );
    const signature = await this.signer.signMessage(ethers.getBytes(messageHash));
    console.log(`✅ Created ${operation} attestation:`, {
      operation,
      dataHash: dataHash.slice(0, 10) + "...",
      nonce: nonce.toString(),
      timestamp: timestamp.toString(),
      signature: signature.slice(0, 10) + "...",
      signer: this.signer.address
    });
    return {
      ...attestationData,
      signature,
      signer: this.signer.address
    };
  }
  /**
   * Crear attestation para DEPOSIT
   */
  async createDepositAttestation(data) {
    console.log("🔏 Creating DEPOSIT attestation...");
    const dataHash = this.createDepositDataHash(data);
    return this.createAttestation("DEPOSIT", dataHash, data.userAddress);
  }
  /**
   * Crear attestation para TRANSFER
   */
  async createTransferAttestation(data) {
    console.log("🔏 Creating TRANSFER attestation...");
    const dataHash = this.createTransferDataHash(data);
    return this.createAttestation("TRANSFER", dataHash, data.userAddress);
  }
  /**
   * Crear attestation para SPLIT
   */
  async createSplitAttestation(data) {
    console.log("🔏 Creating SPLIT attestation...");
    const dataHash = this.createSplitDataHash(data);
    return this.createAttestation("SPLIT", dataHash, data.userAddress);
  }
  /**
   * Crear attestation para WITHDRAW
   */
  async createWithdrawAttestation(data) {
    console.log("🔏 Creating WITHDRAW attestation...");
    const dataHash = this.createWithdrawDataHash(data);
    return this.createAttestation("WITHDRAW", dataHash, data.userAddress);
  }
  /**
   * Verificar una attestation firmada (para testing)
   */
  async verifyAttestation(attestation) {
    try {
      const messageHash = ethers.solidityPackedKeccak256(
        ["string", "bytes32", "uint256", "uint256"],
        [attestation.operation, attestation.dataHash, attestation.nonce, attestation.timestamp]
      );
      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), attestation.signature);
      const isValid = recoveredAddress.toLowerCase() === attestation.signer.toLowerCase();
      console.log("🔍 Attestation verification:", {
        operation: attestation.operation,
        expectedSigner: attestation.signer,
        recoveredSigner: recoveredAddress,
        isValid
      });
      return isValid;
    } catch (error) {
      console.error("❌ Attestation verification failed:", error);
      return false;
    }
  }
  /**
   * Obtener dirección del signer autorizado
   */
  getAuthorizedSigner() {
    return this.signer?.address || null;
  }
  /**
   * Verificar si el servicio está disponible
   */
  isAvailable() {
    return this.signer !== null;
  }
}
new AttestationService();
class ZenroomHelpers {
  static attestationService = new AttestationService();
  // ========================
  // BN254 CURVE OPERATIONS
  // ========================
  /**
   * Convertir string a BigInt con validación BN254
   */
  static toBigInt(value) {
    const result = BigInt(value);
    const BN254_MODULUS = BigInt("0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001");
    return result % BN254_MODULUS;
  }
  /**
   * Generar factor de cegado seguro para BN254
   */
  static async generateSecureBlindingFactor() {
    const script = `
      rule input
      rule output
      Given nothing
      When I create the random object of '256' bits
      Then print the random object as 'hex'
    `;
    const result = await zenroom.exec(script);
    const randomHex = JSON.parse(result.result).random_object;
    return this.toBigInt("0x" + randomHex).toString(16).padStart(64, "0");
  }
  /**
   * Crear Pedersen commitment usando BN254
   */
  static async createPedersenCommitment(value, blindingFactor) {
    const script = `
      Scenario 'ecdh': Create commitment
      Given I have a 'string' named 'value'
      Given I have a 'string' named 'blinding_factor'
      When I create the pedersen commitment of 'value' with blinding factor 'blinding_factor'
      Then print the 'pedersen commitment'
    `;
    const data = {
      value,
      blinding_factor: blindingFactor
    };
    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const commitment = JSON.parse(result.result);
    const commitmentHex = commitment.pedersen_commitment;
    const x = BigInt("0x" + commitmentHex.substring(2, 66));
    const y = BigInt("0x" + commitmentHex.substring(66, 130));
    return {
      x,
      y,
      blindingFactor,
      value: BigInt(value)
    };
  }
  /**
   * Verificar Pedersen commitment
   */
  static async verifyPedersenCommitment(commitmentHex, value, blindingFactor) {
    try {
      const script = `
        Scenario 'ecdh': Verify commitment
        Given I have a 'string' named 'commitment'
        Given I have a 'string' named 'value'
        Given I have a 'string' named 'blinding_factor'
        When I verify the pedersen commitment 'commitment' with value 'value' and blinding factor 'blinding_factor'
        Then print the string 'verified'
      `;
      const data = {
        commitment: commitmentHex,
        value: value.toString(),
        blinding_factor: blindingFactor.toString(16)
      };
      const result = await zenroom.exec(script, { data: JSON.stringify(data) });
      return JSON.parse(result.result) === "verified";
    } catch (error) {
      console.warn("Pedersen commitment verification failed:", error);
      return false;
    }
  }
  /**
   * Generar Bulletproof range proof
   */
  static async generateBulletproof(value, blindingFactor, minRange = BigInt(0), maxRange = BigInt(2n ** 64n - 1n)) {
    const script = `
      Scenario 'bulletproof': Create range proof
      Given I have a 'string' named 'value'
      Given I have a 'string' named 'blinding_factor'
      Given I have a 'string' named 'min_range'
      Given I have a 'string' named 'max_range'
      When I create the bulletproof range proof of 'value' in range 'min_range' to 'max_range' with blinding factor 'blinding_factor'
      Then print the 'bulletproof range proof'
    `;
    const data = {
      value: value.toString(),
      blinding_factor: blindingFactor,
      min_range: minRange.toString(),
      max_range: maxRange.toString()
    };
    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const proof = JSON.parse(result.result);
    return {
      A: proof.bulletproof_range_proof.A,
      S: proof.bulletproof_range_proof.S,
      T1: proof.bulletproof_range_proof.T1,
      T2: proof.bulletproof_range_proof.T2,
      taux: proof.bulletproof_range_proof.taux,
      mu: proof.bulletproof_range_proof.mu,
      proof: proof.bulletproof_range_proof.proof,
      commitment: proof.bulletproof_range_proof.commitment
    };
  }
  /**
   * Generar Coconut credential
   */
  static async generateCoconutCredential(attributes, issuerKeys) {
    const script = `
      Scenario 'coconut': Create credential
      Given I have a 'string array' named 'attributes'
      Given I have a 'coconut issuer keypair' named 'issuer_keys'
      When I create the coconut credential request
      When I create the coconut credential signature
      Then print the 'coconut credential'
    `;
    const data = {
      attributes,
      issuer_keys: issuerKeys
    };
    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const credential = JSON.parse(result.result);
    return {
      signature: credential.coconut_credential.signature,
      proof: credential.coconut_credential.proof,
      attributes
    };
  }
  /**
   * Generar equality proof
   */
  static async generateEqualityProof(commitment1, commitment2) {
    const script = `
      Scenario 'ecdh': Create equality proof
      Given I have a 'string' named 'commitment1'
      Given I have a 'string' named 'commitment2'
      Given I have a 'string' named 'blinding1'
      Given I have a 'string' named 'blinding2'
      When I create the equality proof between 'commitment1' and 'commitment2'
      Then print the 'equality proof'
    `;
    const commitment1Hex = "0x" + commitment1.x.toString(16).padStart(64, "0") + commitment1.y.toString(16).padStart(64, "0");
    const commitment2Hex = "0x" + commitment2.x.toString(16).padStart(64, "0") + commitment2.y.toString(16).padStart(64, "0");
    const data = {
      commitment1: commitment1Hex,
      commitment2: commitment2Hex,
      blinding1: commitment1.blindingFactor,
      blinding2: commitment2.blindingFactor
    };
    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    const proof = JSON.parse(result.result);
    return {
      challenge: proof.equality_proof.challenge,
      response1: proof.equality_proof.response1,
      response2: proof.equality_proof.response2
    };
  }
  /**
   * Generar nullifier hash
   */
  static async generateNullifierHash(commitment, owner, nonce) {
    const script = `
      rule input
      rule output
      Given I have a 'string' named 'commitment'
      Given I have a 'string' named 'owner'
      Given I have a 'string' named 'nonce'
      When I create the hash of 'commitment' and 'owner' and 'nonce'
      Then print the 'hash' as 'hex'
    `;
    const data = { commitment, owner, nonce };
    const result = await zenroom.exec(script, { data: JSON.stringify(data) });
    return JSON.parse(result.result).hash;
  }
  // ========================
  // OPERATIONS WITH ATTESTATIONS
  // ========================
  /**
   * Crear depósito con attestation del backend
   */
  static async createDepositWithAttestation(value, recipient, tokenAddress) {
    console.log("🔐 Creating deposit with Zenroom + Backend attestation...");
    const blindingFactor = await this.generateSecureBlindingFactor();
    const commitment = await this.createPedersenCommitment(value.toString(), blindingFactor);
    const attestation = await this.attestationService.createDepositAttestation({
      tokenAddress,
      commitmentX: commitment.x,
      commitmentY: commitment.y,
      nullifier: await this.generateNullifierHash("0x" + commitment.x.toString(16) + commitment.y.toString(16), recipient, Date.now().toString()),
      amount: value,
      userAddress: recipient
    });
    console.log("✅ Deposit commitment + attestation created");
    return { commitment, attestation };
  }
  /**
   * Crear transferencia con attestation del backend
   */
  static async createTransferWithAttestation(inputCommitment, outputValue, outputRecipient, sender) {
    console.log("🔐 Creating transfer with Zenroom + Backend attestation...");
    const outputBlindingFactor = await this.generateSecureBlindingFactor();
    const outputCommitment = await this.createPedersenCommitment(outputValue.toString(), outputBlindingFactor);
    const inputCommitmentHex = "0x" + inputCommitment.x.toString(16).padStart(64, "0") + inputCommitment.y.toString(16).padStart(64, "0");
    const attestation = await this.attestationService.createTransferAttestation({
      inputCommitmentX: inputCommitment.x,
      inputCommitmentY: inputCommitment.y,
      outputCommitmentX: outputCommitment.x,
      outputCommitmentY: outputCommitment.y,
      nullifier: await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString()),
      newOwner: outputRecipient,
      userAddress: sender
    });
    console.log("✅ Transfer commitment + attestation created");
    return { outputCommitment, attestation };
  }
  /**
   * Crear split con attestation del backend
   */
  static async createSplitWithAttestation(inputCommitment, outputValues, outputOwners, sender) {
    console.log("🔐 Creating split with Zenroom + Backend attestation...");
    const outputCommitments = [];
    for (const value of outputValues) {
      const blindingFactor = await this.generateSecureBlindingFactor();
      const commitment = await this.createPedersenCommitment(value.toString(), blindingFactor);
      outputCommitments.push(commitment);
    }
    const inputCommitmentHex = "0x" + inputCommitment.x.toString(16).padStart(64, "0") + inputCommitment.y.toString(16).padStart(64, "0");
    const outputCommitmentsX = outputCommitments.map((c) => c.x);
    const outputCommitmentsY = outputCommitments.map((c) => c.y);
    const attestation = await this.attestationService.createSplitAttestation({
      inputCommitmentX: inputCommitment.x,
      inputCommitmentY: inputCommitment.y,
      outputCommitmentsX,
      outputCommitmentsY,
      outputValues,
      outputOwners,
      nullifier: await this.generateNullifierHash(inputCommitmentHex, sender, Date.now().toString()),
      userAddress: sender
    });
    console.log("✅ Split commitments + attestation created");
    return { outputCommitments, attestation };
  }
  /**
   * Crear withdrawal con attestation del backend
   */
  static async createWithdrawWithAttestation(commitment, recipient, sender) {
    console.log("🔐 Creating withdrawal with Backend attestation...");
    const commitmentHex = "0x" + commitment.x.toString(16).padStart(64, "0") + commitment.y.toString(16).padStart(64, "0");
    const attestation = await this.attestationService.createWithdrawAttestation({
      commitmentX: commitment.x,
      commitmentY: commitment.y,
      amount: commitment.value,
      nullifier: await this.generateNullifierHash(commitmentHex, sender, Date.now().toString()),
      recipient,
      userAddress: sender
    });
    console.log("✅ Withdrawal attestation created");
    return { attestation };
  }
}
class EventEmitter {
  events = {};
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }
  emit(event, ...args) {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach((listener) => listener(...args));
    return true;
  }
  off(event, listener) {
    if (!this.events[event]) {
      return this;
    }
    this.events[event] = this.events[event].filter((l) => l !== listener);
    return this;
  }
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}
class UTXOLibrary extends EventEmitter {
  // Core components
  zenroom;
  ethereum;
  contract = null;
  // State management
  utxos = /* @__PURE__ */ new Map();
  config;
  currentEOA = null;
  isInitialized = false;
  // Cache and sync
  lastSyncTimestamp = 0;
  syncInProgress = false;
  /**
   * Constructor
   * @param config - UTXO manager configuration
   */
  constructor(config = {}) {
    super();
    this.config = {
      autoConsolidate: false,
      consolidationThreshold: 10,
      maxUTXOAge: 7 * 24 * 60 * 60,
      // 7 days
      privacyMode: true,
      defaultGasLimit: BigInt(5e5),
      cacheTimeout: 3e4,
      // 30 seconds
      enableBackup: true,
      ...config
    };
    this.zenroom = ZenroomHelpers;
    this.ethereum = EthereumHelpers;
    console.log("🚀 UTXOLibrary initialized with REAL BN254 cryptography");
    console.log("   - Privacy mode:", this.config.privacyMode);
    console.log("   - Auto consolidation:", this.config.autoConsolidate);
    console.log("   - Cache timeout:", this.config.cacheTimeout, "ms");
  }
  // ========================
  // INITIALIZATION & SETUP
  // ========================
  /**
   * Initialize the library with REAL BN254 cryptography
   * @param contractAddress - UTXOVault contract address
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to initialization success
   */
  async initialize(contractAddressOrProvider) {
    try {
      console.log("🚀 Initializing UTXOLibrary with BN254 cryptography...");
      console.log("📝 Contract address:", contractAddressOrProvider);
      if (!contractAddressOrProvider || contractAddressOrProvider === "default") {
        throw new Error("Invalid contract address provided. Please provide a valid Ethereum address.");
      }
      try {
        if (typeof window !== "undefined" && window.ethereum) {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          const testContract = new ethers.Contract(
            contractAddressOrProvider,
            [
              "function getRegisteredTokenCount() view returns (uint256)"
            ],
            signer
          );
          await testContract.getRegisteredTokenCount();
          this.contract = createUTXOVaultContract(contractAddressOrProvider, signer);
          const tokenCount = await this.contract.getRegisteredTokenCount();
          console.log("✅ Contrato UTXO validado correctamente e inicializado. Tokens registrados:", tokenCount.toString());
        }
      } catch (contractError) {
        console.error("❌ Error conectando con el contrato:", contractError);
        throw new Error(`No se pudo conectar con el contrato UTXO en la dirección ${contractAddressOrProvider}. Verifica que la dirección sea correcta y que el contrato esté desplegado.`);
      }
      console.log("🔬 Testing BN254 cryptography...");
      const cryptoTestPassed = await ZenroomHelpers.testBN254Operations();
      if (!cryptoTestPassed) {
        console.error("❌ BN254 cryptography test failed");
        throw new Error("BN254 cryptography initialization failed");
      }
      console.log("✅ BN254 cryptography test passed");
      this.isInitialized = true;
      this.emit("library:initialized", {
        cryptography: "BN254",
        status: "ready",
        contractAddress: contractAddressOrProvider
      });
      console.log("🎉 UTXOLibrary initialized successfully with BN254 cryptography");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize UTXOLibrary:", error);
      this.isInitialized = false;
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error("Unknown error during UTXOLibrary initialization");
      }
    }
  }
  /**
   * Connect wallet
   * @param preferredProvider - Preferred wallet provider
   * @returns Promise resolving to connection result
   */
  async connectWallet(preferredProvider = WalletProviderType.METAMASK) {
    console.log("🔗 Connecting wallet...");
    try {
      const result = await this.ethereum.connectWallet(preferredProvider);
      if (result.success && result.eoa) {
        this.currentEOA = result.eoa;
        console.log("✅ Wallet connected:", result.eoa.address);
        this.emit("wallet:connected", result.eoa);
      } else {
        console.error("❌ Wallet connection failed:", result.error);
      }
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown connection error"
      };
      this.emit("wallet:connection_failed", error);
      return result;
    }
  }
  /**
   * Disconnect wallet and cleanup
   */
  async disconnect() {
    console.log("🔌 Disconnecting wallet...");
    await this.ethereum.disconnectWallet();
    this.currentEOA = null;
    this.contract = null;
    this.utxos.clear();
    this.isInitialized = false;
    this.emit("wallet:disconnected");
    console.log("✅ Wallet disconnected");
  }
  // ========================
  // CORE UTXO OPERATIONS WITH REAL BN254 CRYPTOGRAPHY
  // ========================
  /**
   * Deposit ERC20 tokens as private UTXO with REAL BN254 cryptography
   * @param params - Deposit parameters
   * @returns Promise resolving to operation result
   */
  async depositAsPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`💰 Creating private UTXO deposit with REAL BN254 cryptography for ${params.amount} tokens...`);
    try {
      const { tokenAddress, amount } = params;
      console.log("🎲 Generating secure BN254 blinding factor...");
      const blindingFactor = await this.zenroom.generateSecureBlindingFactor();
      console.log("🔐 Creating REAL BN254 Pedersen commitment...");
      const commitmentResult = await this.zenroom.createPedersenCommitment(
        amount.toString(),
        blindingFactor
      );
      console.log("🔐 Generating nullifier hash...");
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        commitmentResult.pedersen_commitment,
        Date.now().toString()
      );
      console.log("🔍 Generating range proof...");
      const rangeProof = await this.zenroom.generateRangeProof(
        BigInt(amount),
        ZenroomHelpers.toBigInt("0x" + blindingFactor)
      );
      const generatorParams = this.getBN254Generators();
      const fullCommitment = commitmentResult.pedersen_commitment.startsWith("0x") ? commitmentResult.pedersen_commitment : "0x" + commitmentResult.pedersen_commitment;
      const fullCommitmentHex = fullCommitment.substring(2);
      const contractCommitmentHex = fullCommitmentHex.substring(0, 64);
      const normalizedCommitment = "0x" + contractCommitmentHex;
      const normalizedNullifier = nullifierHash.startsWith("0x") ? nullifierHash : "0x" + nullifierHash;
      console.log("🔍 Validando formato de commitment y nullifier para contrato...");
      if (!normalizedCommitment.startsWith("0x") || !ZenroomHelpers.isValidHex(normalizedCommitment.substring(2), 32)) {
        throw new Error(`Invalid commitment format for contract: ${normalizedCommitment.slice(0, 10)}...`);
      }
      if (!normalizedNullifier.startsWith("0x") || !ZenroomHelpers.isValidHex(normalizedNullifier.substring(2), 32)) {
        throw new Error(`Invalid nullifier format for contract: ${normalizedNullifier.slice(0, 10)}...`);
      }
      console.log("✅ Commitment convertido para contrato:", {
        original: fullCommitment.slice(0, 15) + "...",
        paraContrato: normalizedCommitment.slice(0, 15) + "...",
        longitud: normalizedCommitment.length - 2
      });
      const depositParams = {
        tokenAddress,
        commitment: normalizedCommitment,
        nullifierHash: normalizedNullifier,
        blindingFactor: ZenroomHelpers.toBigInt("0x" + blindingFactor)
      };
      const proofParams = {
        rangeProof
      };
      console.log("📋 Contract parameters prepared:", {
        tokenAddress,
        commitment: {
          value: normalizedCommitment.slice(0, 20) + "...",
          hasPrefix: normalizedCommitment.startsWith("0x"),
          length: normalizedCommitment.length,
          lengthWithoutPrefix: normalizedCommitment.startsWith("0x") ? normalizedCommitment.length - 2 : normalizedCommitment.length
        },
        nullifierHash: {
          value: normalizedNullifier.slice(0, 20) + "...",
          hasPrefix: normalizedNullifier.startsWith("0x"),
          length: normalizedNullifier.length,
          lengthWithoutPrefix: normalizedNullifier.startsWith("0x") ? normalizedNullifier.length - 2 : normalizedNullifier.length
        },
        blindingFactor: blindingFactor.slice(0, 10) + "...",
        rangeProofLength: rangeProof.length
      });
      console.log("🔓 Approving token transfer...");
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ["function approve(address,uint256) returns (bool)"],
        this.ethereum.getSigner()
      );
      const approveTx = await tokenContract.approve(this.contract.address, amount);
      await approveTx.wait();
      console.log("✅ Token approval confirmed");
      console.log("🚀 Executing contract call...");
      const tx = await this.contract.depositAsPrivateUTXO(
        depositParams,
        proofParams,
        generatorParams,
        amount,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Contract call confirmed:", receipt?.hash);
      const utxoId = await this.generateBN254UTXOId(
        commitmentResult.pedersen_commitment,
        this.currentEOA.address,
        Date.now()
      );
      const utxo = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner: this.currentEOA.address,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: commitmentResult.pedersen_commitment,
        parentUTXO: "",
        utxoType: UTXOType.DEPOSIT,
        blindingFactor,
        localCreatedAt: Date.now(),
        confirmed: true,
        creationTxHash: receipt?.hash,
        blockNumber: receipt?.blockNumber,
        // Add BN254 specific fields
        rangeProof,
        nullifierHash,
        cryptographyType: "BN254"
      };
      this.utxos.set(utxoId, utxo);
      await this.savePrivateUTXOToLocal(this.currentEOA.address, utxo);
      this.emit("utxo:created", utxo);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds: [utxoId]
      };
      console.log("✅ Private UTXO deposit successful with REAL BN254 cryptography:", utxoId);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO deposit failed:", error);
      let errorMessage = "Deposit failed";
      if (error instanceof Error) {
        if (error.message.includes("Invalid commitment point")) {
          errorMessage = "BN254 commitment validation failed. Please try again.";
        } else if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction";
        } else {
          errorMessage = error.message;
        }
      }
      const result = {
        success: false,
        error: errorMessage,
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Deposit failed",
        "deposit",
        void 0,
        error
      ));
      return result;
    }
  }
  /**
   * Split private UTXO into multiple outputs with REAL BN254 cryptography
   * @param params - Split parameters
   * @returns Promise resolving to operation result
   */
  async splitPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`✂️ Splitting private UTXO with REAL BN254 cryptography: ${params.inputUTXOId}...`);
    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      const inputUTXO = this.utxos.get(inputUTXOId);
      if (!inputUTXO) {
        throw new UTXONotFoundError(inputUTXOId);
      }
      if (inputUTXO.isSpent) {
        throw new UTXOAlreadySpentError(inputUTXOId);
      }
      const totalOutputValue = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutputValue !== inputUTXO.value) {
        throw new Error(`Value conservation failed: input=${inputUTXO.value}, outputs=${totalOutputValue}`);
      }
      console.log("🎲 Generating secure output blinding factors...");
      const outputBlindings = params.outputBlindingFactors || await Promise.all(
        outputValues.map(() => this.zenroom.generateSecureBlindingFactor())
      );
      console.log("🔐 Creating REAL BN254 Pedersen commitments for outputs...");
      const outputCommitments = await Promise.all(
        outputValues.map(async (value, index) => {
          const result2 = await this.zenroom.createPedersenCommitment(
            value.toString(),
            outputBlindings[index]
          );
          return result2.pedersen_commitment;
        })
      );
      console.log("🔍 Generating split proof...");
      const splitProof = await this.zenroom.generateSplitProof(
        BigInt(inputUTXO.value),
        outputValues.map((v) => BigInt(v)),
        ZenroomHelpers.toBigInt("0x" + inputUTXO.blindingFactor),
        outputBlindings.map((b) => ZenroomHelpers.toBigInt("0x" + b))
      );
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        inputUTXO.commitment,
        Date.now().toString()
      );
      const generatorParams = this.getBN254Generators();
      console.log("🚀 Executing split contract call...");
      const tx = await this.contract.splitPrivateUTXO(
        inputUTXO.commitment,
        outputCommitments,
        outputValues.map((v) => v),
        outputBlindings.map((b) => ZenroomHelpers.toBigInt("0x" + b)),
        splitProof,
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Split contract call confirmed:", receipt?.hash);
      inputUTXO.isSpent = true;
      this.emit("utxo:spent", inputUTXOId);
      const createdUTXOIds = [];
      for (let i = 0; i < outputValues.length; i++) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitments[i],
          outputOwners[i],
          Date.now() + i
        );
        const outputUTXO = {
          id: outputId,
          exists: true,
          value: outputValues[i],
          tokenAddress: inputUTXO.tokenAddress,
          owner: outputOwners[i],
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitments[i],
          parentUTXO: inputUTXOId,
          utxoType: UTXOType.SPLIT,
          blindingFactor: outputBlindings[i],
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          tokenMetadata: inputUTXO.tokenMetadata,
          cryptographyType: "BN254"
        };
        this.utxos.set(outputId, outputUTXO);
        await this.savePrivateUTXOToLocal(outputOwners[i], outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit("utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ Private UTXO split successful with REAL BN254 cryptography:", createdUTXOIds);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO split failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Split failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Split failed",
        "split",
        params.inputUTXOId,
        error
      ));
      return result;
    }
  }
  /**
   * Withdraw private UTXO back to ERC20 tokens with REAL BN254 cryptography
   * @param params - Withdraw parameters
   * @returns Promise resolving to operation result
   */
  async withdrawFromPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`💸 Withdrawing private UTXO with REAL BN254 cryptography: ${params.utxoId}...`);
    try {
      const { utxoId, recipient } = params;
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }
      console.log("🔍 Verifying UTXO commitment...");
      const isValidCommitment = await this.zenroom.verifyPedersenCommitment(
        utxo.commitment,
        BigInt(utxo.value),
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor)
      );
      if (!isValidCommitment) {
        throw new Error("UTXO commitment verification failed - data may be corrupted");
      }
      console.log("🔐 Generating withdrawal nullifier...");
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        utxo.commitment,
        Date.now().toString()
      );
      const generatorParams = this.getBN254Generators();
      console.log("🚀 Executing withdrawal contract call...");
      const tx = await this.contract.withdrawFromPrivateUTXO(
        utxo.commitment,
        utxo.value,
        ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Withdrawal confirmed:", receipt?.hash);
      utxo.isSpent = true;
      this.emit("utxo:spent", utxoId);
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed
      };
      console.log("✅ Private UTXO withdrawal successful with REAL BN254 cryptography");
      return result;
    } catch (error) {
      console.error("❌ Private UTXO withdrawal failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Withdrawal failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Withdrawal failed",
        "withdraw",
        params.utxoId,
        error
      ));
      return result;
    }
  }
  /**
   * Transfer private UTXO to another owner with REAL BN254 cryptography
   * @param params - Transfer parameters
   * @returns Promise resolving to operation result
   */
  async transferPrivateUTXO(params) {
    this.ensureInitialized();
    console.log(`🔄 Transferring private UTXO with REAL BN254 cryptography: ${params.utxoId} to ${params.newOwner}...`);
    try {
      const { utxoId, newOwner } = params;
      const utxo = this.utxos.get(utxoId);
      if (!utxo) {
        throw new UTXONotFoundError(utxoId);
      }
      if (utxo.isSpent) {
        throw new UTXOAlreadySpentError(utxoId);
      }
      console.log("🎲 Generating secure output blinding factor...");
      const outputBlinding = await this.zenroom.generateSecureBlindingFactor();
      console.log("🔐 Creating REAL BN254 Pedersen commitment for output...");
      const outputCommitmentResult = await this.zenroom.createPedersenCommitment(
        utxo.value.toString(),
        outputBlinding
      );
      const nullifierHash = await this.zenroom.generateNullifierHash(
        this.currentEOA.address,
        utxo.commitment,
        Date.now().toString()
      );
      const generatorParams = this.getBN254Generators();
      console.log("🚀 Executing transfer contract call...");
      const tx = await this.contract.transferPrivateUTXO(
        utxo.commitment,
        outputCommitmentResult.pedersen_commitment,
        newOwner,
        utxo.value,
        ZenroomHelpers.toBigInt("0x" + outputBlinding),
        nullifierHash,
        generatorParams,
        { gasLimit: this.config.defaultGasLimit }
      );
      const receipt = await tx.wait();
      console.log("✅ Transfer confirmed:", receipt?.hash);
      utxo.isSpent = true;
      this.emit("utxo:spent", utxoId);
      let createdUTXOIds = [];
      if (newOwner === this.currentEOA?.address) {
        const outputId = await this.generateBN254UTXOId(
          outputCommitmentResult.pedersen_commitment,
          newOwner,
          Date.now()
        );
        const outputUTXO = {
          id: outputId,
          exists: true,
          value: utxo.value,
          tokenAddress: utxo.tokenAddress,
          owner: newOwner,
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: outputCommitmentResult.pedersen_commitment,
          parentUTXO: utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: outputBlinding,
          localCreatedAt: Date.now(),
          confirmed: true,
          creationTxHash: receipt?.hash,
          blockNumber: receipt?.blockNumber,
          tokenMetadata: utxo.tokenMetadata,
          cryptographyType: "BN254"
        };
        this.utxos.set(outputId, outputUTXO);
        await this.savePrivateUTXOToLocal(newOwner, outputUTXO);
        createdUTXOIds.push(outputId);
        this.emit("utxo:created", outputUTXO);
      }
      const result = {
        success: true,
        transactionHash: receipt?.hash,
        gasUsed: receipt?.gasUsed,
        createdUTXOIds
      };
      console.log("✅ Private UTXO transfer successful with REAL BN254 cryptography");
      return result;
    } catch (error) {
      console.error("❌ Private UTXO transfer failed:", error);
      const result = {
        success: false,
        error: error instanceof Error ? error.message : "Transfer failed",
        errorDetails: error
      };
      this.emit("operation:failed", new UTXOOperationError(
        "Transfer failed",
        "transfer",
        params.utxoId,
        error
      ));
      return result;
    }
  }
  // ========================
  // STATE MANAGEMENT
  // ========================
  /**
   * Get UTXOs owned by address
   * @param owner - Owner address (defaults to current EOA)
   * @returns Array of UTXOs
   */
  getUTXOsByOwner(owner) {
    const targetOwner = owner || this.currentEOA?.address;
    if (!targetOwner) {
      throw new Error("No owner specified and no EOA connected");
    }
    return Array.from(this.utxos.values()).filter(
      (utxo) => utxo.owner === targetOwner && !utxo.isSpent
    );
  }
  /**
   * Get total balance by token
   * @param tokenAddress - Token address (optional)
   * @returns Balance by token or total balance
   */
  getBalance(tokenAddress) {
    if (tokenAddress) {
      return Array.from(this.utxos.values()).filter((utxo) => !utxo.isSpent && utxo.tokenAddress === tokenAddress).reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    }
    const balances = {};
    Array.from(this.utxos.values()).filter((utxo) => !utxo.isSpent).forEach((utxo) => {
      balances[utxo.tokenAddress] = (balances[utxo.tokenAddress] || BigInt(0)) + utxo.value;
    });
    return balances;
  }
  /**
   * Get manager statistics with BN254 info
   * @returns UTXO manager stats
   */
  getStats() {
    const allUTXOs = Array.from(this.utxos.values());
    const unspent = allUTXOs.filter((u) => !u.isSpent);
    const spent = allUTXOs.filter((u) => u.isSpent);
    const confirmed = allUTXOs.filter((u) => u.confirmed);
    const bn254UTXOs = allUTXOs.filter((u) => u.cryptographyType === "BN254");
    const balanceByToken = {};
    const creationDistribution = [
      { date: UTXOType.DEPOSIT, count: unspent.filter((u) => u.utxoType === UTXOType.DEPOSIT).length },
      { date: UTXOType.SPLIT, count: unspent.filter((u) => u.utxoType === UTXOType.SPLIT).length },
      { date: UTXOType.COMBINE, count: unspent.filter((u) => u.utxoType === UTXOType.COMBINE).length },
      { date: UTXOType.TRANSFER, count: unspent.filter((u) => u.utxoType === UTXOType.TRANSFER).length }
    ];
    unspent.forEach((utxo) => {
      balanceByToken[utxo.tokenAddress] = (balanceByToken[utxo.tokenAddress] || BigInt(0)) + utxo.value;
    });
    const totalBalance = Object.values(balanceByToken).reduce((sum, bal) => sum + bal, BigInt(0));
    const averageUTXOValue = unspent.length > 0 ? totalBalance / BigInt(unspent.length) : BigInt(0);
    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspent.length,
      spentUTXOs: spent.length,
      confirmedUTXOs: confirmed.length,
      totalBalance,
      balanceByToken,
      averageUTXOValue,
      uniqueTokens: Object.keys(balanceByToken).length,
      creationDistribution,
      privateUTXOs: unspent.length,
      // Add BN254 specific stats
      bn254UTXOs: bn254UTXOs.length,
      bn254Operations: 0,
      cryptographyDistribution: {
        BN254: bn254UTXOs.length,
        Other: allUTXOs.length - bn254UTXOs.length
      }
    };
  }
  /**
   * Sync local state with blockchain - enhanced for BN254 UTXOs
   * @returns Promise resolving to sync success
   */
  async syncWithBlockchain() {
    if (this.syncInProgress || !this.contract || !this.currentEOA) {
      return false;
    }
    this.syncInProgress = true;
    console.log("🔄 Syncing with blockchain (BN254 mode)...");
    try {
      const localUTXOs = await this.getPrivateUTXOsFromLocal(this.currentEOA.address);
      for (const utxo of localUTXOs) {
        if (!this.utxos.has(utxo.id)) {
          this.utxos.set(utxo.id, utxo);
          console.log("📥 Loaded private UTXO from local storage:", utxo.id);
        }
      }
      const unconfirmedUTXOs = Array.from(this.utxos.values()).filter(
        (utxo) => !utxo.confirmed && utxo.creationTxHash
      );
      for (const utxo of unconfirmedUTXOs) {
        try {
          const receipt = await this.ethereum.getProvider().getTransactionReceipt(utxo.creationTxHash);
          if (receipt && receipt.status === 1) {
            utxo.confirmed = true;
            utxo.blockNumber = receipt.blockNumber;
            await this.savePrivateUTXOToLocal(utxo.owner, utxo);
            this.emit("utxo:confirmed", utxo);
            console.log("✅ UTXO confirmed:", utxo.id);
          }
        } catch (error) {
          console.warn(`Failed to check confirmation for UTXO ${utxo.id}:`, error);
        }
      }
      this.lastSyncTimestamp = Date.now();
      console.log("✅ Blockchain sync completed (BN254 mode)");
      return true;
    } catch (error) {
      console.error("❌ Blockchain sync failed:", error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }
  // ========================
  // HELPER METHODS
  // ========================
  /**
   * Ensure library is initialized
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error("UTXOLibrary not initialized. Call initialize() first.");
    }
    if (!this.contract) {
      console.error("Contract state:", {
        isInitialized: this.isInitialized,
        contractExists: !!this.contract,
        currentAccount: this.currentEOA?.address || "not connected"
      });
      throw new Error("UTXO contract not initialized. Contract address may be invalid or not properly set up. Please check the console for details.");
    }
  }
  /**
   * Get standard BN254 generators for contract calls
   * @returns GeneratorParams with BN254 standard points
   */
  getBN254Generators() {
    return {
      gX: BigInt("0x01"),
      // G1 generator X
      gY: BigInt("0x02"),
      // G1 generator Y
      hX: BigInt("0x2cf44499d5d27bb186308b7af7af02ac5bc9eeb6a3d147c186b21fb1b76e18da"),
      // H1 generator X
      hY: BigInt("0x2c0f001f52110ccfe69108924926e45f0b0c868df0e7bde1fe16d3242dc715f6")
      // H1 generator Y
    };
  }
  /**
   * Generate secure UTXO ID using cryptographic hash
   * @param commitment - UTXO commitment
   * @param owner - Owner address
   * @param timestamp - Creation timestamp
   * @returns Promise<string> - Secure UTXO ID
   */
  async generateBN254UTXOId(commitment, owner, timestamp) {
    const data = commitment + owner.toLowerCase() + timestamp.toString();
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      return Array.from(hashArray, (byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch (error) {
      console.warn("Failed to generate secure ID, using fallback:", error);
      return data.slice(0, 64).padEnd(64, "0");
    }
  }
  /**
   * Save private UTXO to localStorage
   */
  /**
   * Save private UTXO to localStorage (only for BN254 private UTXOs)
   */
  async savePrivateUTXOToLocal(owner, utxo) {
    try {
      if (!utxo.blindingFactor) {
        console.warn("Cannot save UTXO without blinding factor - not a private UTXO");
        return;
      }
      if (utxo.cryptographyType !== "BN254") {
        console.warn("Cannot save non-BN254 UTXO as private UTXO");
        return;
      }
      if (!utxo.commitment) {
        console.warn("Cannot save UTXO without commitment - not a valid private UTXO");
        return;
      }
      const privateUTXO = {
        ...utxo,
        blindingFactor: utxo.blindingFactor,
        // Ya validado que no es undefined
        nullifierHash: utxo.nullifierHash || "",
        // Valor por defecto si no existe
        isPrivate: true,
        cryptographyType: "BN254"
      };
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      console.log("✅ BN254 private UTXO saved to localStorage:", utxo.id);
    } catch (error) {
      console.warn("Failed to save BN254 UTXO to local storage:", error);
    }
  }
  /**
   * Check if UTXO is a valid private UTXO
   */
  isPrivateUTXO(utxo) {
    return !!(utxo.blindingFactor && utxo.cryptographyType === "BN254" && utxo.commitment && utxo.nullifierHash);
  }
  /**
   * Get private UTXOs from localStorage
   */
  async getPrivateUTXOsFromLocal(owner) {
    try {
      const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
      return PrivateUTXOStorage.getPrivateUTXOs(owner);
    } catch (error) {
      console.warn("Failed to load UTXOs from local storage:", error);
      return [];
    }
  }
  /**
   * Map contract UTXO type to local enum
   */
  mapContractUTXOType(contractType) {
    switch (contractType) {
      case 0:
        return UTXOType.DEPOSIT;
      case 1:
        return UTXOType.SPLIT;
      case 2:
        return UTXOType.COMBINE;
      case 3:
        return UTXOType.TRANSFER;
      default:
        return UTXOType.DEPOSIT;
    }
  }
  // ========================
  // PUBLIC GETTERS
  // ========================
  /**
   * Get current EOA data
   */
  get currentAccount() {
    return this.currentEOA;
  }
  /**
   * Get initialization status
   */
  get initialized() {
    return this.isInitialized;
  }
  /**
   * Get configuration
   */
  get configuration() {
    return { ...this.config };
  }
  /**
   * Get contract address
   */
  get contractAddress() {
    return this.contract?.address || null;
  }
  /**
   * Get cryptography type
   */
  get cryptographyType() {
    return "BN254";
  }
  /**
   * Check if Zenroom is available
   */
  get isZenroomAvailable() {
    return ZenroomHelpers.isZenroomAvailable();
  }
}
new UTXOLibrary();
class GasManager {
  networkConfigs = /* @__PURE__ */ new Map();
  constructor() {
    this.networkConfigs.set(80002, {
      // Polygon Amoy
      requiresGas: true,
      defaultGasLimit: BigInt(5e5),
      defaultGasPrice: BigInt(3e10),
      // 30 Gwei
      gasMultiplier: 1.2
      // +20% para operaciones BN254
    });
    this.networkConfigs.set(2020, {
      // Alastria
      requiresGas: false
      // Red sin costes de gas
    });
    this.networkConfigs.set(137, {
      // Polygon Mainnet
      requiresGas: true,
      defaultGasLimit: BigInt(5e5),
      defaultGasPrice: BigInt(5e10),
      // 50 Gwei
      gasMultiplier: 1.5
      // +50% para operaciones complejas
    });
    this.networkConfigs.set(1, {
      // Ethereum Mainnet
      requiresGas: true,
      defaultGasLimit: BigInt(5e5),
      defaultGasPrice: BigInt(2e10),
      // 20 Gwei
      gasMultiplier: 1.3
      // +30% para asegurar procesamiento
    });
  }
  /**
   * Registra una nueva configuración de red
   */
  registerNetwork(chainId, config) {
    this.networkConfigs.set(chainId, config);
    console.log(`⛽ Registered gas config for chain ${chainId}:`, config);
  }
  /**
   * Verifica si una red requiere gas
   */
  requiresGas(chainId) {
    const config = this.networkConfigs.get(chainId);
    return config?.requiresGas ?? true;
  }
  /**
   * Obtiene opciones de gas para una transacción
   */
  async getGasOptions(chainId, provider, operation = "default") {
    const config = this.networkConfigs.get(chainId);
    if (!config?.requiresGas) {
      console.log(`⛽ Chain ${chainId} is gas-free, skipping gas calculations`);
      return null;
    }
    console.log(`⛽ Calculating gas for chain ${chainId}, operation: ${operation}`);
    try {
      const gasOptions = {};
      gasOptions.gasLimit = this.getGasLimitForOperation(operation, config);
      if (provider) {
        const feeData = await provider.getFeeData();
        console.log(`⛽ Current fee data:`, {
          gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "N/A",
          maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A",
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A"
        });
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          gasOptions.maxFeePerGas = this.applyMultiplier(feeData.maxFeePerGas, config.gasMultiplier);
          gasOptions.maxPriorityFeePerGas = this.applyMultiplier(feeData.maxPriorityFeePerGas, config.gasMultiplier);
          console.log(`⛽ Using EIP-1559 pricing with ${config.gasMultiplier}x multiplier`);
        } else if (feeData.gasPrice) {
          gasOptions.gasPrice = this.applyMultiplier(feeData.gasPrice, config.gasMultiplier);
          console.log(`⛽ Using legacy gas pricing with ${config.gasMultiplier}x multiplier`);
        } else {
          gasOptions.gasPrice = config.defaultGasPrice || BigInt(2e10);
          console.log(`⛽ Using default gas price fallback`);
        }
      } else {
        gasOptions.gasPrice = config.defaultGasPrice || BigInt(2e10);
        console.log(`⛽ Using default config (no provider)`);
      }
      console.log(`⛽ Final gas options:`, {
        gasLimit: gasOptions.gasLimit?.toString(),
        gasPrice: gasOptions.gasPrice ? ethers.formatUnits(gasOptions.gasPrice, "gwei") + " gwei" : "N/A",
        maxFeePerGas: gasOptions.maxFeePerGas ? ethers.formatUnits(gasOptions.maxFeePerGas, "gwei") + " gwei" : "N/A",
        maxPriorityFeePerGas: gasOptions.maxPriorityFeePerGas ? ethers.formatUnits(gasOptions.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A"
      });
      return gasOptions;
    } catch (error) {
      console.warn(`⚠️ Failed to get gas options for chain ${chainId}:`, error.message);
      return {
        gasLimit: config.defaultGasLimit || BigInt(5e5),
        gasPrice: config.defaultGasPrice || BigInt(2e10)
      };
    }
  }
  /**
   * Aplica gas options a parámetros de transacción
   */
  async applyGasToTransaction(txParams, chainId, provider, operation = "default") {
    if (!this.requiresGas(chainId)) {
      console.log(`⛽ Chain ${chainId} is gas-free, returning transaction params unchanged`);
      return txParams;
    }
    const gasOptions = await this.getGasOptions(chainId, provider, operation);
    if (gasOptions) {
      return { ...txParams, ...gasOptions };
    }
    return txParams;
  }
  /**
   * Obtiene gas limit apropiado según la operación
   */
  getGasLimitForOperation(operation, config) {
    const baseLimit = config.defaultGasLimit || BigInt(5e5);
    switch (operation) {
      case "deposit":
        return baseLimit;
      // Depósitos son relativamente simples
      case "transfer":
        return baseLimit + BigInt(1e5);
      // Transferencias requieren más gas
      case "split":
        return baseLimit + BigInt(2e5);
      // Split es más complejo
      case "withdraw":
        return baseLimit + BigInt(15e4);
      // Withdraw requiere validaciones extra
      default:
        return baseLimit;
    }
  }
  /**
   * Aplica multiplicador a un valor de gas
   */
  applyMultiplier(gasValue, multiplier) {
    if (!multiplier || multiplier === 1) return gasValue;
    const multiplierBigInt = BigInt(Math.floor(multiplier * 100));
    return gasValue * multiplierBigInt / 100n;
  }
  /**
   * Estima costo de transacción (solo para redes con gas)
   */
  async estimateTransactionCost(chainId, gasLimit, provider) {
    if (!this.requiresGas(chainId)) {
      return null;
    }
    try {
      const gasOptions = await this.getGasOptions(chainId, provider);
      if (!gasOptions) return null;
      const effectiveGasPrice = gasOptions.gasPrice || gasOptions.maxFeePerGas || BigInt(0);
      const cost = gasLimit * effectiveGasPrice;
      return {
        cost,
        costInEth: ethers.formatEther(cost),
        gasPrice: effectiveGasPrice
      };
    } catch (error) {
      console.warn(`⚠️ Failed to estimate transaction cost:`, error.message);
      return null;
    }
  }
  /**
   * Debug: Muestra configuración actual
   */
  debugConfiguration() {
    console.log("⛽ === GAS MANAGER CONFIGURATION ===");
    for (const [chainId, config] of this.networkConfigs.entries()) {
      console.log(`Chain ${chainId}:`, {
        requiresGas: config.requiresGas,
        defaultGasLimit: config.defaultGasLimit?.toString(),
        defaultGasPrice: config.defaultGasPrice ? ethers.formatUnits(config.defaultGasPrice, "gwei") + " gwei" : "N/A",
        gasMultiplier: config.gasMultiplier || 1
      });
    }
  }
}
const gasManager = new GasManager();
class PrivateUTXOManager extends UTXOLibrary {
  // Almacenamiento de UTXOs privados con BN254
  privateUTXOs = /* @__PURE__ */ new Map();
  bn254OperationCount = 0;
  currentChainId = null;
  // Para manejar gas inteligentemente
  constructor(config = {
    // ✅ CAMBIAR TIPO
    autoConsolidate: false,
    consolidationThreshold: 5,
    maxUTXOAge: 7 * 24 * 60 * 60,
    privacyMode: true,
    defaultGasLimit: BigInt(5e5),
    cacheTimeout: 3e4,
    enableBackup: true
  }) {
    super(config);
    console.log("🔐 PrivateUTXOManager initialized with REAL BN254 cryptography only");
  }
  /**
   * Initialize with chain ID detection for smart gas management
   */
  async initialize(contractAddressOrProvider) {
    try {
      const success = await super.initialize(contractAddressOrProvider);
      if (success) {
        try {
          const provider = EthereumHelpers.getProvider();
          if (provider) {
            const network = await provider.getNetwork();
            this.currentChainId = Number(network.chainId);
            console.log(`⛽ Detected chain ID: ${this.currentChainId}`);
            console.log(`⛽ Network requires gas: ${gasManager.requiresGas(this.currentChainId)}`);
            gasManager.debugConfiguration();
          }
        } catch (networkError) {
          console.warn("⚠️ Could not detect chain ID:", networkError.message);
          this.currentChainId = null;
        }
      }
      return success;
    } catch (error) {
      console.error("❌ Failed to initialize PrivateUTXOManager:", error);
      return false;
    }
  }
  /**
   * Helper method to prepare transaction parameters with smart gas management
   */
  async prepareTransactionParams(operation = "default", customGasLimit) {
    try {
      const gasOptions = await gasManager.getGasOptions(
        this.currentChainId || 1,
        // Fallback to Ethereum mainnet
        EthereumHelpers.getProvider(),
        operation
      );
      let txParams = {};
      if (customGasLimit) {
        txParams.gasLimit = customGasLimit;
      }
      if (gasOptions) {
        txParams = { ...txParams, ...gasOptions };
        console.log(`⛽ Transaction parameters for ${operation}:`, {
          gasLimit: customGasLimit?.toString() || "estimated",
          gasPrice: gasOptions.gasPrice ? ethers.formatUnits(gasOptions.gasPrice, "gwei") + " gwei" : "N/A",
          maxFeePerGas: gasOptions.maxFeePerGas ? ethers.formatUnits(gasOptions.maxFeePerGas, "gwei") + " gwei" : "N/A",
          network: `Chain ${this.currentChainId} (gas required)`,
          operation
        });
      } else {
        console.log(`⛽ Gas-free network detected, skipping gas parameters for ${operation}`);
      }
      return txParams;
    } catch (error) {
      console.warn(`⚠️ Failed to prepare transaction params for ${operation}:`, error.message);
      if (gasManager.requiresGas(this.currentChainId || 1)) {
        return {
          gasLimit: customGasLimit || BigInt(5e5),
          gasPrice: BigInt(2e10)
          // 20 Gwei fallback
        };
      }
      return customGasLimit ? { gasLimit: customGasLimit } : {};
    }
  }
  // ========================
  // OPERACIONES PRIVADAS CON CRIPTOGRAFÍA BN254 REAL
  // ========================
  /**
   * Approve token spending for private UTXO operations
   */
  async approveTokenSpending(tokenAddress, amount) {
    const signer = EthereumHelpers.getSigner();
    if (!signer) {
      throw new Error("Signer not available");
    }
    try {
      console.log("🔓 Approving token spending for BN254 operations...");
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        signer
      );
      let tokenDecimals;
      let tokenSymbol;
      try {
        [tokenDecimals, tokenSymbol] = await Promise.all([
          tokenContract.decimals(),
          tokenContract.symbol()
        ]);
      } catch (error) {
        console.warn("Could not get token info, using defaults:", error);
        tokenDecimals = 18;
        tokenSymbol = "TOKEN";
      }
      const currentAllowance = await tokenContract.allowance(
        this.currentAccount?.address,
        this.contract?.target
      );
      console.log("💰 Token approval info:", {
        symbol: tokenSymbol,
        decimals: tokenDecimals,
        currentAllowance: ethers.formatUnits(currentAllowance, tokenDecimals),
        requiredAmount: ethers.formatUnits(amount, tokenDecimals)
      });
      if (currentAllowance < amount) {
        console.log("🔓 Insufficient allowance, approving token spending...");
        const approvalAmount = amount + amount / 100n;
        const gasOptions = await gasManager.getGasOptions(
          this.currentChainId || 1,
          // Fallback a Ethereum mainnet
          EthereumHelpers.getProvider(),
          "default"
        );
        let gasLimit;
        try {
          const estimatedGas = await tokenContract.approve.estimateGas(
            this.contract?.target,
            approvalAmount
          );
          gasLimit = estimatedGas + estimatedGas / 4n;
        } catch (gasError) {
          console.warn("Gas estimation failed, using conservative limit:", gasError);
          gasLimit = BigInt(1e5);
        }
        let txParams = {
          gasLimit
        };
        if (gasOptions) {
          txParams = { ...txParams, ...gasOptions };
          console.log("⛽ Approval transaction parameters:", {
            approvalAmount: ethers.formatUnits(approvalAmount, tokenDecimals),
            gasLimit: gasLimit.toString(),
            gasPrice: gasOptions.gasPrice ? ethers.formatUnits(gasOptions.gasPrice, "gwei") + " gwei" : "N/A",
            maxFeePerGas: gasOptions.maxFeePerGas ? ethers.formatUnits(gasOptions.maxFeePerGas, "gwei") + " gwei" : "N/A",
            network: `Chain ${this.currentChainId} (${gasManager.requiresGas(this.currentChainId || 1) ? "gas required" : "gas-free"})`
          });
        } else {
          console.log("⛽ Gas-free network detected, skipping gas parameters for approval");
        }
        const approveTx = await tokenContract.approve(
          this.contract?.target,
          approvalAmount,
          txParams
        );
        console.log("⏳ Approval transaction sent:", approveTx.hash);
        const approveReceipt = await approveTx.wait();
        console.log("✅ Token approval confirmed:", approveReceipt?.hash);
        const newAllowance = await tokenContract.allowance(
          this.currentAccount?.address,
          this.contract?.target
        );
        console.log("💰 New allowance:", ethers.formatUnits(newAllowance, tokenDecimals), tokenSymbol);
        if (newAllowance < amount) {
          throw new Error(`BN254 approval failed: allowance ${ethers.formatUnits(newAllowance, tokenDecimals)} < required ${ethers.formatUnits(amount, tokenDecimals)}`);
        }
        console.log("⏳ Waiting for BN254-compatible approval to be processed...");
        await new Promise((resolve) => setTimeout(resolve, 3e3));
      } else {
        console.log("✅ Sufficient allowance already exists for BN254 operations");
      }
    } catch (error) {
      console.error("❌ BN254 token approval failed:", error);
      throw new UTXOOperationError(
        "BN254 token approval failed",
        "approveTokenSpending",
        void 0,
        error
      );
    }
  }
  /**
   * Crear UTXO privado usando nueva arquitectura de attestations
   */
  async createPrivateUTXO(params) {
    console.log("🏦 Creating private UTXO with attestation architecture...");
    console.log("📋 Using: Backend autorizado firma attestations que Solidity confía");
    this.bn254OperationCount++;
    try {
      const { amount, tokenAddress, owner } = params;
      if (amount <= 0n) {
        throw new Error("Amount must be greater than zero");
      }
      if (!this.currentAccount?.address) {
        throw new Error("Account not connected");
      }
      console.log("� Nueva arquitectura:", {
        backend: "Autoriza y firma attestations",
        zenroom: "Maneja toda la criptografía",
        solidity: "Solo verifica firmas ECDSA"
      });
      console.log("🔐 Creating deposit with attestation using Zenroom + Backend...");
      const { commitment, attestation } = await ZenroomHelpers.createDepositWithAttestation(
        amount,
        owner,
        tokenAddress
      );
      console.log("✅ Deposit attestation created:", {
        commitmentX: commitment.x.toString(16).slice(0, 10) + "...",
        commitmentY: commitment.y.toString(16).slice(0, 10) + "...",
        attestationNonce: attestation.nonce,
        attestationTimestamp: attestation.timestamp,
        signatureLength: attestation.signature.length
      });
      if (!commitment || !attestation) {
        throw new Error("Failed to create commitment or attestation");
      }
      const utxoId = await this.generateBN254UTXOId(
        commitment.x.toString(16) + commitment.y.toString(16),
        owner,
        Date.now()
      );
      const privateUTXO = {
        id: utxoId,
        exists: true,
        value: amount,
        tokenAddress,
        owner,
        timestamp: toBigInt(Date.now()),
        isSpent: false,
        commitment: "0x" + commitment.x.toString(16).padStart(64, "0") + commitment.y.toString(16).padStart(64, "0"),
        parentUTXO: "",
        utxoType: UTXOType.DEPOSIT,
        blindingFactor: commitment.blindingFactor,
        nullifierHash: attestation.dataHash,
        // Hash de los datos en la attestation
        localCreatedAt: Date.now(),
        confirmed: true,
        // Backend ya autorizó
        isPrivate: true,
        cryptographyType: "BN254"
      };
      this.utxos.set(utxoId, privateUTXO);
      this.privateUTXOs.set(utxoId, privateUTXO);
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(owner, privateUTXO);
      } catch (storageError) {
        console.warn("⚠️ Could not save UTXO to localStorage:", storageError);
      }
      const result = {
        success: true,
        transactionHash: `attestation_${attestation.nonce}`,
        // Usar nonce como referencia
        createdUTXOIds: [utxoId]
      };
      console.log("✅ Private UTXO created with attestation architecture:", utxoId);
      this.emit("private:utxo:created", privateUTXO);
      return result;
    } catch (error) {
      console.error("❌ Private UTXO creation with attestation failed:", error);
      let errorMessage = "Private UTXO creation failed";
      if (error instanceof Error) {
        if (error.message.includes("user rejected")) {
          errorMessage = "Transaction was rejected by user";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient funds for transaction";
        } else {
          errorMessage = error.message;
        }
      }
      return {
        success: false,
        error: errorMessage,
        errorDetails: error
      };
    }
  }
  /**
   * Debug function to test contract interaction before actual deposit
   */
  async debugContractInteraction(params) {
    console.log("🔍 === DEBUG CONTRACT INTERACTION ===");
    if (!this.contract) {
      throw new Error("Contract not initialized");
    }
    try {
      console.log("🌐 Testing network connectivity...");
      try {
        const provider = EthereumHelpers.getProvider();
        const blockNumber = await provider.getBlockNumber();
        const network = await provider.getNetwork();
        console.log("✅ Network info:", {
          chainId: network.chainId.toString(),
          blockNumber: blockNumber.toString(),
          name: network.name
        });
      } catch (networkError) {
        console.error("❌ Network connectivity issue:", networkError);
        throw new Error(`Network connectivity failed: ${networkError instanceof Error ? networkError.message : networkError}`);
      }
      console.log("📞 Testing basic contract calls with retry logic...");
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          const registeredTokensCount = await this.contract.getRegisteredTokenCount();
          console.log("✅ Contract accessible, registered tokens:", registeredTokensCount.toString());
          const isTokenRegistered = await this.contract.isTokenRegistered(params.tokenAddress);
          console.log("🔍 Token registration status:", isTokenRegistered);
          const nullifierHash = await ZenroomHelpers.generateNullifierHash(
            "test_commitment",
            params.owner,
            Date.now().toString()
          );
          const isNullifierUsed = await this.contract.isNullifierUsed(nullifierHash);
          console.log("🔍 Nullifier status (should be false):", isNullifierUsed);
          break;
        } catch (contractError) {
          retryCount++;
          console.warn(`⚠️ Contract call attempt ${retryCount}/${maxRetries} failed:`, contractError?.message || contractError);
          if (retryCount >= maxRetries) {
            if (contractError?.message?.includes("missing trie node") || contractError?.code === -32603) {
              throw new Error(`Network node synchronization issue. Please try again in a few moments or switch to a different RPC endpoint. Error: ${contractError.message}`);
            }
            if (contractError?.code === "CALL_EXCEPTION" && contractError?.message?.includes("missing revert data")) {
              throw new Error(`Contract call failed - contract may not be properly deployed at ${this.contract?.target}. Error: ${contractError.message}`);
            }
            throw new Error(`Contract interaction failed after ${maxRetries} attempts: ${contractError?.message || contractError}`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1e3 * retryCount));
        }
      }
      console.log("✅ Basic contract interaction tests passed");
    } catch (error) {
      console.error("❌ Contract interaction test failed:", error);
      throw new Error(`Contract interaction test failed: ${error instanceof Error ? error.message : error}`);
    }
  }
  /**
   * Transferir UTXO privado usando arquitectura de attestations
   */
  async transferPrivateUTXO(params) {
    console.log("� Transferring private UTXO with attestation architecture...");
    this.bn254OperationCount++;
    try {
      const { utxoId, newOwner } = params;
      const utxo = this.privateUTXOs.get(utxoId);
      if (!utxo || !utxo.isPrivate || utxo.cryptographyType !== "BN254") {
        throw new Error("UTXO is not a BN254 private UTXO or does not exist");
      }
      if (utxo.isSpent) {
        throw new Error("UTXO is already spent");
      }
      const inputCommitment = {
        x: BigInt("0x" + utxo.commitment.substring(2, 66)),
        // primeros 64 chars
        y: BigInt("0x" + utxo.commitment.substring(66, 130)),
        // siguientes 64 chars
        blindingFactor: utxo.blindingFactor,
        value: utxo.value
      };
      console.log("🔐 Creating transfer with attestation using Zenroom + Backend...");
      const { outputCommitment, attestation } = await ZenroomHelpers.createTransferWithAttestation(
        inputCommitment,
        utxo.value,
        // outputValue
        newOwner,
        // outputRecipient  
        utxo.owner
        // sender
      );
      console.log("✅ Transfer attestation created:", {
        outputCommitmentX: outputCommitment.x.toString(16).slice(0, 10) + "...",
        outputCommitmentY: outputCommitment.y.toString(16).slice(0, 10) + "...",
        attestationNonce: attestation.nonce,
        newOwner: newOwner.slice(0, 10) + "..."
      });
      utxo.isSpent = true;
      let createdUTXOIds = [];
      if (newOwner === this.currentAccount?.address) {
        const newUtxoId = await this.generateBN254UTXOId(
          outputCommitment.x.toString(16) + outputCommitment.y.toString(16),
          newOwner,
          Date.now()
        );
        const newPrivateUTXO = {
          id: newUtxoId,
          exists: true,
          value: utxo.value,
          tokenAddress: utxo.tokenAddress,
          owner: newOwner,
          timestamp: toBigInt(Date.now()),
          isSpent: false,
          commitment: "0x" + outputCommitment.x.toString(16).padStart(64, "0") + outputCommitment.y.toString(16).padStart(64, "0"),
          parentUTXO: utxoId,
          utxoType: UTXOType.TRANSFER,
          blindingFactor: outputCommitment.blindingFactor,
          nullifierHash: attestation.dataHash,
          localCreatedAt: Date.now(),
          confirmed: true,
          isPrivate: true,
          cryptographyType: "BN254"
        };
        this.utxos.set(newUtxoId, newPrivateUTXO);
        this.privateUTXOs.set(newUtxoId, newPrivateUTXO);
        createdUTXOIds.push(newUtxoId);
        try {
          const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
          PrivateUTXOStorage.savePrivateUTXO(newOwner, newPrivateUTXO);
        } catch (storageError) {
          console.warn("⚠️ Could not save new UTXO to localStorage:", storageError);
        }
        this.emit("private:utxo:created", newPrivateUTXO);
      }
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      } catch (storageError) {
        console.warn("⚠️ Could not update original UTXO in localStorage:", storageError);
      }
      this.emit("private:utxo:spent", utxoId);
      const result = {
        success: true,
        transactionHash: `attestation_${attestation.nonce}`,
        createdUTXOIds
      };
      console.log("✅ Private UTXO transferred with attestation architecture");
      this.emit("private:utxo:transferred", { from: utxoId, to: createdUTXOIds[0], newOwner });
      return result;
    } catch (error) {
      console.error("❌ Private UTXO transfer with attestation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private transfer failed",
        errorDetails: error
      };
    }
  }
  /**
   * Dividir UTXO privado usando arquitectura de attestations
   */
  async splitPrivateUTXO(params) {
    console.log("✂️ Splitting private UTXO with attestation architecture...");
    this.bn254OperationCount++;
    try {
      const { inputUTXOId, outputValues, outputOwners } = params;
      const inputUTXO = this.privateUTXOs.get(inputUTXOId);
      if (!inputUTXO || !inputUTXO.isPrivate || inputUTXO.cryptographyType !== "BN254") {
        throw new Error("Input UTXO is not a BN254 private UTXO or does not exist");
      }
      if (inputUTXO.isSpent) {
        throw new Error("Input UTXO is already spent");
      }
      const totalOutput = outputValues.reduce((sum, val) => sum + val, BigInt(0));
      if (totalOutput !== inputUTXO.value) {
        throw new Error(`Value conservation failed: input=${inputUTXO.value}, outputs=${totalOutput}`);
      }
      console.log("✅ Value conservation validated:", {
        inputValue: inputUTXO.value.toString(),
        outputSum: totalOutput.toString(),
        outputCount: outputValues.length
      });
      const inputCommitment = {
        x: BigInt("0x" + inputUTXO.commitment.substring(2, 66)),
        // primeros 64 chars
        y: BigInt("0x" + inputUTXO.commitment.substring(66, 130)),
        // siguientes 64 chars
        blindingFactor: inputUTXO.blindingFactor,
        value: inputUTXO.value
      };
      console.log("� Creating split with attestation using Zenroom + Backend...");
      const { outputCommitments, attestation } = await ZenroomHelpers.createSplitWithAttestation(
        inputCommitment,
        outputValues,
        outputOwners,
        inputUTXO.owner
      );
      console.log("✅ Split attestation created:", {
        outputCount: outputCommitments.length,
        attestationNonce: attestation.nonce,
        totalOutputValue: totalOutput.toString()
      });
      inputUTXO.isSpent = true;
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(inputUTXO.owner, inputUTXO);
      } catch (storageError) {
        console.warn("⚠️ Could not update input UTXO in localStorage:", storageError);
      }
      this.emit("private:utxo:spent", inputUTXOId);
      const createdUTXOIds = [];
      for (let i = 0; i < outputValues.length; i++) {
        if (outputOwners[i] === this.currentAccount?.address) {
          const outputUtxoId = await this.generateBN254UTXOId(
            outputCommitments[i].x.toString(16) + outputCommitments[i].y.toString(16),
            outputOwners[i],
            Date.now() + i
          );
          const outputPrivateUTXO = {
            id: outputUtxoId,
            exists: true,
            value: outputValues[i],
            tokenAddress: inputUTXO.tokenAddress,
            owner: outputOwners[i],
            timestamp: toBigInt(Date.now()),
            isSpent: false,
            commitment: "0x" + outputCommitments[i].x.toString(16).padStart(64, "0") + outputCommitments[i].y.toString(16).padStart(64, "0"),
            parentUTXO: inputUTXOId,
            utxoType: UTXOType.SPLIT,
            blindingFactor: outputCommitments[i].blindingFactor,
            nullifierHash: attestation.dataHash + i.toString(),
            // Unique nullifier per output
            localCreatedAt: Date.now(),
            confirmed: true,
            isPrivate: true,
            cryptographyType: "BN254"
          };
          this.utxos.set(outputUtxoId, outputPrivateUTXO);
          this.privateUTXOs.set(outputUtxoId, outputPrivateUTXO);
          createdUTXOIds.push(outputUtxoId);
          try {
            const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
            PrivateUTXOStorage.savePrivateUTXO(outputOwners[i], outputPrivateUTXO);
          } catch (storageError) {
            console.warn(`⚠️ Could not save output UTXO ${i} to localStorage:`, storageError);
          }
          this.emit("private:utxo:created", outputPrivateUTXO);
        }
      }
      const result = {
        success: true,
        transactionHash: `attestation_${attestation.nonce}`,
        createdUTXOIds
      };
      console.log("✅ Private UTXO split with attestation architecture completed");
      this.emit("private:utxo:split", { input: inputUTXOId, outputs: createdUTXOIds });
      return result;
    } catch (error) {
      console.error("❌ Private UTXO split with attestation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private split failed",
        errorDetails: error
      };
    }
  }
  /**
   * Retirar UTXO privado usando arquitectura de attestations
   */
  async withdrawPrivateUTXO(params) {
    console.log("💸 Withdrawing private UTXO with attestation architecture...");
    this.bn254OperationCount++;
    try {
      const { utxoId, recipient } = params;
      const utxo = this.privateUTXOs.get(utxoId);
      if (!utxo || !utxo.isPrivate || utxo.cryptographyType !== "BN254") {
        throw new Error("UTXO is not a BN254 private UTXO or does not exist");
      }
      if (utxo.isSpent) {
        throw new Error("UTXO is already spent");
      }
      if (utxo.owner.toLowerCase() !== this.currentAccount.address.toLowerCase()) {
        throw new Error("Not authorized to withdraw this UTXO");
      }
      const commitment = {
        x: BigInt("0x" + utxo.commitment.substring(2, 66)),
        // primeros 64 chars
        y: BigInt("0x" + utxo.commitment.substring(66, 130)),
        // siguientes 64 chars
        blindingFactor: utxo.blindingFactor,
        value: utxo.value
      };
      console.log("🔐 Creating withdrawal with attestation using Zenroom + Backend...");
      const { attestation } = await ZenroomHelpers.createWithdrawWithAttestation(
        commitment,
        recipient || utxo.owner,
        utxo.owner
      );
      console.log("✅ Withdrawal attestation created:", {
        attestationNonce: attestation.nonce,
        value: utxo.value.toString(),
        recipient: recipient || utxo.owner
      });
      utxo.isSpent = true;
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        PrivateUTXOStorage.savePrivateUTXO(utxo.owner, utxo);
      } catch (storageError) {
        console.warn("⚠️ Could not update UTXO in localStorage:", storageError);
      }
      this.emit("private:utxo:withdrawn", utxoId);
      const result = {
        success: true,
        transactionHash: `attestation_${attestation.nonce}`
      };
      console.log("✅ Private UTXO withdrawal with attestation architecture completed");
      return result;
    } catch (error) {
      console.error("❌ Private UTXO withdrawal with attestation failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Private withdrawal failed",
        errorDetails: error
      };
    }
  }
  // ========================
  // FUNCIONES AUXILIARES Y ESTADÍSTICAS - SOLO BN254
  // ========================
  /**
   * Obtener UTXOs privados BN254 por propietario
   */
  getPrivateUTXOsByOwner(owner) {
    const utxos = [];
    for (const [utxoId, utxo] of this.privateUTXOs.entries()) {
      if (utxo.owner.toLowerCase() === owner.toLowerCase() && !utxo.isSpent && utxo.cryptographyType === "BN254") {
        utxos.push(utxo);
      }
    }
    return utxos;
  }
  /**
   * Obtener balance privado BN254 total
   */
  getPrivateBalance(tokenAddress) {
    let balance = BigInt(0);
    for (const utxo of this.privateUTXOs.values()) {
      if (!utxo.isSpent && utxo.cryptographyType === "BN254" && (!tokenAddress || utxo.tokenAddress === tokenAddress)) {
        balance += utxo.value;
      }
    }
    return balance;
  }
  /**
   * Obtener estadísticas de UTXOs BN254
   */
  getUTXOStats() {
    const allUTXOs = Array.from(this.privateUTXOs.values());
    const bn254UTXOs = allUTXOs.filter((utxo) => utxo.cryptographyType === "BN254");
    const unspentUTXOs = bn254UTXOs.filter((utxo) => !utxo.isSpent);
    const spentUTXOs = bn254UTXOs.filter((utxo) => utxo.isSpent);
    const confirmedUTXOs = bn254UTXOs.filter((utxo) => utxo.confirmed);
    const uniqueTokens = new Set(unspentUTXOs.map((utxo) => utxo.tokenAddress)).size;
    const totalBalance = unspentUTXOs.reduce((sum, utxo) => sum + utxo.value, BigInt(0));
    const balanceByToken = {};
    unspentUTXOs.forEach((utxo) => {
      if (!balanceByToken[utxo.tokenAddress]) {
        balanceByToken[utxo.tokenAddress] = BigInt(0);
      }
      balanceByToken[utxo.tokenAddress] += utxo.value;
    });
    const averageUTXOValue = unspentUTXOs.length > 0 ? totalBalance / BigInt(unspentUTXOs.length) : BigInt(0);
    const creationDistribution = [];
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1e3;
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now - i * oneDayMs);
      const dateStr = date.toISOString().split("T")[0];
      const dayStart = date.setHours(0, 0, 0, 0);
      const dayEnd = date.setHours(23, 59, 59, 999);
      const count = bn254UTXOs.filter((utxo) => {
        const utxoDate = utxo.localCreatedAt || 0;
        return utxoDate >= dayStart && utxoDate <= dayEnd;
      }).length;
      creationDistribution.push({ date: dateStr, count });
    }
    return {
      totalUTXOs: allUTXOs.length,
      unspentUTXOs: unspentUTXOs.length,
      uniqueTokens,
      totalBalance,
      privateUTXOs: bn254UTXOs.filter((utxo) => utxo.isPrivate).length,
      spentUTXOs: spentUTXOs.length,
      confirmedUTXOs: confirmedUTXOs.length,
      balanceByToken,
      averageUTXOValue,
      creationDistribution,
      bn254UTXOs: bn254UTXOs.length,
      bn254Operations: this.bn254OperationCount,
      cryptographyDistribution: {
        BN254: bn254UTXOs.length,
        Other: allUTXOs.length - bn254UTXOs.length
      }
    };
  }
  /**
   * Sincronizar con blockchain (solo datos públicos + localStorage para BN254 privacy)
   */
  async syncWithBlockchain() {
    if (!this.contract || !this.currentAccount) {
      return false;
    }
    console.log("🔄 Syncing BN254 data with blockchain and localStorage...");
    try {
      const userUTXOCount = await this.contract.getUserUTXOCount(this.currentAccount.address);
      console.log(`📊 User has ${userUTXOCount} UTXOs in contract (BN254 mode)`);
      try {
        const { PrivateUTXOStorage } = await import("../../chunks/PrivateUTXOStorage.js");
        const localUTXOs = PrivateUTXOStorage.getPrivateUTXOs(this.currentAccount.address);
        const bn254UTXOs = localUTXOs.filter(
          (utxo) => utxo.cryptographyType === "BN254" || utxo.isPrivate
          // Backwards compatibility
        );
        console.log(`💾 Found ${bn254UTXOs.length} BN254 private UTXOs in localStorage`);
        this.privateUTXOs.clear();
        for (const utxo of bn254UTXOs) {
          const bn254UTXO = {
            ...utxo,
            cryptographyType: "BN254",
            isPrivate: true
          };
          this.privateUTXOs.set(utxo.id, bn254UTXO);
        }
        let verifiedCount = 0;
        let corruptedCount = 0;
        for (const utxo of this.privateUTXOs.values()) {
          if (!utxo.isSpent && utxo.blindingFactor) {
            try {
              const isValid = await ZenroomHelpers.verifyPedersenCommitment(
                utxo.commitment,
                BigInt(utxo.value),
                ZenroomHelpers.toBigInt("0x" + utxo.blindingFactor)
              );
              if (isValid) {
                verifiedCount++;
              } else {
                corruptedCount++;
                console.warn("⚠️ Corrupted BN254 commitment detected:", utxo.id);
              }
            } catch (verifyError) {
              corruptedCount++;
              console.warn("⚠️ Could not verify BN254 commitment:", utxo.id, verifyError);
            }
          }
        }
        const stats = this.getUTXOStats();
        console.log("📈 BN254 UTXO statistics:");
        console.log(`  - Total BN254 UTXOs: ${stats.totalUTXOs}`);
        console.log(`  - Unspent BN254 UTXOs: ${stats.unspentUTXOs}`);
        console.log(`  - Verified commitments: ${verifiedCount}`);
        console.log(`  - Corrupted commitments: ${corruptedCount}`);
        console.log(`  - Unique tokens: ${stats.uniqueTokens}`);
        console.log(`  - Total BN254 balance: ${stats.totalBalance.toString()}`);
        console.log(`  - BN254 operations: ${stats.bn254Operations}`);
        console.log("✅ BN254 privacy-preserving sync completed");
        this.emit("blockchain:synced", {
          localUTXOs: Array.from(this.utxos.values()).length,
          privateUTXOs: Array.from(this.privateUTXOs.values()).length,
          bn254UTXOs: stats.cryptographyDistribution.BN254,
          contractUTXOCount: Number(userUTXOCount),
          localStats: stats,
          syncMode: "BN254-localStorage+contract",
          verifiedCommitments: verifiedCount,
          corruptedCommitments: corruptedCount
        });
        return true;
      } catch (storageError) {
        console.warn("⚠️ Could not load BN254 UTXOs from localStorage:", storageError);
        return false;
      }
    } catch (error) {
      console.error("❌ BN254 sync failed:", error);
      this.emit("blockchain:sync:failed", error);
      return false;
    }
  }
  /**
   * Limpiar datos privados BN254 (para seguridad)
   */
  clearPrivateData() {
    this.privateUTXOs.clear();
    this.bn254OperationCount = 0;
    console.log("🧹 BN254 private data cleared");
  }
  // ========================
  // HELPER METHODS BN254
  // ========================
  /**
   * Obtener generadores BN254 estándar
   */
  getBN254StandardGenerators() {
    return {
      // G1 generator - punto generador estándar de BN254
      gX: BigInt("0x1"),
      // Coordenada X del generador G1 estándar
      gY: BigInt("0x2"),
      // Coordenada Y del generador G1 estándar
      // H generator - segundo punto generador independiente para Pedersen commitments
      // SOLUCIÓN REAL: Coordenadas exactas de 3*G en BN254 (matemáticamente calculadas y verificadas)
      // COORDENADAS CORREGIDAS - MATEMÁTICAMENTE VERIFICADAS
      hX: BigInt("0x769bf9ac56bea3ff40232bcb1b6bd159315d84715b8e679f2d355961915abf0"),
      // H1 X - 3*G CORREGIDO
      hY: BigInt("0x2ab799bee0489429554fdb7c8d086475319e63b40b9c5b57cdf1ff3dd9fe2261")
      // H1 Y - 3*G CORREGIDO
    };
  }
  /**
   * Verificar si un UTXO usa BN254
   */
  isUTXOBN254(utxoId) {
    const utxo = this.privateUTXOs.get(utxoId);
    return utxo?.cryptographyType === "BN254" || false;
  }
  /**
   * Obtener tipo de criptografía
   */
  get cryptographyType() {
    return "BN254";
  }
  /**
   * Obtener conteo de operaciones BN254
   */
  get bn254OperationsCount() {
    return this.bn254OperationCount;
  }
  /**
   * Obtener información de BN254
   */
  getBN254Info() {
    const bn254UTXOs = Array.from(this.privateUTXOs.values()).filter(
      (utxo) => utxo.cryptographyType === "BN254"
    );
    return {
      operationsCount: this.bn254OperationCount,
      utxosCount: bn254UTXOs.length,
      verifiedCommitments: bn254UTXOs.filter((utxo) => !utxo.isSpent).length
    };
  }
  /**
   * Exponenciación modular para cálculos BN254
   */
  modularExponentiation(base, exp, modulus) {
    let result = 1n;
    base = base % modulus;
    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = result * base % modulus;
      }
      exp = exp >> 1n;
      base = base * base % modulus;
    }
    return result;
  }
}
const privateUTXOManager = new PrivateUTXOManager();
function WalletConnection($$payload, $$props) {
  push();
  let utxoManager = $$props["utxoManager"];
  let currentAccount = fallback($$props["currentAccount"], null);
  let isInitialized = fallback($$props["isInitialized"], false);
  let isConnecting = false;
  let isDisconnecting = false;
  const provider = {
    type: WalletProviderType.METAMASK,
    icon: "🦊"
  };
  function formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  function getNetworkDisplayName(chainId) {
    switch (Number(chainId)) {
      case 1:
        return "Ethereum";
      case 137:
        return "Polygon";
      case 80002:
        return "Polygon Amoy";
      case 11155111:
        return "Sepolia";
      default:
        return `Chain ${chainId}`;
    }
  }
  if (!currentAccount) {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="flex flex-col items-end space-y-2"><button${attr("disabled", isConnecting, true)} class="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">`;
    {
      $$payload.out += "<!--[!-->";
      $$payload.out += `<span>${escape_html(provider.icon)}</span> <span>Connect MetaMask</span>`;
    }
    $$payload.out += `<!--]--></button> <div class="text-xs text-gray-400 text-right"><div>Polygon Amoy Network</div> <div>Alastria Network</div> <div class="text-yellow-400 mt-1">`;
    if (typeof window !== "undefined" && !window.ethereum) {
      $$payload.out += "<!--[-->";
      $$payload.out += `⚠️ MetaMask not installed`;
    } else if (typeof window !== "undefined" && window.ethereum && !window.ethereum.isMetaMask) {
      $$payload.out += "<!--[1-->";
      $$payload.out += `⚠️ Please unlock MetaMask`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div></div></div>`;
  } else {
    $$payload.out += "<!--[!-->";
    $$payload.out += `<div class="flex items-center space-x-4"><div class="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20"><div class="flex items-center space-x-3"><div class="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center"><span class="text-white text-sm font-bold">`;
    if (currentAccount.providerType === WalletProviderType.METAMASK) {
      $$payload.out += "<!--[-->";
      $$payload.out += `🦊`;
    } else if (currentAccount.providerType === WalletProviderType.WALLET_CONNECT) {
      $$payload.out += "<!--[1-->";
      $$payload.out += `🔗`;
    } else if (currentAccount.providerType === WalletProviderType.COINBASE_WALLET) {
      $$payload.out += "<!--[2-->";
      $$payload.out += `💙`;
    } else {
      $$payload.out += "<!--[!-->";
      $$payload.out += `🌐`;
    }
    $$payload.out += `<!--]--></span></div> <div class="text-sm"><div class="text-white font-medium">${escape_html(formatAddress(currentAccount.address))}</div> <div class="text-gray-300 text-xs">${escape_html(getNetworkDisplayName(currentAccount.chainId))} `;
    if (currentAccount.ethBalance !== void 0) {
      $$payload.out += "<!--[-->";
      $$payload.out += `• ${escape_html((Number(currentAccount.ethBalance) / 1e18).toFixed(4))} ETH`;
    } else {
      $$payload.out += "<!--[!-->";
    }
    $$payload.out += `<!--]--></div></div></div></div> <div class="flex items-center space-x-2"><button class="p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200" title="Refresh data"><span class="text-lg">🔄</span></button> <div class="relative"><button${attr("disabled", isDisconnecting, true)} class="bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 hover:border-red-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2">`;
    {
      $$payload.out += "<!--[!-->";
      $$payload.out += `<span>🔌</span> <span>Disconnect</span>`;
    }
    $$payload.out += `<!--]--></button></div></div></div>`;
  }
  $$payload.out += `<!--]-->`;
  bind_props($$props, { utxoManager, currentAccount, isInitialized });
  pop();
}
function _page($$payload, $$props) {
  push();
  let isInitialized = false;
  let currentAccount = null;
  let notifications = [];
  let isWalletConnected = false;
  WalletProviderType.METAMASK;
  if (typeof window !== "undefined") {
    window.debugUTXOStorage = () => {
      {
        console.warn("No account connected. Connect wallet first.");
      }
    };
  }
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>UTXO Manager - Privacy-First Token Management</title>`;
    $$payload2.out += `<meta name="description" content="Manage ERC20 tokens with privacy using UTXOs and Zenroom cryptography" class="svelte-18s9rmc"/>`;
  });
  $$payload.out += `<div class="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 svelte-18s9rmc">`;
  if (notifications.length > 0) {
    $$payload.out += "<!--[-->";
    const each_array = ensure_array_like(notifications);
    $$payload.out += `<div class="fixed top-4 right-4 z-50 space-y-2 svelte-18s9rmc"><!--[-->`;
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let notification = each_array[$$index];
      $$payload.out += `<div${attr_class("p-4 rounded-lg shadow-lg max-w-sm animate-slide-in svelte-18s9rmc", void 0, {
        "bg-green-600": notification.type === "success",
        "bg-red-600": notification.type === "error",
        "bg-blue-600": notification.type === "info",
        "bg-yellow-600": notification.type === "warning"
      })}><div class="flex items-center justify-between text-white svelte-18s9rmc"><span class="text-sm svelte-18s9rmc">${escape_html(notification.message)}</span> <button class="ml-2 text-white hover:text-gray-200 svelte-18s9rmc">✕</button></div></div>`;
    }
    $$payload.out += `<!--]--></div>`;
  } else {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> <header class="bg-black/20 backdrop-blur-sm border-b border-white/10 svelte-18s9rmc"><div class="container mx-auto px-4 py-6 svelte-18s9rmc"><div class="flex items-center justify-between svelte-18s9rmc"><div class="flex items-center space-x-4 svelte-18s9rmc"><div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center svelte-18s9rmc"><span class="text-white font-bold text-xl svelte-18s9rmc">U</span></div> <div class="svelte-18s9rmc"><h1 class="text-2xl font-bold text-white svelte-18s9rmc">UTXO Manager</h1> <p class="text-gray-300 text-sm svelte-18s9rmc">Privacy-First Token Management</p></div></div> <div class="flex items-center space-x-4 svelte-18s9rmc">`;
  {
    $$payload.out += "<!--[!-->";
  }
  $$payload.out += `<!--]--> `;
  WalletConnection($$payload, {
    utxoManager: privateUTXOManager,
    currentAccount,
    isInitialized
  });
  $$payload.out += `<!----></div></div></div></header> <main class="container mx-auto px-4 py-8 svelte-18s9rmc">`;
  {
    $$payload.out += "<!--[-->";
    $$payload.out += `<div class="text-center py-12 svelte-18s9rmc"><div class="max-w-4xl mx-auto svelte-18s9rmc"><h2 class="text-4xl font-bold text-white mb-6 svelte-18s9rmc">Setup Your UTXO Wallet</h2> <p class="text-xl text-gray-300 mb-12 svelte-18s9rmc">Follow these 3 simple steps to start using privacy-preserving UTXOs</p> <div class="flex justify-center items-center mb-12 space-x-4 svelte-18s9rmc"><div class="flex flex-col items-center space-y-2 svelte-18s9rmc"><div${attr_class(
      `w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${stringify("bg-blue-500")}`,
      "svelte-18s9rmc"
    )}>${escape_html("1")}</div> <span${attr_class(`text-sm ${stringify("text-white")}`, "svelte-18s9rmc")}>Connect Wallet</span></div> <div${attr_class(`w-8 h-0.5 ${stringify("bg-gray-600")}`, "svelte-18s9rmc")}></div> <div class="flex flex-col items-center space-y-2 svelte-18s9rmc"><div${attr_class(
      `w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${stringify("bg-gray-600")}`,
      "svelte-18s9rmc"
    )}>${escape_html("2")}</div> <span${attr_class(`text-sm ${stringify("text-gray-400")}`, "svelte-18s9rmc")}>Select Network</span></div> <div${attr_class(`w-8 h-0.5 ${stringify("bg-gray-600")}`, "svelte-18s9rmc")}></div> <div class="flex flex-col items-center space-y-2 svelte-18s9rmc"><div${attr_class(
      `w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${stringify("bg-gray-600")}`,
      "svelte-18s9rmc"
    )}>${escape_html("3")}</div> <span${attr_class(`text-sm ${stringify("text-gray-400")}`, "svelte-18s9rmc")}>Initialize Library</span></div></div> <div class="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 max-w-2xl mx-auto svelte-18s9rmc">`;
    {
      $$payload.out += "<!--[-->";
      $$payload.out += `<div class="text-center svelte-18s9rmc"><div class="text-6xl mb-6 svelte-18s9rmc">🔌</div> <h3 class="text-2xl font-bold text-white mb-4 svelte-18s9rmc">Step 1: Connect Your Wallet</h3> <p class="text-gray-300 mb-8 svelte-18s9rmc">Connect MetaMask or another compatible wallet to get started</p> <button class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl svelte-18s9rmc"${attr("disabled", isWalletConnected, true)}>${escape_html("🔌 Connect Wallet")}</button> `;
      {
        $$payload.out += "<!--[!-->";
      }
      $$payload.out += `<!--]--></div>`;
    }
    $$payload.out += `<!--]--> <div class="mt-8 pt-6 border-t border-white/10 svelte-18s9rmc"><button class="text-gray-400 hover:text-white text-sm transition-colors duration-200 svelte-18s9rmc">🔄 Reset Flow</button></div></div></div></div>`;
  }
  $$payload.out += `<!--]--></main></div>`;
  pop();
}
export {
  _page as default
};
