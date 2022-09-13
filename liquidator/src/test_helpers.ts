import { readFileSync} from "fs";

export async function sleep(timeout: number) {
    await new Promise((resolve) => setTimeout(resolve, timeout))
  }
  
// Reads json containing contract addresses located in /artifacts folder for specified network.
export function readAddresses() {
  try {
    const data = readFileSync(
      `addresses.json`,
      "utf8"
    );
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}