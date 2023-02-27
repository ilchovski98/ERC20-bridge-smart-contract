// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./IBridgeFactory.sol";

contract BridgeFactory is IBridgeFactory {
  function deposit(uint amount, address erc20) external {
    // approve
    // transfer tokens
    // if native tokens lock them
    // else if WERC20 tokens burn them
    // Emit event
  }

  function claim(uint amount, address erc20) external {
    // if erc20 doesnt exist create new WERC20 contract
    // Mint the tokens to the msg.sender address
    // Emit event
  }
}
