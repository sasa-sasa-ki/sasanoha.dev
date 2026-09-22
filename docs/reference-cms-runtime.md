# sasanoha.dev reference CMS runtime

この文書は、sasanohaCMSを実案件へ導入する前に `sasanoha.dev` で検証するCloudflare runtime構成を説明します。

会話ログを読まなくても、どのWorker・Cloudflare service・binding・routeが何を担当するか追えることを目的にしています。

## 全体構成

```text
Browser
  |
  | public
  v
sasanoha.dev
  |
  +-- sasanoha-dev-reference
  |     Cloudflare Worker + Static Assets
  |     Astro / Vue / SCSS
  |     public site
  |
  +-- /admin/api/*
        sasanoha-dev-cms-api
        Cloudflare Worker
        no Static Assets
        Cloudflare Access required
        |
        +-- CMS_DB
              Cloudflare D1
              sasanoha-dev-cms


Browser
  |
  | Cloudflare Access
  v
preview.sasanoha.dev
  |
  +-- sasanoha-dev-reference
  |     PREVIEW_ENABLED=true の時だけpreview assetを返す
  |
  +-- /admin/api/*
        sasanoha-dev-cms-api
        Access identity -> ctx.access
        |
        +-- CMS_DB
```

## 使用するCloudflare service

### 1. `sasanoha-dev-reference` Worker

設定: `wrangler.jsonc`

責務:

- `sasanoha.dev` の公開静的サイトを配信する。
- Astro build結果 `dist/` をStatic Assetsとして配信する。
- `preview.sasanoha.dev` では通常indexではなく `/preview/` assetへroutingする。
- public hostnameから内部 `/preview/` pathへ直接到達するrequestは404にする。
- `PREVIEW_ENABLED !== "true"` の間、preview hostname自体を404にしてfail-closedにする。

このWorkerにはD1をbindingしません。content write権限も持たせません。

Cloudflare Static Assets付きWorkerではAccessの `ctx.access` がuser Workerへ渡らない制約があるため、CMS write APIをこのWorkerへ混在させません。

### 2. `sasanoha-dev-cms-api` Worker

設定: `wrangler.api.jsonc`

entry: `worker/api/index.ts`

責務:

- CMS itemのread / state actionだけを扱う。
- Static Assetsを一切持たない。
- Cloudflare Accessが存在しないrequestは403でfail-closedにする。
- Access identityは `ctx.access.getIdentity()` から取得する。
- 独自password、独自session、Cookie parser、JWT validatorを持たない。
- D1 `CMS_DB` 以外の案件resourceをbindingしない。

route:

```text
sasanoha.dev/admin/api/*
preview.sasanoha.dev/admin/api/*
```

Cloudflare Workersでは、同じhostname上でよりspecificなRouteがCustom Domainより優先されます。そのため通常siteはStatic Assets Worker、`/admin/api/*` だけAPI Workerへ分離できます。

### 3. D1 `sasanoha-dev-cms`

binding名: `CMS_DB`

migration:

```text
migrations/
  0001_items.sql
  0002_reference_fixture.sql
```

このD1はreference instance専用です。将来の実案件では案件ごとに別D1を作成します。

一つの中央DBに全顧客contentを集約しません。

## D1 item schema

`cms_items` の最小schemaです。

| column | purpose |
| --- | --- |
| `id` | CMS item ID |
| `kind` | `work` 等のitem種別 |
| `properties_json` | creator/site固有properties |
| `status` | draft / scheduled / published / archived |
| `created_at` | CMS作成日時 |
| `updated_at` | CMS更新日時 |
| `publish_at` | 公開予約日時 |
| `published_at` | 実公開日時 |
| `revision` | optimistic update用revision |

`properties_json` とsystem metadataを分離します。

`revision` を使い、updateは

```sql
WHERE id = ? AND revision = ?
```

で実行します。別requestが先に更新していた場合は409 conflictへ収束させます。

## HTTP API

### item取得

```http
GET /admin/api/items/<item-id>
```

response例:

```json
{
  "id": "reference-work",
  "kind": "work",
  "properties": {
    "description": "公開前の制作物",
    "producedAt": "2026-09-18"
  },
  "status": "scheduled",
  "createdAt": "2026-09-22T03:00:00.000Z",
  "updatedAt": "2026-09-22T03:00:00.000Z",
  "publishAt": "2026-10-01T09:00:00.000Z",
  "revision": 1
}
```

### 状態変更

```http
POST /admin/api/items/<item-id>/action
Content-Type: application/json

{ "action": "publish" }
```

action:

```text
publish
draft
archive
```

responseは更新後のitem全体です。

## Preview panel接続

`src/components/PreviewPanel.vue` は二つのmodeを持ちます。

### reference mode

localhostや通常の開発画面で使用します。

- D1へ接続しない。
- browser memory上だけstatusを変更する。
- reloadするとfixtureへ戻る。

### API mode

hostnameが `preview.sasanoha.dev` の場合だけ自動的に有効化します。

```text
GET  /admin/api/items/reference-work
POST /admin/api/items/reference-work/action
```

を同一originで呼びます。

本番PreviewでAPI接続に失敗した場合、reference modeへ自動fallbackしません。操作をdisableしてエラーを表示します。

これは「CMSへ保存できたように見えたが実際には保存されていない」という誤認を防ぐためです。

## Cloudflare Access

Accessは二つの境界で使います。

### Preview hostname

`preview.sasanoha.dev/*` 全体をhostname-based Access applicationで保護します。

Static Assetsそのものを未認証利用者へ見せないためです。

### CMS API Worker

`sasanoha-dev-cms-api` Worker自体をWorker-level Accessで保護します。

API Workerはさらにcode側でも

```ts
if (!ctx.access) {
  return 403;
}
```

としているため、Access設定が失われた状態でもwrite APIはfail-closedです。

Access policyが「誰を許可するか」というauthorizationを担当します。CMS側に第二のpassword user DBを作りません。

IdPやMFA方式は案件要件に合わせてAccess側で選択します。CMS runtimeへ固定しません。

## Local validation

```sh
npm install
npm run check
npm run db:local:migrate
npm run db:local:smoke
npm run build
npm run deploy:dry-run
```

API Worker単体:

```sh
npm run dev:api
```

`wrangler.api.jsonc` の `access.dev` によりlocalではAccess identityをsimulationできます。

## Remote provisioning / deploy順序

remote resourceを作るときは次の順序を守ります。

### 1. D1作成

```sh
npx wrangler d1 create sasanoha-dev-cms
```

返されたreal database IDを `wrangler.api.jsonc` の

```text
00000000-0000-0000-0000-000000000001
```

と置換します。

このsentinel IDのままremote deployしません。

### 2. D1 migration

```sh
npx wrangler d1 migrations apply sasanoha-dev-cms \
  --remote \
  --config wrangler.api.jsonc
```

### 3. Preview Access applicationを先に作る

Cloudflare Zero Trustで `preview.sasanoha.dev/*` を保護します。

まだDNS / Custom Domainが存在しなくても、Access policyを先に定義しておく方針です。

### 4. Static Workerをdeploy

`PREVIEW_ENABLED=false` のままdeployします。

```sh
npx wrangler deploy --config wrangler.jsonc
```

これによりpreview Custom Domainを作成しても、Worker自身が404を返すため、Access設定確認前にpreview本文を公開しません。

### 5. API Workerをdeploy

```sh
npx wrangler deploy --config wrangler.api.jsonc
```

この時点ではAccessがWorkerへ付いていなくても、API code自身が `ctx.access` 不在を403にするためwriteはできません。

### 6. API WorkerへWorker-level Accessを有効化

Cloudflare dashboard:

```text
Workers & Pages
  -> sasanoha-dev-cms-api
  -> Access
  -> Protect this Worker behind Access
  -> All traffic
```

許可policyを設定します。

### 7. Preview動作確認後にgateを開く

`wrangler.jsonc`:

```json
{
  "vars": {
    "PREVIEW_ENABLED": "true"
  }
}
```

へ変更し、PR / CIを通してから再deployします。

`PREVIEW_ENABLED` はCloudflare dashboardだけで変更せず、repository側をsource of truthにします。

## Smoke checklist

未認証:

```text
https://preview.sasanoha.dev/
  -> Access loginまたはblock

https://sasanoha.dev/admin/api/items/reference-work
  -> Access loginまたは403
```

認証後:

1. Preview pageを開く。
2. CMS panelに「CMS APIとD1へ接続しました。」が表示される。
3. 「今すぐ公開」を押す。
4. statusが「公開中」になる。
5. reloadする。
6. D1から再取得して「公開中」のままである。
7. D1のrevisionが1増えている。

## repository map

```text
worker/
  index.ts              # public / preview Static Assets Worker
  api/
    contract.ts         # HTTPで共有するstatus/action vocabulary
    handler.ts          # Access + HTTP boundary
    store.ts            # D1 adapter
    index.ts            # API Worker entry

migrations/
  0001_items.sql
  0002_reference_fixture.sql

src/
  components/
    PreviewPanel.vue
  lib/
    preview-action.ts

wrangler.jsonc          # static Worker
wrangler.api.jsonc      # API Worker + D1
```

## 将来の案件へ持っていく時

案件ごとに差し替えるもの:

- Worker名
- hostname / route
- D1 database名 / ID
- Access policy
- item schema / site config
- theme / Admin UI
- reference fixtureの有無

共通化するもの:

- action vocabulary
- Access fail-closed boundary
- item state transition
- D1 adapter contract
- migration versioning
- Preview/Admin API contract

現時点では `@sasanoha/cms` がexternal consumerへ配布されていないため、reference repositoryにstatus/action contractの小さなmirrorがあります。

これは恒久的な二重権威にはしません。package distribution checkpointでCore側へ収束し、このmirrorを削除する予定です。

## 参考にしているCloudflare仕様

- Workers Cloudflare Access: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Workers Routes: https://developers.cloudflare.com/workers/configuration/routing/routes/
- Workers Static Assets binding: https://developers.cloudflare.com/workers/static-assets/binding/
- D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
