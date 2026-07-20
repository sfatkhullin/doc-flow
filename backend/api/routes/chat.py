from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.llm import ask_gpt
from db.vector_store import search_similar

router = APIRouter()


class QuestionRequest(BaseModel):
    question: str
    n_results: int = 5
    sources: list[str] = None


class SourceChunk(BaseModel):
    text: str
    source: str
    chunk_index: int


class AnswerResponse(BaseModel):
    answer: str
    sources: list[SourceChunk]
    question: str


@router.post("/ask", response_model=AnswerResponse)
def ask_question(request: QuestionRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Вопрос не может быть пустым")

    try:
        relevant_chunks = search_similar(request.question, n_results=request.n_results, sources=request.sources)

        if not relevant_chunks:
            return AnswerResponse(
                answer="В загруженных документах не найдено информации по вашему вопросу.",
                sources=[],
                question=request.question,
            )

        answer = ask_gpt(request.question, relevant_chunks)

        return AnswerResponse(
            answer=answer,
            sources=[SourceChunk(**chunk) for chunk in relevant_chunks],
            question=request.question,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
