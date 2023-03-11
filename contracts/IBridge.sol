// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBridge {
  struct OriginalToken {
    address tokenAddress;
    uint256 originChainId;
  }

  struct User {
    address _address;
    uint256 chainId;
  }

  struct DepositData {
    User from;
    User to;
    address spender;
    address token;
    uint256 value;
    uint256 deadline;
    Signature approveTokenTransferSig;
  }

  struct ClaimData {
    User from;
    User to;
    uint256 value;
    OriginalToken token; // used to indicate which is the original ERC20 (info that must be stored on all bridges)
    address depositTxSourceToken; // the deposited token address that triggered the transfer (WERC20/ERC20)
    address targetTokenAddress; // if the operator populates this address then the token will be released else it indicates that the claimed token is a wrapped one
    string targetTokenName; // provided by operator to name new wrapped token
    string targetTokenSymbol; // provided by operator to name new wrapped token
    uint256 deadline; // provided by operator in case we want to have a deadline (most of the times there will be none)
  }

  struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  event LockOriginalToken(
    address indexed lockedTokenAddress,
    uint256 value,
    address indexed sender,
    address indexed recepient,
    uint256 sourceChainId,
    uint256 toChainId
  );

  event BurnWrappedToken(
    address burnedWrappedTokenAddress,
    uint256 value,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address originalTokenAddress,
    uint256 originalTokenChainId
  );

  event ReleaseOriginalToken(
    address releasedTokenAddress,
    uint256 value,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address sourceWrappedTokenAddress
  );

  event MintWrappedToken(
    address mintedTokenAddress,
    uint256 value,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address originalTokenAddress,
    uint256 originalChainId
  );

  function deposit(DepositData calldata _depositData) external;

  function depositWithPermit(DepositData calldata _depositData) external;

  function claim(ClaimData calldata _claimData, Signature calldata claimSig) external;
}
