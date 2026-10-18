# セットアップ手順書(下書き)

このプロジェクト(`line-bot-app`)を引き継ぐ開発者向けの、ゼロからのセットアップ手順です。
Next.js・Supabaseの基本的な知識がある方を前提に書いていますが、本プロジェクト固有の用語には短い説明を添えています。

実際にコード・設定ファイルを読んで確認できた内容のみ記載し、確認できていない部分は
**【要確認】** と明記しています。

---

## 1. 必要なもの

- **Node.js**: `node_modules/next/package.json` の `engines.node` に `">=20.9.0"` と明記されているため、Node.js 20.9.0以上が必要です。
- **npm**: `package-lock.json` が使われているため npm を使います(他のパッケージマネージャは未確認)。
- アカウント類
  - **Supabase** アカウント(DBとオーナーログイン認証に使用)
  - **LINE Developers** アカウント(Messaging APIチャネル作成用)
  - **LINE公式アカウント**(LINE Official Account Manager での応答設定用。Messaging APIチャネルを作ると紐づくLINE公式アカウントが作られます)
  - **Anthropic** アカウント(Claude APIキー発行用)
  - **Vercel** アカウント(本番デプロイ先。公開URL: `https://line-bot-app-psi.vercel.app` ※既存の本番環境)

---

## 2. リポジトリの取得と依存関係のインストール

```bash
git clone <このリポジトリのURL>
cd line-bot-app
npm install
```

---

## 3. Supabaseの準備

### 3-1. プロジェクトの作成

Supabaseダッシュボードでプロジェクトを用意します。新規作成でも、既存プロジェクトとの共用でも動作します。共用する場合は、テーブル名(`faq`/`menus`/`conversations`/`bot_admins`)が他のアプリと重ならないことを確認してください。

### 3-2. マイグレーションの適用(0001→0004の順)

`supabase/migrations/` 配下のSQLを、Supabase CLIまたはダッシュボードのSQL Editorで、**必ず番号順**に実行してください。

| ファイル | 内容 |
|---|---|
| `0001_linebot_init.sql` | `faq`/`menus`/`conversations` テーブルを作成。RLSを有効化し、「ログイン済みなら誰でも」条件のポリシーと `authenticated` ロールへの `grant` を設定 |
| `0002_seed_faq.sql` | 初期FAQ5件を投入するシードデータ |
| `0003_bot_admins.sql` | `bot_admins` テーブルと `is_bot_admin()` 関数を追加。`faq`/`menus`/`conversations` のRLSポリシーを「`bot_admins` 登録者のみ」に差し替え |
| `0004_grant_service_role.sql` | Webhookが使う `service_role` に、`faq`/`menus` へのSELECT、`conversations` へのINSERTを付与 |

順番を守る理由: `0003` は `0001` で作ったテーブルのポリシーを差し替える内容のため、`0001` より先に `0003` を実行すると失敗します。

### 3-3. 管理者(bot_admins)の登録方法

管理画面(`/admin`)へのログインはSupabase Authのメール/パスワード認証(`app/admin/login/LoginForm.tsx` が `supabase.auth.signInWithPassword` を使用)です。ログインできても、`bot_admins` テーブルに登録されたユーザーのみが `is_bot_admin()` 経由でFAQ・メニュー・会話ログを操作できます(`supabase/migrations/0003_bot_admins.sql`)。

実際に行った手順は、Supabaseの管理者ユーザーを用意し、SQL Editorで `bot_admins` にそのユーザーを登録する、というものです。

1. Supabaseダッシュボードの **Authentication > Users** で、オーナー用のユーザーをメール/パスワードで作成する。
   **【要確認】** この画面操作そのもの(項目名・ボタンの配置など)は、本手順書作成時点で実際の画面を確認していません。
2. 作成したユーザーの `id`(UUID)を確認する。
3. SQL Editorで以下を実行し、`bot_admins` に登録する(`<ユーザーのUUID>` はプレースホルダーです。実際の値には書き換えません)。

   ```sql
   insert into bot_admins (user_id) values ('<ユーザーのUUID>');
   ```

   `bot_admins` のカラムは `user_id`(uuid, primary key, `auth.users(id)` へのFK)と `created_at`(default now())のみのため(`supabase/migrations/0003_bot_admins.sql`)、挿入が必要なのは `user_id` だけです。

### 3-4. テーブルの権限(GRANT)が必要な理由

このSupabaseプロジェクトは、テーブルを作成しただけではロール(`anon`/`authenticated`/`service_role`)にSELECT等の権限が自動では付かない設定になっているため、RLSポリシーを用意するだけでは不十分で、**ロールごとに `grant` を明示する必要があります**(`README.md` および `0004_grant_service_role.sql` のコメントで確認済み)。

---

## 4. LINEの準備

### 4-1. Messaging APIのチャネル作成

LINE Developersコンソールで、Messaging APIのチャネルを新規作成します。
**【要確認】** コンソール上の具体的な作成手順(プロバイダー作成の有無など)は、本手順書作成時点で実際の画面操作を確認していません。

Channel secret(`LINE_CHANNEL_SECRET`)とChannel access token(`LINE_CHANNEL_ACCESS_TOKEN`)もこのチャネルの設定画面から取得しますが、
**【要確認】** 画面上の具体的な配置(タブ名・項目名)は本手順書作成時点で確認していません。

### 4-2. Webhook URLの設定

Webhook URLは、チャネルの **「Messaging API設定」** から設定します。

- 本番: `https://line-bot-app-psi.vercel.app/api/line-webhook`(`README.md` に記載・動作確認済み)
- ローカル確認用にURLを一時的に変更する場合は本手順書の7章を参照してください。

「Webhookの利用」を **オン** にしてください(botが動くために必須、`README.md` で確認済み)。

### 4-3. LINE公式アカウントの応答設定

LINE Official Account Manager(botとは別の、LINE公式アカウント運営用の画面。`docs/owner-manual.md` にも同じ注記あり)の「応答設定」で、以下のように設定します(`README.md` に記載・実際にLINEから動作確認済み)。

| 設定項目 | 値 | 理由 |
|---|---|---|
| Webhook | オン | botが動くために必須 |
| チャット | オン | オーナーが管理画面を経由せず、LINEのトーク画面から直接手動で返信できるようにするため(botの自動応答と併用可能) |
| 応答メッセージ | オフ | オンのままだとbotの返信と二重に送信されるため |
| あいさつメッセージ | オフ | — |

---

## 5. Anthropic APIキーの取得

Anthropicのダッシュボードで組織(またはアカウント)を作成し、APIキーを発行します。
**【要確認】** 発行画面の具体的な操作手順は本手順書作成時点で確認していません。使用モデルはコード上 `claude-haiku-4-5`(`lib/claude.ts`)です。

---

## 6. 環境変数(名前の一覧のみ)

`.env.local.example` に記載されている変数名です。値は絶対にこの手順書やリポジトリに書かないでください。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `ANTHROPIC_API_KEY`
- `OWNER_LINE_USER_ID`

`.env.local` を作成し、上記の変数名で値を設定してください。`.gitignore` で `.env*` が除外対象になっているため、コミットされません。

---

## 7. ローカルでの起動と、LINEからの動作確認の方法

### 起動

```bash
npm run dev
```

`http://localhost:3000` で起動します(`package.json` の `dev` スクリプトで確認済み)。

### LINEからの動作確認

LINEはpublicなURLにしかWebhookを送れないため、ローカルサーバーをそのまま使うことはできません。`README.md` には次のように記載されています。

> LINEから実際にメッセージを送って動作確認する場合は、ngrok等でローカルサーバーを公開し、LINE Developers ConsoleのWebhook URLをそのURLに変更する必要があります

本プロジェクトでの動作確認は、本番環境(Vercel)でのみ実施しています。ローカルでWebhookを試す場合の参考手順は以下の通りですが、**【要確認】** このリポジトリにngrok等の設定ファイルは含まれておらず、以下の手順自体は実際に試して動作確認したものではありません(未検証の参考手順です)。

1. `ngrok http 3000` 等でローカルサーバーをpublicなURLに公開する。
2. LINE Developers ConsoleのWebhook URLを、発行されたngrokのURL(例: `https://xxxx.ngrok-free.app/api/line-webhook`)に一時的に変更する。
3. 確認が終わったら、Webhook URLを本番URL(`https://line-bot-app-psi.vercel.app/api/line-webhook`)に戻す。

---

## 8. Vercelへのデプロイ

1. Vercelにリポジトリを接続し、プロジェクトを作成します。
2. Vercelダッシュボードの環境変数に、6章の変数名と値を設定します。
3. デプロイします。

**環境変数を追加・変更した場合は、次のデプロイ(Redeploy)まで反映されません。**(`README.md` に記載・本プロジェクトで実際に遭遇した事象。9章も参照)
変更後は必ずRedeployを行ってください。

---

## 9. よくあるつまずき(実際に起きたもの)

### 9-1. service_roleに権限がなく、FAQが空になった

**症状**: Webhookからの質問に対し、FAQが登録されているにもかかわらず「FAQは0件」として扱われたり、意図しない動作になった。

**原因**: このSupabaseプロジェクトは、テーブルを作成しただけではロールに権限が自動付与されない設定になっているため、`0001`/`0003` では `authenticated` ロールにしかGRANTしておらず、Webhookが使う `service_role` は `faq`/`menus` へのSELECT権限を一度も持っていなかった(`0004_grant_service_role.sql` のコメントで確認済み)。RLSポリシーを設定しても、RLSとは別にテーブルへのGRANTが必要という点が見落とされていた。

**対応**: `0004_grant_service_role.sql` で `service_role` に対して `faq`/`menus` へのSELECT、`conversations` へのINSERTを個別にGRANTした。

**再発防止の観点**: 新しいテーブルを追加する際、「RLSポリシーを書いたから権限も効くはず」と思い込まず、`service_role` やその他使用するロールに対して明示的なGRANTが必要かどうかを必ず確認すること。

### 9-2. 環境変数を変更したのに反映されなかった

**症状**: Vercelの環境変数を変更したが、本番の動作に反映されなかった。

**原因**: Vercelは環境変数を変更しただけでは実行中のデプロイに反映されず、次回のデプロイ時に読み込まれる(`README.md` 8章に記載)。

**対応**: 環境変数を変更した後は、Vercelダッシュボードから手動でRedeployを行う。

---

本手順書はコードと設定ファイル(`package.json`、`supabase/migrations/`、`README.md`、`docs/owner-manual.md`、`lib/`、`app/`配下)を実際に読んで作成していますが、ダッシュボードやコンソールの画面操作そのものは、本手順書作成時点では直接確認していない箇所があり、該当部分には **【要確認】** と明記しています。
