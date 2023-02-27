// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBridgeFactory {
  function deposit(uint amount, address erc20) external;
  function claim(uint amount, address erc20) external;
}
