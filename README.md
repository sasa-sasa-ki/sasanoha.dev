# sasanoha.dev

sasanohaCMSの公開reference / experimental siteです。

## 方針

- Astro
- Vue
- SCSS
- static output
- CMS product repositoryとは分離
- 実案件のprivate dataを持ち込まない

## sasanohaCMS 接続

このsiteは `sasanoha.config.ts` をCMS設定の権威とし、unified CMS Worker `sasanoha-cms` をService Binding `CMS` で呼び出します。

site Workerは `/admin` と `/admin/*` をCMS Workerへ転送します。CMS Worker側がCloudflare Access JWTを検証するため、Accessを通らないrequestは403でfail closedします。

`preview.sasanoha.dev` は通常の公開indexではなくpreview surfaceを返します。Admin PanelからPreviewを開くと `?sasanohaItem=<id>` が付き、`/admin/preview/overlay.js` がD1上のitemを読み込んで画面上層に編集UIを表示します。

public hostnameの `/preview/*` は引き続き404です。

## package公開前のbootstrap

`@sasanoha/cms` は現時点ではprivate packageです。ローカルのsasanohaCMS repositoryで先にtarballを作ります。

```sh
# sasanohaCMS repository
npm install
npm run check
npm run pack:cms
```

そのtarballをこのrepositoryへinstallします。実際の相対pathはローカル配置に合わせてください。

```sh
npm install --save-dev ../sasanohaCMS/sasanoha-cms-0.1.0.tgz
```

package公開後は次へ置換します。

```sh
npm install --save-dev @sasanoha/cms
```

## Cloudflare前提

CMS deploy前に以下を環境へ設定します。

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
SASANOHA_ACCESS_AUD
SASANOHA_TEAM_DOMAIN
```

Access application / policyは先にCloudflare側で用意します。CMS側の `npm run cms:plan` はWorker、D1、route、Access対象pathの現状をread-onlyで確認します。

## deploy

確認だけ:

```sh
npm run cms:plan
```

CMS + siteを直列に一括deploy:

```sh
npm run deploy
```

実行順は次です。

```text
sasanoha apply
  → D1 ensure
  → D1 remote migration
  → sasanoha-cms Worker
  → Astro check/test/build
  → sasanoha.dev site Worker
```

主要script:

```sh
npm run cms:apply
npm run cms:plan
npm run cms:deploy
npm run deploy:site
npm run deploy
```

PowerShell固有scriptは使用しません。

## 開発

```sh
npm install
npm run check
npm run dev
npm run build
npm run deploy:dry-run
```
