import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import fs from "fs";
import path from "path";

import { Bridge, PermitERC20 } from "./../typechain-types";
import { IBridge } from "./../typechain-types/contracts/IBridge";

export const getContractAbi = (filePath: string) => {
  try {
    const dir = path.resolve(
      __dirname,
      filePath
    )
    const file = fs.readFileSync(dir, "utf8")
    const json = JSON.parse(file)
    const abi = json.abi

    return abi
  } catch (e) {
    console.log(`e`, e)
  }
}

export const permit = async (
  token: PermitERC20,
  account: SignerWithAddress,
  owner: string,
  spender: string,
  value: number | string,
  deadline: number | string
) => {
  const nonce = await token.nonces(owner);

  const domain = {
    name: await token.name(),
    version: '1',
    chainId: hre.network.config.chainId,
    verifyingContract: token.address
  };

  const Permit = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ];

  const message = {
    owner: owner,
    spender: spender,
    value: value,
    nonce: nonce.toHexString(),
    deadline
  };

  const signatureLike = await account._signTypedData(domain, { Permit }, message);
  const signature = ethers.utils.splitSignature(signatureLike);

  return signature;
};

export const signClaimData = async (bridge: Bridge, signer: SignerWithAddress, claimData: IBridge.ClaimDataStruct) => {
  const domain = {
    name: await bridge.name(),
    version: '1',
    chainId: hre.network.config.chainId,
    verifyingContract: bridge.address
  };

  const types = {
    User: [
      { name: '_address', type: 'address' },
      { name: 'chainId', type: 'uint256' }
    ],
    ClaimData: [
      { name: 'from', type: 'User' },
      { name: 'to', type: 'User' },
      { name: 'value', type: 'uint256' },
      { name: 'originalToken', type: 'address' },
      { name: 'targetTokenAddress', type: 'address' },
      { name: 'originalTokenName', type: 'string' },
      { name: 'originalTokenSymbol', type: 'string' },
      { name: 'deadline', type: 'uint256' }
    ],
    Claim: [
      { name: '_claimData', type: 'ClaimData' },
      { name: 'nonce', type: 'uint256' }
    ]
  };

  const nonce = (await bridge.nonce(claimData.from._address)).toHexString();

  const value = {
    _claimData: claimData,
    nonce: nonce
  };

  const signatureLike = await signer._signTypedData(domain, types, value);
  const signature = ethers.utils.splitSignature(signatureLike);

  return signature;
};

export const lazyImport = async (module: any) => {
  return await import(module);
};
