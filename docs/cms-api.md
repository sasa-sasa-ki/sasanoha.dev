# sasanoha.dev CMS API reference topology

この文書は、sasanohaCMSを実案件へ展開する前に `sasanoha.dev` で検証する
Cloudflare reference topologyを、人間が追従できる粒度で固定するための資料です。

## 1. 全体構成

```text
browser
  |
  | https://preview.sasanoha.dev/
  v
Cloudflare Access
  |
  +------------------------------+
  |                              |
  | page / assets                | /admin/api/*
  v                              v
sasanoha-dev-reference      sasanoha-dev-cms-api
Static Assets Worker        API Worker
  |                              |
  |                              +--> ctx.access.getIdentity()
  |                              +--> EDITOR_EMAILS authorization
  |                              +--> D1 binding: CMS_DB
  |                                      |
  |                                      v
  |                                sasanoha-dev-cms
  |                                D1 database
  |
  +--> Astro + Vue preview
         |
         +--> GET  /admin/api/items/reference-work/action
         +--> POST /admin/api/items/reference-work/action
```

公開側 `https://sasanoha.dev/` は従来どおり
`sasanoha-dev-reference` Workerが担当します。

preview hostnameはCloudflare Accessを有効化するまで
既存 `wrangler.jsonc` のCustom Domainへ追加しません。

## 2. Workerの分離理由

### sasanoha-dev-reference

責務:

- Astro static assets配信
- public site
- preview pageのstatic shell
- public hostnameから `/preview/*` へ直接入る経路の404化
- preview hostnameでは `/preview/` assetへrouting

このWorkerはStatic Assetsを持ちます。

Cloudflareの仕様上、Static Assets付きWorkerはAccessで保護されていても
user Workerへ `ctx.access` が渡らないため、認証identityを必要とするwrite APIを
このWorkerへ同居させません。

### sasanoha-dev-cms-api

責務:

- `preview.sasanoha.dev/admin/api/*`
- Cloudflare Access identityの取得
- instance固有editor authorization
- D1 read/write
- preview action contractの実行

Static Assetsを持たない専用Workerです。

Cloudflare Routeは同じhostnameのCustom Domainより具体的なpathで前段実行できるため、
`preview.sasanoha.dev/admin/api/*` だけAPI Workerへ分離します。

## 3. 認証と認可

認証はCloudflare Accessへ委譲します。

API Workerは `ctx.access` が無ければ401で停止します。

認証後も、そのidentityのemailが `EDITOR_EMAILS` に無い場合は403で停止します。
`EDITOR_EMAILS` 自体が未設定の場合は503で停止します。

したがって次を別責務として扱います。

```text
Cloudflare Access
  = 誰として認証されたか

EDITOR_EMAILS
  = このCMS instanceを編集してよいか
```

独自password、password reset、session storeは作りません。

## 4. D1

reference database name:

```text
sasanoha-dev-cms
```

Worker binding:

```text
CMS_DB
```

初期migration:

```text
worker/api/migrations/0001_create_cms_items.sql
```

現在のtableは `cms_items` 一つです。

主なcolumn:

- `id`
- `item_type`
- `properties_json`
- `status`
- `created_at`
- `updated_at`
- `publish_at`
- `published_at`
- `updated_by`

v0.1ではitem state永続化だけを確認し、media、revision history、audit event tableはまだ追加しません。

## 5. API contract

現在のreference item:

```text
reference-work
```

状態取得:

```http
GET /admin/api/items/reference-work/action
```

response例:

```json
{
  "id": "reference-work",
  "status": "scheduled",
  "updatedAt": "2026-09-22T03:00:00.000Z",
  "publishAt": "2026-10-01T09:00:00.000Z"
}
```

状態変更:

```http
POST /admin/api/items/reference-work/action
Content-Type: application/json

{ "action": "publish" }
```

action:

- `publish`
- `draft`
- `archive`

この語彙はsasanohaCMS Coreの `ItemAction` と揃えます。

現在は `@sasanoha/cms` をexternal consumerとしてまだ導入していないため、
reference site側ではtransport contractだけを小さくmirroringしています。
package配布開始後は共通型へ寄せます。

## 6. Preview UI

local `astro dev`:

- reference mode
- D1/APIへ接続しない
- UI上だけstateを切り替える
- reloadで元に戻る

production build:

- `/admin/api/items/reference-work/action` へ接続
- mount時にGETでD1 stateを復元
- button操作はPOST
- API応答のstateを画面へ反映

同じorigin内で通信するため、production用途のCORS layerは追加しません。

POSTは `Origin` が存在する場合にrequest URLのoriginと一致することを要求します。

## 7. local verification

```powershell
npm ci
npm run check
```

API Worker local development:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run api:d1:migrate:local
npm run api:dev
```

`.dev.vars` はGit管理しません。

## 8. remote provisioning

### Step 1 — D1を作成

```powershell
npx wrangler d1 create sasanoha-dev-cms
```

返されたdatabase IDを `wrangler.api.jsonc` の
`database_id` へ設定します。

placeholder UUIDのままではdeploy guardが停止します。

### Step 2 — migration

```powershell
npm run api:d1:migrate:remote
```

### Step 3 — Access

Cloudflare Zero Trustでself-hosted applicationを作り、
次を保護します。

```text
preview.sasanoha.dev/*
```

policyでは実際に編集を許可するidentityだけを通します。

### Step 4 — preview Custom Domain

Accessが有効であることを確認した後だけ、public/static Workerの
`wrangler.jsonc` に次を追加します。

```json
{
  "pattern": "preview.sasanoha.dev",
  "custom_domain": true
}
```

その後 `sasanoha-dev-reference` をdeployします。

### Step 5 — API Worker first deploy

Accessが有効で、D1 IDが設定済みであることを確認します。

PowerShell:

```powershell
$env:SASANOHA_ACCESS_CONFIRMED = "1"
npm run api:deploy
```

初回は `EDITOR_EMAILS` 未設定のため、APIは503でfail-closedします。

### Step 6 — editor allowlist

API Workerが存在した後にsecretを設定します。

```powershell
npx wrangler secret put EDITOR_EMAILS --config wrangler.api.jsonc
```

値はcomma separated emailです。

例の実値はrepositoryへ保存しません。

`wrangler secret put` は新versionをdeployするため、
この時点でAPIが利用可能になります。

## 9. deployment safety

`npm run api:deploy` は次を確認します。

1. D1 `database_id` がplaceholderではない
2. local environmentで `SASANOHA_ACCESS_CONFIRMED=1` が設定されている

ただし、この環境変数はAccessそのものを技術的に検証するものではありません。
人間がCloudflare dashboard / API上のAccess applicationを確認したreceiptです。

API code側にも別途次のfail-closedがあります。

- `ctx.access` 無し -> 401
- identity email無し -> 403
- `EDITOR_EMAILS` 無し -> 503
- allowlist外 -> 403
- cross-origin POST -> 403
- unknown action -> 400

## 10. 現時点で使用しないもの

まだ導入しません。

- R2
- media upload
- audit event table
- full Admin shell
- service binding
- custom authentication database
- JWT manual verification
- central control plane
- multi-tenant shared database

次のcheckpointで、D1-backed action flowが実Cloudflare上で成立した後に
public read flow / publish snapshotを決め、その次にR2を追加します。
