import { readFile } from "node:fs/promises";

const mode = process.argv[2] ?? "deploy";
const configPath = new URL("../wrangler.api.jsonc", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

const databaseId = config.d1_databases?.[0]?.database_id;
const placeholder = "00000000-0000-0000-0000-000000000000";

if (!databaseId || databaseId === placeholder) {
  console.error(
    "sasanoha CMS API is not provisioned: replace the placeholder D1 database_id in wrangler.api.jsonc.",
  );
  process.exit(1);
}

if (
  mode === "deploy"
  && process.env.SASANOHA_ACCESS_CONFIRMED !== "1"
) {
  console.error(
    "sasanoha CMS API deploy is blocked until Cloudflare Access for preview.sasanoha.dev is confirmed. Set SASANOHA_ACCESS_CONFIRMED=1 only after the Access application/policy is active.",
  );
  process.exit(1);
}
