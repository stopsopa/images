import { exec } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

const execAsync = promisify(exec);

/**
 * node libs/search.ts
 */
export default async function search(): Promise<string[]> {
  try {
    const { stdout } = await execAsync("/bin/bash libs/search.sh");

    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error: any) {
    throw new Error(
      `Failed to execute search.sh: ${error.stderr || error.message}`,
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  search().then(console.log).catch(console.error);
}
