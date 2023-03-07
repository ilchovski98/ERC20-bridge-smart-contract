import fs from "fs";
import path from "path";

const getContractAbi = (filePath: string) => {
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

export default getContractAbi;
