import fs from "fs";
import path from "path";

export const getContractAbi = (filePath: string) => {
  try {
    const dir = path.resolve(
      __dirname,
      filePath
    );
    const file = fs.readFileSync(dir, "utf8");
    const json = JSON.parse(file);
    const abi = json.abi;

    return abi;
  } catch (error) {
    console.log('error', error);
  }
};

export const lazyImport = async (module: any) => {
  return await import(module);
};
