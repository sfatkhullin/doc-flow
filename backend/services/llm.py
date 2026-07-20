import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("LLM_BASE_URL"),
)

MODEL = os.getenv("LLM_MODEL", "deepseek-chat")


def ask_gpt(question: str, context_chunks: list[dict]) -> str:
    context_text = ""
    for i, chunk in enumerate(context_chunks, 1):
        context_text += f"\n[Фрагмент {i} из '{chunk['source']}']\n{chunk['text']}\n"

    system_prompt = """Ты — корпоративный ИИ-ассистент для поиска по документам.
Отвечай только на основе предоставленных фрагментов документов.
Если в фрагментах нет ответа — честно скажи об этом.
В конце ответа всегда указывай, из каких документов взята информация."""

    user_prompt = f"""Вопрос: {question}

Вот фрагменты из документов:
{context_text}

Ответь на вопрос, используя только информацию из этих фрагментов."""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content
