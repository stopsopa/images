import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

interface TargetInfo {
  dir: string;
  file: string;
  abs: string;
}

/**
 * node libs/determineTarget.ts
 */
export default function determineTarget(inputPath: string): TargetInfo {
  // Replace 'raw' directory with 'img'
  // Assuming inputPath starts with 'raw/' or contains '/raw/'
  let targetPath = inputPath.replace(/^raw\//, "img/");

  const parsed = path.parse(targetPath);
  const dir = parsed.dir;
  const name = parsed.name;
  const ext = ".webp";

  let counter = 0;
  let finalFile = `${name}${ext}`;
  let abs = path.join(dir, finalFile);

  while (fs.existsSync(abs)) {
    counter++;
    finalFile = `${name}_${counter}${ext}`;
    abs = path.join(dir, finalFile);
  }

  return {
    dir,
    file: finalFile,
    abs,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const testPath = process.argv[2];
  if (!testPath) {
    throw new Error("Missing path argument. Usage: node libs/determineTarget.ts <path>");
  }
  console.log(`Input: ${testPath}`);
  console.log(determineTarget(testPath));
}