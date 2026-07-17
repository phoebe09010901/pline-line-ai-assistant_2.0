# PLine Local Query API

Reads the local Dropbox-synced idea folder without writing to it.

## Start

```sh
npm start
```

The default address is `http://127.0.0.1:8787`.

## Config

TEST defaults stay compatible with the current Dropbox-synced idea folder.

- `PORT`: HTTP port. Default: `8787`.
- `PLINE_QUERY_DATA_DIR`: query data directory override.
- `PLINE_IDEA_DIR`: fallback query data directory when `PLINE_QUERY_DATA_DIR` is not set.

For FORMAL, RELEASE must provide a FORMAL data directory through env/config.
Do not reuse or copy the TEST Dropbox folder as FORMAL data.

## Endpoints

- `GET /health`
- `POST /query` with `{"action":"count_day"}`
- `POST /query` with `{"action":"list_day"}`
- `POST /query` with `{"action":"count_month"}`
- `POST /query` with `{"action":"list_month"}`
- `POST /query` with `{"action":"count_year"}`
- `POST /query` with `{"action":"list_year"}`

The API uses `Asia/Taipei` for today's date and returns at most 10 list items,
sorted by `created_at` from newest to oldest.
