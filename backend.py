import os
import requests
from dotenv import load_dotenv
from langchain_pinecone import PineconeVectorStore
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from pinecone import Pinecone as PineconeClient
from langchain.schema.messages import HumanMessage
from langchain.prompts import PromptTemplate
from typing import List

#loading api keys
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
SERPER_API_KEY = os.getenv("SERPER_API_KEY")
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

#gemini and generativeAI Embeddings
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.2)
embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")

#pinecone backend
pinecone = PineconeClient(api_key=PINECONE_API_KEY)
index = pinecone.Index(PINECONE_INDEX_NAME)
vectorstore = PineconeVectorStore(index=index, embedding=embeddings, text_key="text")

#buffer memory for long conversations
memory = ConversationBufferMemory(
    return_messages=True,
    input_key="question",
    memory_key="chat_history"
)

#summary memory for context
summary: str = ""
history: List[str] = []

def update_summary(user_input, bot_response, max_tokens=500):
    global summary, history
    history.append(f"User: {user_input}\nBot: {bot_response}")
    combined = "\n\n".join(history)

    summarization_prompt = PromptTemplate.from_template("""
You are an AI assistant helping a user evaluate cities for relocation.
Extract only reusable insights from the chat:
- career field and job preferences
- lifestyle needs (climate, walkability, etc.)
- family requirements (schools, safety)
- housing constraints and budget
- discussed cities or neighborhoods
- transportation concerns
- remote/hybrid work setup
- cost of living or QoL comparisons

Discard irrelevant chit-chat or generic Q&A.

Conversation:
{history}

Summarized user preferences and key context:
""")

    messages = [HumanMessage(content=summarization_prompt.format(history=combined))]
    summary_response = llm.invoke(messages)
    summary = summary_response.content.strip()
    if len(summary.split()) > max_tokens:
        summary = " ".join(summary.split()[:max_tokens])

#check if web required
def needs_web_search(prompt: str) -> bool:
    prompt = prompt.lower()
    keywords = [
        "latest", "news", "current", "today", "weather", "recent", "happening", "real-time",
        "get articles", "give me articles", "fetch articles", "find articles", 
        "latest updates", "recent news", "recent updates", "any update", "recent info",
        "what's happening", "new info", "current trends"
    ]
    return any(key in prompt for key in keywords)

#serper api for web search
def search_web(query: str) -> str:
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"}
    payload = {"q": query}
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code == 200:
        results = response.json()
        snippets = []
        for item in results.get("organic", [])[:5]:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            link = item.get("link", "")
            snippets.append(f"{title}\n{snippet}\nURL: {link}")
        return "\n\n".join(snippets)
    else:
        return "Sorry, I couldn't fetch data from the web."

#memory and model chain
qa_chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=vectorstore.as_retriever(),
    memory=memory,
)

#output
print("City Relocation Chatbot (type 'exit' to quit)\n")

while True:
    user_input = input("You: ")
    if user_input.lower() in ["exit", "quit"]:
        print("Bot: Goodbye!")
        break

    if needs_web_search(user_input):
        print(">>> Fetching data from web...\n")
        enriched_query = user_input
        if summary:
            enriched_query = f"Context: {summary}\n\nUser Question: {user_input}"
        web_data = search_web(enriched_query)
        if not web_data or "couldn't fetch" in web_data.lower():
            answer = "Sorry, I couldn't retrieve the latest articles. Try rephrasing or check your internet connection."
        else:
            web_prompt = (
                "You are helping someone evaluate cities.\n\n"
                f"Real-time web information:\n{web_data}\n\n"
                f"User Question: {user_input}\n\n"
                f"Use the web data and context (if provided) to answer clearly. "
                "If the question is vague, use context to infer their intent."
            )
            response = llm.invoke([HumanMessage(content=web_prompt)])
            answer = response.content.strip()
    else:
        result = qa_chain.invoke({"question": user_input})
        answer = result["answer"]
        memory_denial_phrases = [
            "i don't have memory", "i have no memory", "each interaction starts fresh",
            "i don't retain information", "i don't remember", "i don’t have personal experiences",
            "i don't know", "i need more context", "i need more information"
        ]
        if any(phrase in answer.lower() for phrase in memory_denial_phrases):
            print(">>> Getting from memory...\n")
            repair_prompt = (
                "The user thinks you forgot earlier context.\n\n"
                f"Here's what you've learned so far:\n{summary}\n\n"
                f"Now answer this question using the above summary:\n\n{user_input}"
            )
            response = llm.invoke([HumanMessage(content=repair_prompt)])
            answer = response.content.strip()
    update_summary(user_input, answer)
    print("Bot:", answer)
    print()
