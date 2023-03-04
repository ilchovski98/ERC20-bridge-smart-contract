// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract WERC20 is ERC20PresetMinterPauser {
  mapping(address => uint256) private nonces;

  // EIP712
  bytes32 public DOMAIN_SEPARATOR;
  // keccak256("PermitTransferFrom(address owner,address spender,uint256 amount,uint256 nonce,uint256 deadline)")
  bytes32 public constant PERMIT_TYPEHASH = 0xdc278f4e77e6f658ea562d0e3def6941312028c19a2b807ab422e211758c69e9;

  constructor(string memory _name, string memory _symbol) ERC20PresetMinterPauser(_name, _symbol) {
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes(_name)),
      keccak256(bytes("1")),
      block.chainid,
      address(this)
    ));
  }

  function permitTransferFrom(
    address owner,
    address spender,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(deadline >= block.timestamp, "ERC20WithPermit: EXPIRED_SIGNATURE");

    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          PERMIT_TYPEHASH,
          owner,
          spender,
          amount,
          nonces[owner]++,
          deadline
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, v, r, s);

    require(
      recoveredAddress != address(0) && recoveredAddress == owner,
      "ERC20WithPermit: INVALID_SIGNATURE"
    );

    _approve(owner, spender, amount);
    transferFrom(owner, spender, amount);
  }

  function getNonce(address _address) external view returns(uint) {
    return nonces[_address];
  }
}
