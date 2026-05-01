import fs from "node:fs";
import search from "./libs/search.ts";
import sharp from "sharp";
import Semaphore from "./libs/Semaphore.ts";

/**
 * NODE_OPTIONS="" node process.ts | tee process.json
 */
async function main() {
  let hasError = false;
  try {
    const images = await search();
    const semaphore = new Semaphore(3);

    const tasks = images.map(async (imgPath) => {
      await semaphore.acquire();
      try {
        const stats = fs.statSync(imgPath);
        const metadata = await sharp(imgPath).metadata();

        const row = [
          imgPath,
          stats.size,
          metadata.width || 0,
          metadata.height || 0,
          (stats.birthtime || stats.mtime || new Date()).toISOString(),
        ];

        process.stdout.write(JSON.stringify(row) + "\n");
      } catch (err: any) {
        console.error(`Error processing ${imgPath}: ${err.message}`);
        hasError = true;
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(tasks);

    if (hasError) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
