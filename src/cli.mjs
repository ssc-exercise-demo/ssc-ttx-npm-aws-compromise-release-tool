#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const source = resolve(process.argv[2] || "");
const output = resolve(process.argv[3] || "");
if (!process.argv[2] || !process.argv[3])
  throw new Error("usage: release-tool <repository> <build-context>");
if (
  !output.startsWith(`${process.cwd()}${sep}`) ||
  output !== resolve(process.cwd(), ".release-build") ||
  source === output
)
  throw new Error("build context must be the workspace .release-build path");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of [
  "package.json",
  "package-lock.json",
  "apps/api",
  "apps/web/package.json",
  "apps/web/dist",
  "packages/shared",
]) {
  await cp(resolve(source, path), resolve(output, path), { recursive: true });
}

async function contextDigest(root) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else files.push(path);
    }
  }
  await walk(root);
  const hash = createHash("sha256");
  for (const path of files.sort()) {
    hash.update(relative(root, path));
    hash.update("\0");
    hash.update(await readFile(path));
  }
  return hash.digest("hex");
}

const digest = await contextDigest(output);
await writeFile(
  resolve(output, ".release-manifest.json"),
  `${JSON.stringify({ sourceCommit: process.env.GITHUB_SHA, digest })}\n`,
);
process.stdout.write(`${JSON.stringify({ ok: true, output, digest })}\n`);
