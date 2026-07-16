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
- `POST /query` with `{"action":"search","keyword":"網站"}`
- `POST /query` with `{"action":"get_item","index":1}`
- `POST /query` with `{"action":"update_item","index":1,"text":"..."}`
- `POST /query` with `{"action":"delete_item","index":1}`
- `POST /query` with `{"action":"search_category","category":"網站"}`
- `POST /query` with `{"action":"codex_task","index":1}`
- `POST /query` with `{"action":"record","text":"...","original_text":"...","category":"網站"}`

The API uses `Asia/Taipei` for today's date and returns at most 10 list items,
sorted by `created_at` from newest to oldest.
