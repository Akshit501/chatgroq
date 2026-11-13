import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Load environment variables from .env
load_dotenv()

def main() -> None:
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        print("⚠️  Error: GROQ_API_KEY is not set.")
        return

    # Initialize the LLM
    llm = ChatGroq(
        model="openai/gpt-oss-120b",
        api_key=api_key,
        temperature=0.7,
    )

    # =========================================================================
    # CHAIN 1: Ideation Chain (Topic -> Catchy Product Name)
    # =========================================================================
    prompt1 = ChatPromptTemplate.from_template(
        "Generate ONE catchy, creative, and futuristic brand name for a product based on this idea: '{topic}'. "
        "Return ONLY the brand name, nothing else."
    )
    chain1 = prompt1 | llm | StrOutputParser()

    # =========================================================================
    # CHAIN 2: Marketing Chain (Product Name -> Sales Pitch)
    # =========================================================================
    prompt2 = ChatPromptTemplate.from_template(
        "You are an expert copywriter. Write an exciting 2-sentence sales pitch for a new product called '{product_name}'."
    )
    chain2 = prompt2 | llm | StrOutputParser()

    # =========================================================================
    # MASTER CHAIN: Chaining Chain 1 directly into Chain 2!
    # Data flow:
    #   {"topic": ...}
    #       │
    #       ▼
    #   chain1 generates the product_name
    #       │
    #       ▼
    #   {"product_name": chain1} feeds into chain2
    #       │
    #       ▼
    #   chain2 generates the final sales pitch!
    # =========================================================================
    master_chain = (
        {"product_name": chain1} 
        | chain2
    )

    # Let's run it!
    user_topic = "smart glasses that translate foreign street signs in real time"

    print("=" * 60)
    print(f"INPUT TOPIC:\n  {user_topic}")
    print("=" * 60)

    # Demonstration A: Running Chain 1 by itself
    print("\n--- Running Chain 1 (Idea -> Name) ---")
    generated_name = chain1.invoke({"topic": user_topic}).strip()
    print(f"Result from Chain 1:\n  👉 {generated_name}\n")

    # Demonstration B: Running Chain 2 by itself
    print("--- Running Chain 2 (Name -> Pitch) ---")
    pitch = chain2.invoke({"product_name": generated_name})
    print(f"Result from Chain 2:\n  👉 {pitch}\n")

    # Demonstration C: Running the MASTER CHAIN (Both steps in 1 single call!)
    print("=" * 60)
    print("--- Running MASTER CHAIN (All steps connected automatically) ---")
    print("=" * 60)
    final_output = master_chain.invoke({"topic": "shoes that generate electricity while you walk"})
    print(final_output)

if __name__ == "__main__":
    main()
