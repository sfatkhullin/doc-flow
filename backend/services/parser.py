import csv
import fitz  # PyMuPDF
from docx import Document


def parse_pdf(file_path: str) -> str:
    """Читает PDF и возвращает весь текст."""
    text = ""
    with fitz.open(file_path) as doc:
        for page in doc:
            text += page.get_text()
    return text.strip()


def parse_docx(file_path: str) -> str:
    """Читает DOCX и возвращает весь текст."""
    doc = Document(file_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def parse_txt(file_path: str) -> str:
    """Читает TXT и возвращает весь текст."""
    with open(file_path, encoding="utf-8", errors="replace") as f:
        return f.read().strip()


def parse_md(file_path: str) -> str:
    """Читает MD как обычный текст."""
    return parse_txt(file_path)


def parse_csv(file_path: str) -> str:
    """Читает CSV и возвращает текст в табличном виде."""
    rows = []
    with open(file_path, encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            rows.append(" | ".join(row))
    return "\n".join(rows)


def parse_file(file_path: str) -> str:
    """Автоматически определяет тип файла и читает его."""
    if file_path.endswith(".pdf"):
        return parse_pdf(file_path)
    elif file_path.endswith(".docx"):
        return parse_docx(file_path)
    elif file_path.endswith(".txt"):
        return parse_txt(file_path)
    elif file_path.endswith(".md"):
        return parse_md(file_path)
    elif file_path.endswith(".csv"):
        return parse_csv(file_path)
    else:
        raise ValueError(f"Неподдерживаемый формат файла: {file_path}")
