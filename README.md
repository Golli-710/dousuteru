# どう捨てる？

**自治体別のゴミ・不用品の捨て方検索**

自治体と品目を組み合わせて、公式情報に基づく分別区分、料金、申込方法、収集・持込条件を探せる静的サイトです。情報量を増やすより、品目ごとの根拠と確認状況を明確にすることを優先します。

## データ状況

対象自治体は川崎市・横浜市・大阪市です。初期品目は重複を統合した49品目です。処分レコード147件のうち、公式資料を照合した58件を`verified`、未確認の89件を`draft`として管理しています。

第2フェーズで確認した主要20品目は、川崎市20件、大阪市20件、横浜市18件が`verified`です。横浜市の「炊飯器」「チャイルドシート」は品目別の区分・手数料根拠を確認できなかったため`draft`に保ち、詳細ページ・検索結果・サイトマップには出しません。

| 自治体 | 対象20品目 verified | 対象20品目 draft |
| --- | ---: | ---: |
| 川崎市 | 20 | 0 |
| 横浜市 | 18 | 2 |
| 大阪市 | 20 | 0 |
| **合計** | **58** | **2** |

`verified`は自治体公式の品目別料金表、分別案内、申込・搬入案内を照合した行です。空欄や不確かな条件を推測で埋めず、確認できない行は`draft`のままにします。料金が寸法・材質・個数・仕様で変わる場合は、条件と金額の組み合わせを`fee`・`size_condition`に保持します。主な根拠を`official_url`と`source_name`に、関連する公式根拠を`source_urls`に記録します。

## 開発と生成

Node.js 18以降を使います。外部ライブラリは不要です。

```sh
node src/generators/build.mjs
node src/generators/audit.mjs
```

`public/`をルートでローカル表示する場合は、`SITE_BASE_PATH= node src/generators/build.mjs`で生成します。設定ファイルの変更は不要です。

便利なnpmスクリプトもあります。

```sh
npm run build
npm run audit
npm run check
```

`audit.mjs`はデータ必須項目、自治体公式ドメイン、件数、公開ページ、title・description・canonical・H1、重複、構造化データ、内部リンク・アセット、検索のverified限定、draft URL除外、404、サイトマップ、robots、レスポンシブ用CSSブレークポイントを検査します。

## データファイル

- `data/site.json`: サイト名、公開オリジン、GitHub Pagesのbase path
- `data/municipalities.json`: 自治体スラッグ、都道府県、基本ルール、公式案内URL
- `data/items.json`: 品目名、カテゴリ、詳細ページ用の英字スラッグ
- `data/disposal.json`: 自治体×品目の処分情報、出典、確認日、verified/draft

### 新しい自治体を追加

1. `municipalities.json`に一意な英字`slug`、都道府県、自治体公式のごみ案内URLを追加します。
2. 対象品目ごとのレコードを`disposal.json`に作ります。未確認の行は`draft`にします。
3. 品目別根拠、料金、条件、申込・収集・持込を一次情報で確認して、`official_url`、`source_name`、`source_urls`、`verified_at`を記録します。
4. `status: "verified"`にするのは、公式資料からページの表示内容を裏付けられる場合だけです。
5. 生成・監査を実行します。

自治体トップへのリンクだけでは、品目データを`verified`にしません。

### 新しい品目を追加

1. `items.json`に名称・カテゴリ・一意な英字`slug`を追加します。
2. `disposal.json`に自治体ごとの行を作ります。料金や寸法条件が未確認なら`draft`にします。
3. 自治体公式の根拠と確認日を記録してから`verified`にします。
4. 生成・監査を実行します。詳細ページとサイトマップには`verified`だけが反映されます。

## ページ・SEO

生成スクリプトはトップページ、自治体3ページ、verified詳細ページ、`404.html`、`sitemap.xml`、`robots.txt`、`.nojekyll`を`public/`へ出力します。現在のサイトマップはトップ1、自治体3、詳細58の合計62 URLです。404ページは`noindex,follow`にします。

詳細ページは、冒頭に処分区分・料金・申込の要点をまとめ、その後に収集、持込、条件、注意事項、公式出典、確認日、関連品目を表示します。各ページに固有のtitle、description、canonical、H1を設定し、WebSiteとBreadcrumbListのJSON-LDを出します。FAQの表示がないため、FAQ構造化データは追加しません。

広告プレースホルダーはページ上部・本文中・下部に維持し、本番広告コードは入れていません。

## GitHub Pages

リポジトリ名は`dousuteru`、公開方式はGitHub Pagesのproject siteを想定しています。GitHubユーザー名と作成済みリポジトリURLが確定した後で設定してください。別リポジトリは作成しません。

`data/site.json`を次のように設定します。

```json
{
  "site_name": "どう捨てる？",
  "subtitle": "自治体別のゴミ・不用品の捨て方検索",
  "base_url": "https://<GitHubユーザー名>.github.io",
  "base_path": "/dousuteru"
}
```

`base_url`にはオリジンだけを設定し、`base_path`にはリポジトリ名を設定します。独自ドメインなどルートで公開する場合は、実際のオリジンに変更し`base_path`を空文字にします。プレースホルダーのまま公開しないでください。

`.github/workflows/pages.yml`は`main`へのpushまたは手動実行でビルド・監査を行い、Pagesへデプロイします。GitHubリポジトリ設定で **Settings → Pages → Build and deployment → GitHub Actions** を選択してください。

生成されたcanonical、内部リンク、CSS/JSのURL、sitemap、robotsのsitemap URLはbase pathから作ります。`/dousuteru/`配下での公開時もルート向け絶対パスには依存しません。

## GitHubリモート

この作業フォルダーには当初Git履歴がありませんでした。ローカルGit管理を始めた後、`dousuteru`の作成済みURLを`origin`へ設定してください。認証中のGitHubアカウントで同名リポジトリを照会しましたが見つからなかったため、URLを推測して登録・pushしないでください。

```sh
git remote add origin <作成済みdousuteruリポジトリのURL>
git push -u origin main
```

## 将来のデータ更新

自動取得を追加するときは、公式情報の取得、候補抽出、正規化、旧データとの比較、レビュー、承認の順で実装します。自動抽出結果をそのまま`verified`として公開しません。

## Cloudflare Pages移行

[移行手順](docs/cloudflare-pages.md)を参照してください。GitHub Pagesの公開設定と既存workflowは維持しています。
