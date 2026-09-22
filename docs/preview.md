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

Cloudflare Accessでpreview hostname全体を保護し、さらにStatic Assets Worker側でも `PREVIEW_ENABLED=true` になるまで404を返します。

CMS write/read APIはStatic Assets Workerへ混在させず、別の `sasanoha-dev-cms-api` Workerへ分離します。API WorkerはD1だけをbindingし、`ctx.access` が無いrequestを403で拒否します。

## Preview panel

preview pageではサイト本文より上のz-indexに固定side panelを表示します。

- 閉じている時は右上の `CMS` buttonだけを表示
- 開くと右側からslide in
- 本文のDOM / layoutとは独立
- item status / 制作日時 / CMS作成日時 / 公開予約を確認
- localhostでは非永続reference mode
- `preview.sasanoha.dev` では同一originのCMS API + D1へ自動接続
- API接続失敗時は操作をdisableし、reference modeへ偽装fallbackしない

詳細なWorker / D1 / Access / deploy手順は [reference-cms-runtime.md](./reference-cms-runtime.md) を参照してください。
