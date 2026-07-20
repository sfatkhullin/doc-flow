import chromadb

client = chromadb.PersistentClient(path="./chroma_data")


def get_or_create_collection(name: str = "documents"):
    return client.get_or_create_collection(name=name)


def save_chunks(chunks: list[str], doc_name: str):
    collection = get_or_create_collection()
    ids = [f"{doc_name}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"source": doc_name, "chunk_index": i} for i in range(len(chunks))]
    collection.add(
        ids=ids,
        documents=chunks,
        metadatas=metadatas,
    )


def search_similar(query_text: str, n_results: int = 5, sources: list[str] = None) -> list[dict]:
    collection = get_or_create_collection()
    where_filter = {"source": {"$in": sources}} if sources else None
    results = collection.query(
        query_texts=[query_text],
        n_results=n_results,
        where=where_filter,
    )
    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        chunks.append({
            "text": doc,
            "source": results["metadatas"][0][i]["source"],
            "chunk_index": results["metadatas"][0][i]["chunk_index"],
        })
    return chunks


def list_documents() -> list[str]:
    collection = get_or_create_collection()
    results = collection.get(include=["metadatas"])
    sources = {m["source"] for m in results["metadatas"]}
    return sorted(list(sources))


def delete_document(doc_name: str):
    collection = get_or_create_collection()
    results = collection.get(where={"source": doc_name})
    if results["ids"]:
        collection.delete(ids=results["ids"])
