import * as fs from "node:fs/promises";
import { v7 as uuidv7 } from "uuid";
import { resolve } from "pathe";

const r = (value:string) : string => {
  return resolve(import.meta.dirname,"../..",value)
}

export async function writeBuildid2(dir: string, buildid2: string) {
  const path_buildid2 = `${dir}/buildid2`;
  await fs.writeFile(path_buildid2, buildid2);
}

export async function genBuildid2() {
  try {
    await fs.access("_dist");
  } catch {
    await fs.mkdir("_dist");
  }
  await writeBuildid2(r("./_dist"), uuidv7());
}
