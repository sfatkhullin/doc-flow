def split_into_chunks(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Нарезает текст на куски по chunk_size слов.
    overlap — сколько слов повторяется между соседними кусками,
    чтобы не терять контекст на границах.
    """
    words = text.split()
    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap  # сдвигаемся с учётом перекрытия

    return chunks
