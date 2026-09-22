const publicBase = (process.env.SASANOHA_PUBLIC_URL ?? "https://sasanoha.dev").replace(/\/$/, "");
const previewBase = (process.env.SASANOHA_PREVIEW_URL ?? "https://preview.sasanoha.dev").replace(/\/$/, "");

const accessId = process.env.CF_ACCESS_CLIENT_ID;
const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET;
const allowUnauthenticatedPreview = process.env.SASANOHA_ALLOW_UNAUTHENTICATED_PREVIEW_SMOKE === "1";

if ((accessId && !accessSecret) || (!accessId && accessSecret)) {
  throw new Error("CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET must be provided together.");
}

const accessHeaders = accessId && accessSecret
  ? {
      "CF-Access-Client-Id": accessId,
      "CF-Access-Client-Secret": accessSecret,
    }
  : undefined;

async function expectStatus(label, url, expected, options = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: options.headers,
  });

  if (!expected.includes(response.status)) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${label}: expected ${expected.join("/")} but received ${response.status} from ${url}\n${body.slice(0, 300)}`,
    );
  }

  if (options.expectJsonOk) {
    const payload = await response.json();
    if (payload?.ok !== true) {
      throw new Error(`${label}: expected { ok: true } from ${url}`);
    }
  }

  console.log(`PASS ${label} -> ${response.status}`);
}

await expectStatus(
  "public preview path is hidden",
  `${publicBase}/preview/`,
  [404],
);

await expectStatus(
  "public admin API is hidden",
  `${publicBase}/admin/api/health`,
  [404],
);

if (!accessHeaders && !allowUnauthenticatedPreview) {
  console.log(
    "SKIP preview-host checks: provide CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET, or set SASANOHA_ALLOW_UNAUTHENTICATED_PREVIEW_SMOKE=1 before Access is enabled.",
  );
  process.exit(0);
}

await expectStatus(
  "preview shell is reachable",
  `${previewBase}/`,
  [200],
  { headers: accessHeaders },
);

await expectStatus(
  "preview CMS API health is reachable through Service Binding",
  `${previewBase}/admin/api/health`,
  [200],
  { headers: accessHeaders, expectJsonOk: true },
);
