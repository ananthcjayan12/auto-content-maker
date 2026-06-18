import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const configPath = "wrangler.jsonc";
const d1Name = process.env.D1_DATABASE_NAME?.trim() || "daily-poster-packet-db";
const requestedD1Id = process.env.D1_DATABASE_ID?.trim();
const r2BucketName =
  process.env.R2_BUCKET_NAME?.trim() || "daily-poster-packet-assets";

function wrangler(args, options = {}) {
  return execFileSync("npx", ["wrangler", ...args], {
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: process.env,
  });
}

function wranglerJson(args) {
  const output = wrangler([...args, "--json"], { capture: true });
  return JSON.parse(output);
}

function resourceList(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.result)) return value.result;
  if (Array.isArray(value?.databases)) return value.databases;
  if (Array.isArray(value?.buckets)) return value.buckets;
  return [];
}

function resourceId(value) {
  return value?.uuid || value?.id || value?.database_id || value?.databaseId;
}

function resourceName(value) {
  return value?.name || value?.database_name || value?.bucket_name;
}

function findD1Database(databases) {
  if (requestedD1Id) {
    const byId = databases.find(
      (database) => resourceId(database) === requestedD1Id,
    );
    if (byId) return byId;
    console.warn(
      "The configured D1 database ID was not found; falling back to database name.",
    );
  }
  return databases.find((database) => resourceName(database) === d1Name);
}

function ensureD1Database() {
  let databases = resourceList(wranglerJson(["d1", "list"]));
  let database = findD1Database(databases);

  if (!database) {
    console.log(`Creating D1 database "${d1Name}"...`);
    wrangler(["d1", "create", d1Name, "--location", "apac"]);
    databases = resourceList(wranglerJson(["d1", "list"]));
    database = databases.find(
      (candidate) => resourceName(candidate) === d1Name,
    );
  }

  const id = resourceId(database);
  if (!id) {
    throw new Error(`Could not resolve the D1 database ID for "${d1Name}".`);
  }

  console.log(`Using D1 database "${d1Name}" (${id}).`);
  return id;
}

function ensureR2Bucket() {
  try {
    wranglerJson(["r2", "bucket", "info", r2BucketName]);
    console.log(`Using existing R2 bucket "${r2BucketName}".`);
  } catch {
    console.log(`Creating R2 bucket "${r2BucketName}"...`);
    wrangler(["r2", "bucket", "create", r2BucketName, "--location", "apac"]);
    wranglerJson(["r2", "bucket", "info", r2BucketName]);
  }
}

function updateWranglerConfig(d1Id) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const database = config.d1_databases?.find(
    (binding) => binding.binding === "DB",
  );
  if (!database) {
    throw new Error('wrangler.jsonc must contain a D1 binding named "DB".');
  }

  database.database_name = d1Name;
  database.database_id = d1Id;
  config.r2_buckets = [
    {
      binding: "ASSETS",
      bucket_name: r2BucketName,
    },
  ];
  config.vars = {
    ...config.vars,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    BUSINESS_TIMEZONE: process.env.BUSINESS_TIMEZONE?.trim() || "Asia/Kolkata",
    R2_BUCKET_NAME: r2BucketName,
    ...(process.env.R2_PUBLIC_BASE_URL?.trim()
      ? { R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL.trim() }
      : {}),
  };

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

const d1Id = ensureD1Database();
ensureR2Bucket();
updateWranglerConfig(d1Id);
console.log("Cloudflare D1 and R2 resources are ready.");
