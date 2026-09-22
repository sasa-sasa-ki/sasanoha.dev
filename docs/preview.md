# Preview surface

sasanoha.devのreference構成では、公開面とpreview面をhostnameで分離します。

```text
https://sasanoha.dev/
  public site

https://preview.sasanoha.dev/
  draft / scheduled preview
  + sasanohaCMS side panel
```

## Security boundary

`preview.sasanoha.dev` は一般公開しません。

Cloudflare Accessでpreview hostname全体を保護してから、WorkerのCustom Domainとして追加します。

現在の `wrangler.jsonc` は誤公開を避けるため `sasanoha.dev` だけをCustom Domainへ登録します。
Access設定後に次をroutesへ追加します。

```json
{
  "pattern": "preview.sasanoha.dev",
  "custom_domain": true
}
```

Workerはすでに `preview.sasanoha.dev` を認識し、通常の公開indexではなくAstroの `/preview/` assetへ切り替えられます。

## Preview panel

preview pageではサイト本文より上のz-indexに固定side panelを表示します。

- 閉じている時は右上の `CMS` buttonだけを表示
- 開くと右側からslide in
- 本文のDOM / layoutとは独立
- item status / 制作日時 / CMS作成日時 / 公開予約を確認
- 将来CMS API接続後、同じpanelから公開・下書き・保管を操作

現在のreference siteでは、API未接続でも **reference mode** として公開・下書き・保管をブラウザ内だけで切り替えられます。これはUI検証用で永続化されず、再読み込みするとfixtureへ戻ります。

実CMS接続時はpanelへaction endpointを渡し、次の最小contractを利用します。

```http
POST /admin/api/items/<item-id>/action
Content-Type: application/json

{ "action": "publish" | "draft" | "archive" }
```

成功時はCMS側で確定した状態を返します。

```json
{ "status": "draft" | "scheduled" | "published" | "archived" }
```

actionの状態遷移自体はsasanohaCMS Core側へ集約し、reference site独自のCMSロジックを増やさない方針です。
