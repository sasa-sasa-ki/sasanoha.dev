# sasanoha.dev

sasanohaCMSの公開reference / experimental siteです。

## 方針

- Astro
- Vue
- SCSS
- static output
- CMS product repositoryとは分離
- 実案件のprivate dataを持ち込まない

## 現在

現在はreference siteの最小骨格です。

`@sasanoha/cms` はまだprivate packageのため、このrepositoryにはlocal-only dependencyやvendor copyを持ち込みません。
初期版をpublic package化した段階で、このrepositoryから次を実行して実導入を検証します。

```sh
npx @sasanoha/cms init
```

それまでは `/experiment/` で公開側のitem表示、`/preview/` で下書きpreview UIをfixtureとして確認します。

previewのproduction想定は `https://preview.sasanoha.dev/` です。Workerはhostnameを見てpreview assetへ切り替えますが、preview hostnameはCloudflare Accessで保護してからCustom Domainへ追加します。

## 開発

```sh
npm install
npm run check
npm run dev
npm run build
```
