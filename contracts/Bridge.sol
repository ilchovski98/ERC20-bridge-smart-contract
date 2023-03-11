// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./WrappedERC20.sol";
import "./IBridge.sol";

contract Bridge is Ownable, Pausable, ReentrancyGuard, IBridge {
  string private _name;
  mapping(uint256 => mapping(address => address)) public wrappedTokenByOriginalTokenByChainId; // chainId => original token => wrapped token address
  mapping(address => OriginalToken) public originalTokenByWrappedToken; // wrapped token => original token
  mapping(address => uint256) private nonces;

  // EIP712
  bytes32 public DOMAIN_SEPARATOR;
  // keccak256("Claim(ClaimData _claimData,uint256 nonce)ClaimData(User from,User to,uint256 value,OriginalToken token,address depositTxSourceToken,address targetTokenAddress,string targetTokenName,string targetTokenSymbol,uint256 deadline)OriginalToken(address tokenAddress,uint256 originChainId)User(address _address,uint256 chainId)");
  bytes32 public constant CLAIM_TYPEHASH = 0x92f0142b6bb6777332444e4f035b692e77419f18a5ee2cd84f10c07c47e1474f;
  // keccak256("ClaimData(User from,User to,uint256 value,OriginalToken token,address depositTxSourceToken,address targetTokenAddress,string targetTokenName,string targetTokenSymbol,uint256 deadline)OriginalToken(address tokenAddress,uint256 originChainId)User(address _address,uint256 chainId)");
  bytes32 public constant CLAIMDATA_TYPEHASH = 0xe896384c688095ca54bad7d2e7b660c741bd270344665ff5a1e334e0e0c9f2df;
  // keccak256("User(address _address,uint256 chainId)")
  bytes32 public constant USER_TYPEHASH = 0x265b4089f698d180c71c21e5c5a755d17cec5ca245cab57cf1f26696020008b6;
  // keccak256("OriginalToken(address tokenAddress,uint256 originChainId)");
  bytes32 public constant ORIGINAL_TOKEN_TYPEHASH = 0xa24126880bed04190203d04ec4d6365915e96e5977ee3b881ec3cfafa2b71c49;
  // keccak256("Signature(uint8 v,bytes32 r,bytes32 s)")
  bytes32 public constant SIGNATURE_TYPEHASH = 0xcea59b5eccb60256d918b7a2e778f6161148c37e6dada57c32e20db10c50b631;

  error InvalidAddress();
  error InvalidChainId();
  error InvalidTokenAmount();
  error IncorrectDestinationChain();
  error DestinationChainCantBeCurrentChain();
  error CurrentAndProvidedChainsDoNotMatch();
  error AddressIsNotTheOwner();
  error TransferFromIsUnsuccessful();
  error TransferIsUnsuccessful();

  modifier validateTransfer(address from, address to, address originalToken, uint256 value) {
    if (from == address(0)) revert InvalidAddress();
    if (to == address(0)) revert InvalidAddress();
    if (originalToken == address(0)) revert InvalidAddress();
    if (value == 0) revert InvalidTokenAmount();
    _;
  }

  modifier validateDeposit(address spender, uint256 destinationChainId) {
    if (spender == address(0)) revert InvalidAddress();
    if (destinationChainId == 0) revert InvalidChainId();
    _;
  }

  constructor(string memory contractName) {
    _pause();
    _name = contractName;
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes(contractName)),
      keccak256(bytes("1")),
      block.chainid,
      address(this)
    ));
  }

  function nonce(address _owner) external view returns (uint256) {
    return nonces[_owner];
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  function deposit(DepositData calldata _depositData)
    external
    whenNotPaused
    nonReentrant
    validateTransfer(
      _depositData.from._address,
      _depositData.to._address,
      _depositData.token,
      _depositData.value
    )
    validateDeposit(
      _depositData.spender,
      _depositData.to.chainId
    )
  {
    _deposit(_depositData);
  }

  function depositWithPermit(DepositData calldata _depositData)
    external
    whenNotPaused
    nonReentrant
    validateTransfer(
      _depositData.from._address,
      _depositData.to._address,
      _depositData.token,
      _depositData.value
    )
    validateDeposit(
      _depositData.spender,
      _depositData.to.chainId
    )
  {
    IERC20Permit originalToken = IERC20Permit(_depositData.token);
    originalToken.permit(
      _depositData.from._address,
      _depositData.spender,
      _depositData.value,
      _depositData.deadline,
      _depositData.approveTokenTransferSig.v,
      _depositData.approveTokenTransferSig.r,
      _depositData.approveTokenTransferSig.s
    );
    _deposit(_depositData);
  }

  function claim(ClaimData calldata _claimData, Signature calldata claimSig)
    external
    whenNotPaused
    nonReentrant
    validateTransfer(
      _claimData.from._address,
      _claimData.to._address,
      _claimData.token.tokenAddress,
      _claimData.value
    )
  {
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          CLAIM_TYPEHASH,
          hash(_claimData),
          nonces[_claimData.from._address]++
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, claimSig.v, claimSig.r, claimSig.s);

    if (recoveredAddress == address(0)) revert InvalidAddress();
    if (recoveredAddress != owner()) revert AddressIsNotTheOwner();

    _claim(_claimData);
  }

  function name() public view returns (string memory) {
    return _name;
  }

  function hash(User calldata user) internal pure returns (bytes32) {
    return keccak256(abi.encode(
      USER_TYPEHASH,
      user._address,
      user.chainId
    ));
  }

  function hash(OriginalToken calldata token) internal pure returns (bytes32) {
    return keccak256(abi.encode(
      ORIGINAL_TOKEN_TYPEHASH,
      token.tokenAddress,
      token.originChainId
    ));
  }

  function hash(ClaimData calldata _claimData) internal pure returns (bytes32) {
    return keccak256(abi.encode(
      CLAIMDATA_TYPEHASH,
      hash(_claimData.from),
      hash(_claimData.to),
      _claimData.value,
      hash(_claimData.token),
      _claimData.depositTxSourceToken,
      _claimData.targetTokenAddress,
      keccak256(bytes(_claimData.targetTokenName)),
      keccak256(bytes(_claimData.targetTokenSymbol)),
      _claimData.deadline
    ));
  }

  function _deposit(DepositData calldata _depositData) internal {
    IERC20 originalToken = IERC20(_depositData.token);
    bool success = originalToken.transferFrom(msg.sender, _depositData.spender, _depositData.value);
    if (!success) revert TransferFromIsUnsuccessful();

    OriginalToken memory originalTokenData = originalTokenByWrappedToken[_depositData.token];
    bool isWrappedToken = originalTokenData.tokenAddress != address(0);

    if (isWrappedToken) {
      if (block.chainid != _depositData.to.chainId) revert DestinationChainCantBeCurrentChain();
      WrappedERC20(_depositData.token).burn(_depositData.value);
      emitBurnWrappedToken(_depositData, originalTokenData.tokenAddress, originalTokenData.originChainId);
    } else {
      emitLockOriginalToken(_depositData);
    }
  }

  function _claim(ClaimData calldata _claimData) internal {
    if (_claimData.from.chainId == 0) revert InvalidChainId();
    if (_claimData.to.chainId != block.chainid) revert CurrentAndProvidedChainsDoNotMatch();

    if (_claimData.targetTokenAddress == address(0)) {
      if (wrappedTokenByOriginalTokenByChainId[_claimData.token.originChainId][_claimData.token.tokenAddress] == address(0)) {
        WrappedERC20 newWrappedToken = new WrappedERC20(_claimData.targetTokenName, _claimData.targetTokenSymbol, address(this));

        wrappedTokenByOriginalTokenByChainId[_claimData.token.originChainId][_claimData.token.tokenAddress] = address(newWrappedToken);
        originalTokenByWrappedToken[address(newWrappedToken)] = OriginalToken(
          _claimData.token.tokenAddress,
          _claimData.token.originChainId
        );
      }

      address wrappedToken = wrappedTokenByOriginalTokenByChainId[_claimData.token.originChainId][_claimData.token.tokenAddress];
      WrappedERC20(wrappedToken).mint(_claimData.to._address, _claimData.value);

      emitMintWrappedToken(_claimData, wrappedToken);
    } else {
      IERC20 originalToken = IERC20(_claimData.targetTokenAddress);
      bool success = originalToken.transfer(_claimData.to._address, _claimData.value);
      if (!success) revert TransferIsUnsuccessful();

      emitReleaseOriginalToken(_claimData);
    }
  }

  function emitReleaseOriginalToken(ClaimData calldata _claimData) internal {
    emit ReleaseOriginalToken(
      _claimData.targetTokenAddress,
      _claimData.value,
      _claimData.from._address,
      _claimData.to._address,
      _claimData.from.chainId,
      _claimData.to.chainId,
      _claimData.depositTxSourceToken
    );
  }

  function emitMintWrappedToken(ClaimData calldata _claimData, address correspondingWrappedToken) internal {
    emit MintWrappedToken(
        correspondingWrappedToken,
        _claimData.value,
        _claimData.from._address,
        _claimData.to._address,
        _claimData.from.chainId,
        _claimData.to.chainId,
        _claimData.token.tokenAddress,
        _claimData.token.originChainId
    );
  }

  function emitBurnWrappedToken(DepositData calldata _depositData, address originalTokenAddress, uint256 originalTokenChainId) internal {
    emit BurnWrappedToken(
      _depositData.token,
      _depositData.value,
      _depositData.from._address,
      _depositData.to._address,
      block.chainid,
      _depositData.to.chainId,
      originalTokenAddress,
      originalTokenChainId
    );
  }

  function emitLockOriginalToken(DepositData calldata _depositData) internal {
    emit LockOriginalToken(
      _depositData.token,
      _depositData.value,
      _depositData.from._address,
      _depositData.to._address,
      block.chainid,
      _depositData.to.chainId
    );
  }
}
