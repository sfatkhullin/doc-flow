import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import PlainTextResponse
from services.parser import parse_file
from services.chunker import split_into_chunks
from db.vector_store import save_chunks, list_documents, delete_document

router = APIRouter()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".csv"}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Загружает файл, парсит, нарезает на чанки и сохраняет в векторную БД.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Неподдерживаемый формат. Разрешены: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Сохраняем файл на диск
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # Парсим текст
        text = parse_file(file_path)
        if not text.strip():
            raise HTTPException(status_code=422, detail="Не удалось извлечь текст из файла")

        # Нарезаем на чанки
        chunks = split_into_chunks(text)

        # Сохраняем в ChromaDB
        save_chunks(chunks, file.filename)

    except Exception as e:
        # Удаляем файл если что-то пошло не так
        os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

    file_size = os.path.getsize(file_path)

    return {
        "status": "success",
        "filename": file.filename,
        "file_size": file_size,
        "chunks_count": len(chunks),
        "message": f"Документ '{file.filename}' успешно проиндексирован",
    }


@router.get("/")
def get_documents():
    """Возвращает список всех загруженных документов."""
    filenames = list_documents()
    docs = []
    for name in filenames:
        file_path = os.path.join(UPLOAD_DIR, name)
        size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        docs.append({"filename": name, "size": size})
    return {"documents": docs, "total": len(docs)}


@router.delete("/{filename}")
def remove_document(filename: str):
    """Удаляет документ из индекса и с диска."""
    delete_document(filename)

    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"status": "success", "message": f"Документ '{filename}' удалён"}


@router.get("/{filename}/preview")
def preview_document(filename: str):
    """Возвращает текст документа для предпросмотра."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Неподдерживаемый формат")

    try:
        text = parse_file(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка чтения файла: {str(e)}")

    file_size = os.path.getsize(file_path)
    return {
        "filename": filename,
        "size": file_size,
        "text": text,
        "chars": len(text),
    }
