# 日程調整アプリ (MVP)

ログイン不要のシンプルな日程調整Webアプリです。
主催者がミーティング候補日時を作成して共有URLを発行し、参加者は名前を入力して各候補時間に **OK / NG / 未回答** を答えます。回答結果から OK人数の多い時間が自動でおすすめされます。

## 技術スタック

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Postgres)

## 機能

- 日程調整ページの作成（ミーティング名 / メモ / 候補日 / 開始・終了時刻 / 時間枠 15・30・60分）
- 作成後に共有URLを発行・コピー可能
- 参加者は共有URLから名前だけ入力して回答
- 各候補時間に OK / NG / 未回答 を選択
- 同じ名前で再アクセスすれば回答を編集可能（「読込」ボタン）
- OK人数順におすすめ候補を表示
- 全員OKの時間は **緑色** で強調表示
- 各時間ごとに OK人数 / NG人数 / 未回答人数を表示
- 日本語UI / iPhone対応のレイアウト

## ディレクトリ構成

```
src/
  app/
    page.tsx                  # トップ: 日程作成
    e/[slug]/page.tsx         # 共有ページ: 回答 & 集計
    api/
      events/route.ts                       # POST /api/events
      events/[slug]/route.ts                # GET  /api/events/:slug
      events/[slug]/responses/route.ts      # POST /api/events/:slug/responses
  lib/
    supabase.ts               # supabase-js クライアント
    datetime.ts               # 候補スロット生成・日付整形
    slug.ts                   # 共有URL用slug
supabase/
  schema.sql                  # テーブル & RLS 設定
```

## 起動方法

### 1. 依存をインストール

```bash
npm install
```

### 2. Supabase の設定

1. [Supabase](https://supabase.com) でプロジェクトを新規作成
2. プロジェクトの **SQL Editor** を開き、本リポジトリの `supabase/schema.sql` の内容を貼り付けて実行
3. **Settings → API** から以下を取得
   - Project URL
   - `anon` public key
4. プロジェクトルートに `.env.local` を作成（`.env.local.example` をコピー）

```bash
cp .env.local.example .env.local
```

`.env.local` を編集して、取得した URL / Key を設定してください。

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-PUBLIC-ANON-KEY
```

### 3. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### 4. 動作確認

1. トップページでミーティング名、候補日、開始/終了時刻、時間枠を入力 → 「日程調整を作成する」
2. 表示される共有URLをコピー
3. 別のブラウザ／シークレットウィンドウで共有URLを開き、名前を入れて回答
4. 同じ名前で「読込」を押すと前回の回答を編集できる

## DB スキーマ

- `events` … イベント（slug, name, memo, slot_minutes）
- `time_slots` … 候補時間（event_id, start_at, end_at）
- `participants` … 参加者（event_id, name … (event_id, name) で一意）
- `responses` … 回答（participant_id, time_slot_id, status='ok'|'ng' … (participant_id, time_slot_id) で一意。未回答は行が無い状態）

詳細は `supabase/schema.sql` を参照。

## セキュリティに関する注意（MVP）

- ログイン不要のため、`anon` ロールで全テーブルに対して read/write を許可する RLS ポリシーになっています。
- 本番運用する場合は、少なくとも以下のような対策が必要です。
  - イベント作成にレート制限を入れる
  - 参加者の編集トークンを発行し、同じ名前でも他人が改ざんできないようにする
  - `events`/`time_slots` の更新・削除を制限する

## 起動コマンド一覧

```bash
npm run dev        # 開発サーバー
npm run build      # 本番ビルド
npm run start      # 本番サーバー起動
npm run typecheck  # TypeScriptの型チェック
```
