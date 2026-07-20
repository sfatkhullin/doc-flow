import sys
from services.parser import parse_file
from services.chunker import split_into_chunks
from services.llm import ask_gpt
from db.vector_store import save_chunks, search_similar


def index_document(file_path: str):
    doc_name = file_path.split("/")[-1]
    print(f"Reading file: {doc_name}")
    text = parse_file(file_path)
    print(f"Splitting into chunks...")
    chunks = split_into_chunks(text)
    print(f"  Created {len(chunks)} chunks")
    print(f"Saving to database...")
    save_chunks(chunks, doc_name)
    print("Done.")


def answer_question(question: str):
    print(f"\nSearching for answer to: '{question}'")
    relevant_chunks = search_similar(question, n_results=5)
    print(f"  Found {len(relevant_chunks)} relevant fragments")
    print(f"Generating answer...\n")
    answer = ask_gpt(question, relevant_chunks)
    print("=" * 60)
    print(answer)
    print("=" * 60)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage:")
        print("  python main.py index <file_path>")
        print('  python main.py ask "<question>"')
        sys.exit(1)

    command = sys.argv[1]
    argument = sys.argv[2]

    if command == "index":
        index_document(argument)
    elif command == "ask":
        answer_question(argument)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
