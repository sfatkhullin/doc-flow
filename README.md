# wunderDocs — ИИ-поиск по корпоративным документам

## Быстрый старт

### 1. Установка зависимостей
```bash
cd backend
pip install -r requirements.txt
```

### 2. Настройка окружения
Открой файл `backend/.env` и вставь свой deepseek ключ:
```
OPENAI_API_KEY=sk-your-key-here
```

### 3. Запуск сервера
```bash
cd backend
python run.py
```

Сервер запустится на http://localhost:8000

### 4. Документация API
Открой в браузере: http://localhost:8000/docs

---

## API эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| GET | / | Проверка что сервер работает |
| POST | /documents/upload | Загрузить документ (PDF/DOCX) |
| GET | /documents/ | Список загруженных документов |
| DELETE | /documents/{filename} | Удалить документ |
| POST | /chat/ask | Задать вопрос |

---

## Пример запроса к /chat/ask

```json
POST /chat/ask
{
  "question": "Каков порядок согласования договора?",
  "n_results": 5
}
```

Ответ:
```json
{
  "answer": "Согласно регламенту...",
  "sources": [
    {
      "text": "...",
      "source": "reglament.pdf",
      "chunk_index": 3
    }
  ],
  "question": "Каков порядок согласования договора?"
}
```

---

## Структура проекта

```
wunderDocs/
└── backend/
    ├── run.py                  # запуск сервера
    ├── main.py                 # запуск из командной строки
    ├── requirements.txt
    ├── .env                    # API ключи (не коммитить в git!)
    ├── api/
    │   ├── app.py              # FastAPI приложение
    │   └── routes/
    │       ├── documents.py    # загрузка/удаление документов
    │       └── chat.py         # вопрос-ответ
    ├── services/
    │   ├── parser.py           # читает PDF/DOCX
    │   ├── chunker.py          # нарезает текст
    │   ├── embedder.py         # делает векторы
    │   └── llm.py              # общается с GPT
    └── db/
        └── vector_store.py     # ChromaDB
```
