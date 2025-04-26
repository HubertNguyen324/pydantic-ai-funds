import asyncio
import uuid
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, AsyncGenerator

# --- Configuration ---
app = FastAPI()

# Mount static files (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Setup Jinja2 templates
templates = Jinja2Templates(directory="templates")

# --- In-Memory Data Stores ---
# Store chat sessions: {session_id: [messages]}
# Message format: {'role': 'user' | 'assistant', 'content': '...'}
chat_sessions: Dict[str, List[Dict[str, str]]] = {}

# Store active WebSocket connections for notifications
# {connection_id: WebSocket} # Using connection_id for potential multi-user scaling later
active_connections: Dict[str, WebSocket] = {}


# --- Pydantic Models ---
class ChatMessageInput(BaseModel):
    message: str


class SessionInfo(BaseModel):
    id: str
    name: str  # Can derive from first message or use a default


class Notification(BaseModel):
    id: str
    message: str


# --- Helper Functions ---
async def notify_clients(message: str):
    """Sends a notification message to all connected WebSocket clients."""
    notification_id = str(uuid.uuid4())
    notification_data = Notification(id=notification_id, message=message).model_dump()
    # Use list(keys) to avoid issues if a connection drops during iteration
    connection_ids = list(active_connections.keys())
    for connection_id in connection_ids:
        websocket = active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_json(notification_data)
                print(f"Sent notification to {connection_id}")
            except Exception as e:
                print(f"Error sending notification to {connection_id}: {e}")
                # Remove broken connection if necessary (might be handled by disconnect)


async def simulate_ai_agent_task(session_id: str, user_message: str):
    """Simulates a background task performed by the AI agent."""
    print(f"Agent starting task for session {session_id} based on: '{user_message}'")
    await asyncio.sleep(5)  # Simulate work
    result_message = f"Task related to '{user_message[:20]}...' completed!"
    print(f"Agent finished task for session {session_id}")
    await notify_clients(result_message)  # Send result via notification system


async def ai_response_generator(
    session_id: str, user_message: str
) -> AsyncGenerator[str, None]:
    """Simulates a streaming AI response."""
    # 1. Add user message to history
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    chat_sessions[session_id].append({"role": "user", "content": user_message})

    # 2. Simulate triggering a potential background task (non-blocking)
    asyncio.create_task(simulate_ai_agent_task(session_id, user_message))

    # 3. Generate streamed response
    simulated_response = f"Okay, I received '{user_message}'. I'll start a task for that in the background. Meanwhile, let's chat..."
    assistant_message_content = ""
    for char in simulated_response:
        assistant_message_content += char
        yield char  # Stream character by character (or word by word)
        await asyncio.sleep(0.03)  # Simulate processing time between chunks

    # 4. Add full assistant response to history *after* streaming
    chat_sessions[session_id].append(
        {"role": "assistant", "content": assistant_message_content}
    )
    print(f"Session {session_id} updated: {chat_sessions[session_id]}")


# --- API Endpoints ---


# 1. Serve Frontend
@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    """Serves the main HTML page."""
    return templates.TemplateResponse("index.html", {"request": request})


# 2. Session Management
@app.get("/api/sessions", response_model=List[SessionInfo])
async def get_sessions():
    """Returns a list of active chat sessions."""
    sessions_info = []
    for session_id, messages in chat_sessions.items():
        # Simple naming convention for example
        name = f"Session {session_id[:8]}"
        if messages:
            name = (
                messages[0]["content"][:30] + "..."
                if len(messages[0]["content"]) > 30
                else messages[0]["content"]
            )
        sessions_info.append(SessionInfo(id=session_id, name=name))
    return sessions_info


@app.post("/api/sessions", response_model=SessionInfo, status_code=201)
async def create_session():
    """Creates a new, empty chat session."""
    session_id = str(uuid.uuid4())
    chat_sessions[session_id] = []
    print(f"Created new session: {session_id}")
    # Ensure SessionInfo model is used correctly here if you defined it
    return SessionInfo(id=session_id, name=f"New Session {session_id[:8]}")


@app.delete("/api/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str):
    """Deletes a chat session."""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        print(f"Deleted session: {session_id}")
        # Optionally notify clients about deletion if needed
    # No specific error handling here for simplicity, FastAPI handles 404 if not found implicitly


@app.get("/api/sessions/{session_id}", response_model=List[Dict[str, str]])
async def get_session_messages(session_id: str):
    """Gets the message history for a specific session."""
    return chat_sessions.get(session_id, [])


# 3. Chat Interaction (Streaming)
@app.post("/api/chat/{session_id}")
async def chat_endpoint(session_id: str, message_input: ChatMessageInput):
    """Handles incoming user messages and streams back the AI response."""
    if session_id not in chat_sessions:
        # Or create it on the fly:
        # chat_sessions[session_id] = []
        return {"error": "Session not found"}, 404  # Or handle differently

    # Use the generator for streaming response
    return StreamingResponse(
        ai_response_generator(session_id, message_input.message),
        media_type="text/plain",  # Send as plain text chunks
    )


# 4. WebSocket for Notifications
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    connection_id = str(uuid.uuid4())  # Assign unique ID to connection
    await websocket.accept()
    active_connections[connection_id] = websocket
    print(f"WebSocket connection established: {connection_id}")
    try:
        while True:
            # Keep connection alive, listening for potential messages from client (optional)
            # data = await websocket.receive_text()
            # print(f"Received from {connection_id}: {data}") # Example if client needs to send data
            await asyncio.sleep(60)  # Keep alive ping/pong might be better
    except WebSocketDisconnect:
        print(f"WebSocket connection closed: {connection_id}")
        del active_connections[connection_id]
    except Exception as e:
        print(f"WebSocket error for {connection_id}: {e}")
        if connection_id in active_connections:
            del active_connections[connection_id]
