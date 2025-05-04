import os
import sqlite3
import logging
import socket
from contextlib import contextmanager
import pandas as pd
import google.generativeai as genai
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import uvicorn

load_dotenv(dotenv_path=".env")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Configure the AI model access
try:
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        raise ValueError("GOOGLE_API_KEY environment variable not set.")
    genai.configure(api_key=google_api_key)
except ValueError as e:
    logging.error(f"AI Configuration Error: {e}")

DATABASE_PATH = "missions.db"
SESSION_SECRET = os.getenv("SESSION_SECRET", "please_change_this_strong_secret")
if SESSION_SECRET == "please_change_this_strong_secret":
    logging.warning("Using default session secret. Please set a strong SESSION_SECRET environment variable.")

# Create the FastAPI app instance
app = FastAPI(
    title="Mission Control Chat API",
    description="API endpoint for the Space Mission SQL Chat application.",
    version="1.0.0"
)

# Middleware
# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET)


# Data Structures
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's message/question.")

class ChatMessage(BaseModel):
    role: str
    content: str
    columns: list[str] | None = None 
    rows: list[dict] | None = None    

class HistoryResponse(BaseModel):
    history: list[ChatMessage]

class NewMessageResponse(BaseModel):
    new: ChatMessage

# AI Prompt
GEMINI_SQL_PROMPT = """
You are an expert SQL generator AI. Your task is to convert English questions into valid SQLite queries for a database named MISSIONS, based *only* on the schema and rules provided.

Database Schema:
Table Name: MISSIONS
Columns:
- ORGANISATION (TEXT): The name of the company or agency (e.g., 'SpaceX', 'NASA', 'Roscosmos', 'ISRO', 'ULA', 'CASC', 'Arianespace').
- LOCATION (TEXT): The launch site location (e.g., 'LC-39A, Kennedy Space Center, Florida', 'Plesetsk Cosmodrome, Russia', 'Baikonur Cosmodrome, Kazakhstan', 'Satish Dhawan Space Centre, India', 'Guiana Space Centre, French Guiana').
- DATE (TEXT): The date of the launch (usually 'Day Mon DD, YYYY' format, e.g., 'Fri Aug 04, 2023'). Treat as text for LIKE comparisons.
- DETAIL (TEXT): A brief description or name of the mission/payload (e.g., 'Starlink Group 6-20', 'Crew-7', 'Soyuz MS-24'). Often contains rocket type.
- ROCKET_STATUS (TEXT): The current status of the rocket ('StatusActive' or 'StatusRetired').
- MISSION_STATUS (TEXT): The outcome of the mission ('Success', 'Failure', 'Partial Failure').

Query Generation Rules:
- Target Table: Always query the `MISSIONS` table. Do not invent tables or columns.
- Column Selection: Default to `SELECT *` unless specific columns are requested. Use `SELECT DISTINCT` for unique values if asked.
- Filtering (`WHERE` clause): Use `LIKE '%value%'` for flexible text matching (ORGANISATION, LOCATION, DETAIL, DATE). Use exact matches for statuses (ROCKET_STATUS, MISSION_STATUS). Combine conditions with `AND`. Map country names to likely ORGANISATION/LOCATION using `LIKE` and `OR`.
- Ordering (`ORDER BY`): Generally avoid ordering by the text `DATE` column as it's unreliable. Order by other columns if requested (`ORDER BY column ASC/DESC`).
- Aggregation (Counts, etc.): Do not use `COUNT(*)`, `SUM()`, etc. If asked "how many", select the relevant rows for the user to count (e.g., `SELECT * FROM MISSIONS WHERE ORGANISATION = 'SpaceX' AND MISSION_STATUS = 'Failure';`).
- Ambiguity: If a question can't be answered with the schema, respond with 'ERROR: Cannot answer this question with the available data (ORGANISATION, LOCATION, DATE, DETAIL, ROCKET_STATUS, MISSION_STATUS).'
- Output Format: Provide *only* the raw, valid SQLite query. No extra text, formatting, or semicolons at the end.

Examples:
Q: Show me all SpaceX missions in 2023
A: SELECT * FROM MISSIONS WHERE ORGANISATION = 'SpaceX' AND DATE LIKE '%2023%'
Q: List Indian missions
A: SELECT * FROM MISSIONS WHERE LOCATION LIKE '%INDIA%'
Q: How many missions did ISRO launch?
A: SELECT * FROM MISSIONS WHERE ORGANISATION = 'ISRO'
Q: List all unique launch locations.
A: SELECT DISTINCT LOCATION FROM MISSIONS\
"""

# Helper Functions
def is_internet_available():
    """
    Checks if there is an active internet connection.
    Returns:
        bool: True if internet is available, False otherwise.
    """
    try:
        # Try to connect to a well-known host (Google's public DNS server)
        socket.create_connection(("8.8.8.8", 53), timeout=5)
        logging.info("Internet connection detected.")
        return True
    except OSError:
        logging.error("No internet connection detected.")
        return False
    except Exception as e:
        logging.error(f"Error checking internet connection: {e}")
        return False

@contextmanager
def get_db_connection():
    """Safely connect to and close the database."""
    conn = None
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        yield conn
    except sqlite3.Error as e:
        logging.error(f"Database connection error: {e}")
        raise
    finally:
        if conn:
            conn.close()

def get_gemini_SQL_response(question: str) -> str:
    # Check for internet connectivity before calling the AI
    if not is_internet_available():
        raise ConnectionError("No internet connection available.")

    """Ask the AI model to turn the user's question into an SQL query."""
    logging.info(f"Sending question to Gemini: '{question}'")
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        full_prompt = GEMINI_SQL_PROMPT + "\n\nUser Question: " + question + "\nSQL Query:"
        response = model.generate_content(full_prompt)
        sql_query = response.text.strip()
        logging.info(f"Received SQL from Gemini: '{sql_query}'")

        # Basic checks for safety and validity
        if not sql_query or len(sql_query) < 5: 
             raise ValueError(f"Invalid SQL generated by AI: {sql_query}")

        if sql_query.startswith("ERROR:"):
            raise ValueError(f"AI could not answer: {sql_query}")

        forbidden_keywords = ['--', 'DROP', 'INSERT', 'UPDATE', 'DELETE']
        if any(keyword in sql_query.upper() for keyword in forbidden_keywords):
             raise ValueError(f"Potentially unsafe SQL generated (forbidden keyword detected): {sql_query}")

        return sql_query 

    except Exception as e:
        logging.error(f"Error getting response from Gemini: {e}")
        raise ConnectionError(f"Failed to get valid response from AI model: {e}") from e

def execute_sql_query(sql: str) -> pd.DataFrame:
    """Run the generated SQL query against the database."""
    logging.info(f"Executing SQL: '{sql}' on database '{DATABASE_PATH}'")
    try:
        with get_db_connection() as conn:
            df = pd.read_sql_query(sql, conn)
            logging.info(f"Query executed successfully, returned {len(df)} rows.")
            return df
    except sqlite3.Error as e:
        logging.error(f"Database error executing SQL '{sql}': {e}")
        raise ValueError(f"Database error: {e}") from e
    except Exception as e:
        logging.error(f"Unexpected error executing SQL '{sql}': {e}")
        raise ValueError(f"Failed to execute query: {e}") from e

# API Endpoints
@app.get("/api/chat", response_model=HistoryResponse, tags=["Chat"])
def get_chat_history(request: Request):
    """Get the current chat history for the user."""
    session = request.session
    if "history" not in session:
        session["history"] = []
    return {"history": session["history"]}

@app.post("/api/chat", response_model=NewMessageResponse, tags=["Chat"])
def handle_chat_message(chat_request: ChatRequest, request: Request):
    """Handle a new message from the user."""
    session = request.session
    if "history" not in session:
        session["history"] = []

    user_message_original = chat_request.message
    logging.info(f"Received user message: '{user_message_original}'")

    bot_message: ChatMessage | None = None
    sql_question = user_message_original

    logging.info(f"Attempting SQL generation for: '{sql_question}'")
    try:
        sql_query = get_gemini_SQL_response(sql_question)
        results_df = execute_sql_query(sql_query)

        bot_message = ChatMessage(
                role="bot",
                content=f"Generated SQL:\n```sql\n{sql_query}\n```",
                columns=results_df.columns.tolist(),
                rows=results_df.to_dict(orient="records")
            )
        logging.info(f"Successfully processed SQL-related message, returning {len(results_df)} results.")

    except (ValueError, ConnectionError) as e:
        if "No internet connection" in str(e):
            bot_message = ChatMessage(role="bot", content=f"You are not connected to the internet right now. Please connect to the internet to proceed.")
            return {"new": bot_message}

        logging.error(f"Error getting or validating SQL from AI: {e}")
        error_content = "Sorry, I encountered an issue generating or validating the SQL for your question."
        if "AI could not answer" in str(e) or isinstance(e, ConnectionError):
            error_content = f"Sorry, I cannot answer this question with the available data using SQL. Please ask about Organisation, Location, Date, Detail, Rocket Status, or Mission Status."
        elif "forbidden keyword" in str(e) :
             error_content = f"Sorry, the generated SQL query was potentially unsafe and was blocked."
        bot_message = ChatMessage(role="bot", content=error_content)

    except sqlite3.Error as e:
        logging.error(f"Database error executing SQL: {e}")
        bot_message = ChatMessage(role="bot", content=f"Sorry, there was a problem querying the database. The generated query might be invalid. (Details: {e})")
    except Exception as e:
        logging.exception(f"An unexpected error occurred during SQL processing: {e}")
        bot_message = ChatMessage(role="bot", content=f"An unexpected server error occurred while processing your SQL request.")
    return {"new": bot_message}

@app.delete("/api/chat", status_code=200, tags=["Chat"])
async def clear_chat_history(request: Request):
    """Clear the chat history for the current user."""
    session = request.session
    if "history" in session:
        session["history"] = []
        request.session['history'] = session['history']
        logging.info("Chat history cleared for session.")
        return {"message": "Chat history cleared successfully."}
    else:
        logging.info("No chat history found in session to clear.")
        return {"message": "No chat history to clear."}


@app.get("/", tags=["General"])
def read_root():
    """A simple endpoint to check if the API is running."""
    return {"message": "Welcome to the Mission Control Chat API!"}

if __name__ == "__main__":
    logging.info("Starting FastAPI server with uvicorn...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
