from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

_ef = DefaultEmbeddingFunction()


def get_embedding(text: str) -> list[float]:
    return _ef([text])[0]


def get_embeddings(texts: list[str]) -> list[list[float]]:
    return _ef(texts)
