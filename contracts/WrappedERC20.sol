// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./PermitERC20.sol";

contract WrappedERC20 is PermitERC20 {
  constructor(string memory _name, string memory _symbol, address owner) PermitERC20(_name, _symbol) {
    _setupRole(DEFAULT_ADMIN_ROLE, owner);
    _setupRole(MINTER_ROLE, owner);
    _setupRole(PAUSER_ROLE, owner);
  }
}
