// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./WERC20.sol";
contract BridgeFactory {
  event CrossTransfer(
    address originalTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 fromChainId,
    uint256 toChainId
  );

  event AcceptCrossTransfer(
    address originalTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 fromChainId,
    uint256 toChainId
  );

  struct OriginalToken {
		address tokenAddress;
		uint256 originChainId;
	}

  mapping(bytes32 => bool) public areTokensClaimedByTransactionHash;
  mapping(uint256 => mapping(address => address)) public wrappedTokenByOriginalTokenByChainId; // chainId => original token => wrapped token address
  mapping(address => OriginalToken) public originalTokenByWrappedToken; // wrapped token => original token


  // EIP712
  bytes32 public DOMAIN_SEPARATOR;
  // keccak256("DepositWithPermit(address owner,address spender,address token,uint256 amount,uint256 deadline,address recepientOnDestinationChain,uint256 destinationChainId, uint256 nonce)")
  bytes32 public constant DEPOSIT_WITH_PERMIT_TYPEHASH = 0xd4abd86c44f2eaecd99d949aa27fcaee6fe75ad6bc9d7ebb6c5f2ae5568e8a62;
  mapping(address => uint256) private nonces;

  constructor() {
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes('Bridge')),
      keccak256(bytes("1")),
      block.chainid,
      address(this)
    ));
  }

  // function deposit() external {} // no permit
  function depositWithPermit(
    address owner,
    address spender,
    address token,
    uint256 amount,
    uint256 deadline,
    address recepientOnDestinationChain,
    uint256 destinationChainId,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(deadline >= now, "BridgeDepositWithPermit: EXPIRED_SIGNATURE");

    // validate signature for approval ERC20
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          DEPOSIT_WITH_PERMIT_TYPEHASH,
          owner,
          spender,
          token,
          amount,
          deadline,
          recepientOnDestinationChain,
          destinationChainId,
          nonces[owner]++
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, v, r, s);

    require(
      recoveredAddress != address(0) && recoveredAddress == owner,
      "BridgeDepositWithPermit: INVALID_SIGNATURE"
    );

    // approve
    // token != address(0) check or no need?
    IERC20 originalToken = IERC20(token);
    originalToken.approve(spender, amount);

    // transfer tokens
    // Risk of reentrancy?
    originalToken.transferFrom(owner, spender, amount);

    // if WERC20 tokens burn them
    // Make this check sooner so we dont do double casting IERC20 and WERC20? Is it expensive to cast?
    if (wrappedTokenByOriginalTokenByChainId[block.chainid][token] != address(0)) {
      WERC20(token).burn(amount);
    }

    // Emit event
    emit CrossTransfer(token, amount, owner, recepientOnDestinationChain, block.chainid, destinationChainId);
  }

  function claim(
    address originalTokenAddress,
    string memory originalTokenName,
    string memory originalTokenSymbol,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 destinationChainId,
    bytes32 transactionHash,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {

    // validate signature

    // if Wrapped erc20 doesnt exist create new WERC20 contract
    if (wrappedTokenByOriginalTokenByChainId[fromChainId][originalTokenAddress] == address(0)) { // originalTokenByWrappedToken[newWrappedToken.address]
      WERC20 newWrappedToken = new WERC20(string.concat("Wrapped ", originalTokenName), string.concat("W ", originalTokenSymbol));
      originalTokenByWrappedToken[address(newWrappedToken)] = OriginalToken(originalTokenAddress, fromChainId);
    }

    // Mint the tokens to the msg.sender address

    // Emit event
  }

  function createNewWrappedToken(address erc20) internal {

  }
}
