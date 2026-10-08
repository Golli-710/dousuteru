# Cloudflare Pages移行手順

## 現状と保持するもの

静的HTML/CSS/JavaScriptのみ。外部依存、Functions、Workers、データベースは不要。62公開URL、58確認済み品目、検索条件、広告枠、スタイル、公式出典、構造化データを維持します。未確認89件は公開しません。
既存`pages.yml`は変更せずmain pushでGitHub Pagesを更新します。自動データ取得・定期更新workflowは現在存在しません。データ変更pushは両ホストへ反映します。新しい監査workflowはデプロイせずCloudflare向け出力を確認します。

## ユーザーの操作：最初の検証公開

1. Cloudflareにログインして Workers & Pages → Create application → Pages → Connect to Git を開きます。Workersのアプリ作成ではなくPagesを選びます。
2. GitHub連携を認証し、`Golli-710/dousuteru`への読み取りを許可します。
3. Production branchは`main`、Framework presetはNone、Build commandは`npm run build:cloudflare`、Build output directoryは`public`、Root directoryは空欄です。
4. Production/Preview両環境に`NODE_VERSION=22`、`SITE_INDEXING=staging`を設定します。`SITE_BASE_PATH`は未設定のままルート公開します。初回は`SITE_ORIGIN`未設定で、Cloudflare提供`CF_PAGES_URL`を使用します。
5. デプロイURLを共有してください。GitHub Pagesは停止しません。stagingは全ページのmeta robotsとHTTP X-Robots-Tagでnoindexになります。robots.txtはクロールを許可しnoindexを読めるようにします。
6. Git連携によりmainへのpushで自動デプロイされます。新環境のトップ、3自治体、58詳細、検索の複数条件、draft除外、スマホ、404実HTTPステータス、リダイレクトを確認します。

## 公開URL確定後の切替

- 正式URL（独自ドメインまたは確定したpages.dev）を決め、独自ドメインならPages管理画面からCustom domainsを追加し案内どおりDNSとHTTPSを確認します。
- Productionだけ`SITE_ORIGIN=https://確定したホスト`、`SITE_INDEXING=production`に変更し再デプロイ。Previewはstagingのままです。main以外は設定に関係なくnoindexとなります。ブランチ名を変えた場合は`PRODUCTION_BRANCH`も設定してください。
- canonical、OGP URL、JSON-LD、sitemap、robots.txtは同一の設定値で生成されます。内部リンク、CSS/JS、検索結果はルートパスです。OGPのtitle/description/urlを追加しました。専用共有画像はないためog:imageは未設定です。
- 正式ドメインのSearch Console登録・所有権確認後、sitemap.xmlを送信します。既存Google確認タグは維持しますが、新ドメインの所有権が自動で確認されるとは限りません。

## 旧URLとSEOの制約

旧URLは https://golli-710.github.io/dousuteru/ 。既存GitHub PagesにはCloudflare側から301を設定できません。新ホストの`_redirects`は`/dousuteru/*`→`/*`の互換用であり、旧github.ioへのアクセスを転送するものではありません。
旧公開先をそのまま残す現在の段階では旧canonicalも旧URLのままです。切替後は旧ページを新URLへcanonical指定するか、対応URLへのmeta refresh/移転リンクを残す追加変更が必要ですが、サーバー301と同等ではありません。独自ドメインが既にあるサイトなら同じドメインとパスを維持する方式が最優先です。このサイトに独自ドメイン設定はありません。
正式URL確定と動作確認までは旧ホストのSEO・デプロイ設定を変更しません。切替時の旧ページ対応は別のレビュー可能な変更として実施し、旧URLは削除しません。Googleのアドレス変更ツールはパス単位の移転に適さないため、github.ioのproject siteに対して利用できると想定しません。

## 設定とローカル検証

`npm run check`は既存GitHub Pages向け。`SITE_ORIGIN=https://確定ホスト SITE_INDEXING=staging npm run build:cloudflare`は新ホスト向け検証ビルド。productionは明示的なSITE_ORIGINが必須です。`public/`は生成物なので、別ホストを検証した後は`npm run check`で既存向けに戻します。

検証対象：全HTMLの固有title/H1/description、canonical（公開時）、OGP、JSON-LD、内部リンク・アセット、62件のsitemap、robots、検索実行とdraft除外、レスポンシブCSS、staging noindex header、互換リダイレクト。実ブラウザと実HTTPの最終検証は認証後の新環境で行います。

## 無料プラン

無料プラン内の静的配信を使用し、有料機能は追加しません。ビルド回数の上限を両サイトとpreviewを合算して確認し、不要なpreviewブランチは管理画面で制限してください。

公式資料:
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/preview-deployments/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://developers.cloudflare.com/pages/configuration/redirects/
- https://developers.cloudflare.com/pages/platform/limits/
# Search Console ownership

Set `GOOGLE_SITE_VERIFICATION` in the Cloudflare Production build environment to the HTML-tag value provided by the Google account adding the URL-prefix property. The homepage emits it in its head; when unset, the existing GitHub Pages verification value is retained. Keep the variable after verification so Google can recheck ownership. This does not enable indexing.
