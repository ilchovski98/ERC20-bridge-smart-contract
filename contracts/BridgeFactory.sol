// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./WERC20.sol";
contract BridgeFactory is Ownable {
  // Deposit function
  // Send token transfer
  event LockOriginalToken(
    address lockedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 destinationChainId
  );

  // Deposit function
  // Send Wrapped token transfer
  event BurnWrappedToken(
    address burnedWrappedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address destinationTokenAddress
  );

  // Claim function
  // Receive Wrapped token transfer
  event ReleaseOriginalToken(
    address releasedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 fromChainId,
    uint256 toChainId,
    address sourceWrappedTokenAddress
  );

  // Claim function
  // Receive original token transfer
  event MintWrappedToken(
    address mintedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 fromChainId,
    uint256 toChainId,
    address sourceTokenAddress
  );

  struct OriginalToken {
		address tokenAddress;
		uint256 originChainId;
	}

  mapping(uint256 => mapping(address => address)) public wrappedTokenByOriginalTokenByChainId; // chainId => original token => wrapped token address
  mapping(address => OriginalToken) public originalTokenByWrappedToken; // wrapped token => original token

  // EIP712
  bytes32 public DOMAIN_SEPARATOR;
  // keccak256("DepositWithPermit(address tokenOwner,address spender,address token,uint256 amount,uint256 deadline,address recepientOnDestinationChain,uint256 destinationChainId, uint256 nonce)")
  bytes32 public constant DEPOSIT_WITH_PERMIT_TYPEHASH = 0xd4abd86c44f2eaecd99d949aa27fcaee6fe75ad6bc9d7ebb6c5f2ae5568e8a62;

  // keccak256("Claim(address tokenOwner,address recepient,address originalTokenAddress,string originalTokenName,string originalTokenSymbol,uint256 amount,uint256 sourceChainId,uint256 destinationChainId,bytes32 transactionHash,uint256 nonce)")
  bytes32 public constant CLAIM_TYPEHASH = 0xd565985c36462af230a0275c7851ff732d62cb7b1b65300d64e728a97edcf33a;

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

  // Deposit			Claim
  // Lock/Burn		Release/Mint


  // On deposit1 if no data about coin lock
  // On claim1 if event data says erc20 is deposited create wrapped and store data about wrapped coin
  // On deposit2 if data about coin, burn and send data that it is wrapped coin
  // On claim2 if event data says wrapped, release the stored coins

  // function deposit() external {} // no permit
  function depositWithPermit(
    address tokenOwner,
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
          tokenOwner,
          spender,
          token,
          amount,
          deadline,
          recepientOnDestinationChain,
          destinationChainId,
          nonces[tokenOwner]++
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, v, r, s);

    require(
      recoveredAddress != address(0) && recoveredAddress == tokenOwner,
      "BridgeDepositWithPermit: INVALID_SIGNATURE"
    );

    // approve
    // token != address(0) check or no need?
    IERC20 originalToken = IERC20(token);
    // TODO: replace approve and transferFrom with permitTransferFrom
    originalToken.approve(spender, amount);
    // transfer tokens
    originalToken.transferFrom(tokenOwner, spender, amount);

    // check if token is wrapped check with originalTokenByWrappedToken
    // check if token is being sent to the correct chain with originalTokenByWrappedToken
    bool isWrappedToken = originalTokenByWrappedToken[token].tokenAddress != address(0);

    if (isWrappedToken) {
      require(originalTokenByWrappedToken[token].originChainId == destinationChainId, "This token cannot be sent to this destination chain");
      WERC20(token).burn(amount);
      emit BurnWrappedToken(token, amount, tokenOwner, recepientOnDestinationChain, block.chainid, destinationChainId, originalTokenByWrappedToken[token].tokenAddress);
    } else {
      // Emit event
      emit LockOriginalToken(token, amount, tokenOwner, recepientOnDestinationChain, block.chainid, destinationChainId);
    }

  }

  function claim(
    address tokenOwner,
    address recepient,
    address originalTokenAddress,
    address targetTokenAddress,
    string calldata originalTokenName, // string or bytes32?
    string calldata originalTokenSymbol,
    uint256 amount,
    uint256 sourceChainId,
    uint256 destinationChainId,
    bool isClaimabledTokenWrapped,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    // validate signature
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          CLAIM_TYPEHASH,
          tokenOwner,
          recepient,
          originalTokenAddress,
          originalTokenName,
          originalTokenSymbol,
          amount,
          sourceChainId,
          destinationChainId,
          transactionHash,
          nonces[tokenOwner]++
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, v, r, s);

    require(
      recoveredAddress != address(0) && recoveredAddress == owner,
      "BridgeClaim: INVALID_SIGNATURE"
    );

    // Deposit			Claim
    // Lock/Burn		Release/Mint || deploy/no-deploy

    // On deposit1 if no data about coin lock
    // On claim1 if event data says erc20 is deposited create wrapped and store data about wrapped coin
    // On deposit2 if data about coin, burn and send data that it is wrapped coin
    // On claim2 if event data says wrapped, release the stored coins

    if (targetTokenAddress == address(0)) {
      // if claimable wrapped token has data use the already deployed contract
      // if not deploy the contract and use it
      if (wrappedTokenByOriginalTokenByChainId[sourceChainId][originalTokenAddress] == address(0)) {
        WERC20 newWrappedToken = new WERC20(string.concat("Wrapped ", originalTokenName), string.concat("W", originalTokenSymbol));
        wrappedTokenByOriginalTokenByChainId[sourceChainId][originalTokenAddress] = address(newWrappedToken);
        originalTokenByWrappedToken[address(newWrappedToken)] = OriginalToken(originalTokenAddress, fromChainId);
      }
      // Mint the tokens to the destination address
      WERC20(wrappedTokenByOriginalTokenByChainId[sourceChainId][originalTokenAddress]).mint(amount, recepient);

      // Emit event
      emit MintWrappedToken(
        wrappedTokenByOriginalTokenByChainId[sourceChainId][originalTokenAddress],
        amount,
        tokenOwner,
        recepient,
        sourceChainId,
        destinationChainId,
        originalTokenAddress
      );
    } else {
      // Original token
      // transfer original token to recepient
      // the bridge needs to approve
      IERC20(targetTokenAddress).permitTransferFrom(recepient);
      // Emit event
      emit ReleaseOriginalToken(
        targetTokenAddress,
        amount,
        tokenOwner,
        recepient,
        sourceChainId,
        destinationChainId,
        originalTokenAddress
      );
    }
  }

  function createNewWrappedToken(address erc20) internal {

  }
}
