# PLine Local Query API

Reads the local Dropbox-synced idea folder without writing to it.

## Start

```sh
npm start
```

The default address is `http://127.0.0.1:8787`.

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
