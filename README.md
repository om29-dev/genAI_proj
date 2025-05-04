# 🚀 AstroLog: Space Mission Query Chat

AstroLog is a web application that allows users to ask questions about a space mission database using natural language. It leverages Google's Gemini AI to convert user questions into SQL queries, executes them against an SQLite database, and displays the results in a user-friendly chat interface.

## ✨ Features

*   **Natural Language Queries:** Ask questions like "Show me missions by SpaceX in 2023" or "What were the launch locations in August?".
*   **AI-Powered SQL Generation:** Uses Google Gemini to translate questions into SQL queries.
*   **SQL Display:** Shows the generated SQL query alongside the results for transparency.
*   **Tabular Results:** Displays query results in a clear, formatted table.
*   **Chat History:** Maintains conversation history within the user's session.
*   **Clear Chat:** Option to clear the current chat session.
*   **Download Results:** Allows downloading the tabular results as an XLSX (Excel) file.
*   **Responsive Design:** Basic responsive layout using Bootstrap.

## 🛠️ Tech Stack

*   **Frontend:** React, JavaScript, Bootstrap
*   **Backend:** FastAPI, Python
*   **Database:** SQLite
*   **AI Model:** Google Gemini (via `google-generativeai` SDK)
*   **Data Handling:** Pandas (Backend)

## ⚙️ Setup & Installation

1.  **Backend Setup:**
    *   Create a virtual environment (recommended):

        ```bash
        python -m venv .venv
        ```
        For Linux:
        
        ```bash
        source .venv/bin/activate
        ``` 
        For Windows:

        ```powershell
        .venv\Scripts\activate
        ```
    *   Install Python dependencies:

        ```bash
        pip install -r requirements.txt
        ```
    *   Navigate to the backend directory: `cd backend`
    *   First run sql.py to load csv in database

        ```bash
        python sql.py
        ```
    *   **Create `.env` file:** In the `backend` directory, create a file named `.env` and add your credentials:

        ```dotenv
        GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
        SESSION_SECRET=GENERATE_A_STRONG_RANDOM_SECRET_KEY
        ```
    *   **Database:** Ensure the `missions.db` SQLite database file exists in the `backend` directory with the correct schema (see `GEMINI_SQL_PROMPT` in `main.py` for schema details).

2.  **Frontend Setup:**
    *   Navigate to the frontend directory: `cd ../frontend` (from backend) or `cd frontend` (from root)
    *   Install Node.js dependencies:

        ```bash
        npm i
        ```

3.  **Running the Application:**
    *   **Start the Backend:** In the `backend` directory (with the virtual environment activated):

        ```bash
        uvicorn main:app --reload --port 8000
        ```
    *   **Start the Frontend:** In the `frontend` directory:

        ```bash
        npm run dev
        ```
    *   Open your browser and navigate to `http://localhost:5173` (or the port specified by Vite/React).

## 📝 API Endpoints (Backend)

*   `GET /api/chat`: Retrieves the chat history for the current session.
*   `POST /api/chat`: Sends a user message, triggers AI SQL generation and execution, returns the bot's response.
*   `DELETE /api/chat`: Clears the chat history for the current session.
*   `GET /`: Basic API root endpoint.

## 🔑 Environment Variables

The backend requires the following environment variables set in a `.env` file within the `backend` directory:

*   `GOOGLE_API_KEY`: Your API key for Google AI Studio (Gemini).
*   `SESSION_SECRET`: A strong, random secret key used for signing session cookies.
