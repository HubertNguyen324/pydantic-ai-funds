import asyncio
import uuid
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, AsyncGenerator, Optional  # Added Optional

# --- Configuration ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- In-Memory Data Stores ---
chat_sessions: Dict[str, List[Dict[str, str]]] = {}
active_connections: Dict[str, WebSocket] = {}

# --- NEW: Define Available Agents ---
available_agents = [
    {"id": "agent_default", "name": "Default Assistant"},
    {"id": "agent_creative", "name": "Creative Writer"},
    {"id": "agent_technical", "name": "Technical Explainer"},
]


# --- Pydantic Models ---
# MODIFIED: Add agent settings to chat input
class ChatMessageInput(BaseModel):
    message: str
    agent_id: str = available_agents[0]["id"]  # Default to first agent
    temperature: float = 0.7
    top_k: Optional[int] = None  # Use Optional for flexibility
    top_p: Optional[float] = None


class SessionInfo(BaseModel):
    id: str
    name: str


class Notification(BaseModel):
    id: str
    message: str


# NEW: Agent Info Model for API response
class AgentInfo(BaseModel):
    id: str
    name: str


# --- Helper Functions ---
async def notify_clients(message: str):
    # ... (keep existing implementation)
    notification_id = str(uuid.uuid4())
    notification_data = Notification(id=notification_id, message=message).model_dump()
    connection_ids = list(active_connections.keys())
    for connection_id in connection_ids:
        websocket = active_connections.get(connection_id)
        if websocket:
            try:
                await websocket.send_json(notification_data)
                print(f"Sent notification to {connection_id}")
            except Exception as e:
                print(f"Error sending notification to {connection_id}: {e}")


async def simulate_ai_agent_task(session_id: str, user_message: str):
    # ... (keep existing implementation)
    print(f"Agent starting task for session {session_id} based on: '{user_message}'")
    await asyncio.sleep(5)
    result_message = f"Task related to '{user_message[:20]}...' completed!"
    print(f"Agent finished task for session {session_id}")
    await notify_clients(result_message)


# MODIFIED: Accept agent settings in the generator
async def ai_response_generator(
    session_id: str,
    user_message: str,
    agent_id: str = available_agents[0]["id"],
    temperature: float = 0.7,
    top_k: Optional[int] = None,
    top_p: Optional[float] = None,
) -> AsyncGenerator[str, None]:
    """Simulates a streaming AI response using provided settings."""

    # Find agent name for display (optional)
    agent_name = next(
        (agent["name"] for agent in available_agents if agent["id"] == agent_id),
        "Unknown Agent",
    )

    # --- Log received settings ---
    print(f"--- Generating Response ---")
    print(f"Session ID: {session_id}")
    print(f"Agent: {agent_name} ({agent_id})")
    print(f"Temperature: {temperature}")
    print(f"Top-K: {top_k if top_k is not None else 'Default'}")
    print(f"Top-P: {top_p if top_p is not None else 'Default'}")
    print(f"User Message: {user_message}")
    print(f"-------------------------")

    # 1. Add user message to history
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    # Store settings with user message? Optional, depends if you want history to reflect settings used
    chat_sessions[session_id].append({"role": "user", "content": user_message})

    # 2. Simulate triggering a potential background task
    asyncio.create_task(simulate_ai_agent_task(session_id, user_message))

    # 3. Generate streamed response (incorporate settings in simulation)
    simulated_response = (
        f"Okay, I received '{user_message}'. "
        f"Acting as {agent_name} (Temp: {temperature:.1f}, "
        f"TopK: {top_k if top_k is not None else 'N/A'}, "
        f"TopP: {top_p if top_p is not None else 'N/A'}). "
        f"I'll start a task for that and stream this response..."
    )
    assistant_message_content = ""
    chunk_delay = max(0.01, 0.1 - (temperature * 0.05))  # Simulate temp effect on speed

    for char in simulated_response:
        assistant_message_content += char
        yield char
        await asyncio.sleep(chunk_delay)  # Simulate processing time

    # 4. Add full assistant response to history
    # Store settings with assistant message? Optional.
    chat_sessions[session_id].append(
        {"role": "assistant", "content": assistant_message_content}
    )
    print(f"Session {session_id} updated.")


# --- API Endpoints ---


# 1. Serve Frontend
@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# --- NEW: Endpoint to get available agents ---
@app.get("/api/agents", response_model=List[AgentInfo])
async def get_agents():
    """Returns the list of available AI agents."""
    return available_agents


# 2. Session Management
@app.get("/api/sessions", response_model=List[SessionInfo])
async def get_sessions():
    # ... (keep existing implementation)
    sessions_info = []
    for session_id, messages in chat_sessions.items():
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
    # ... (keep existing implementation)
    session_id = str(uuid.uuid4())
    chat_sessions[session_id] = []
    print(f"Created new session: {session_id}")
    return SessionInfo(id=session_id, name=f"New Session {session_id[:8]}")


@app.delete("/api/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str):
    # ... (keep existing implementation)
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        print(f"Deleted session: {session_id}")


@app.get("/api/sessions/{session_id}", response_model=List[Dict[str, str]])
async def get_session_messages(session_id: str):
    return chat_sessions.get(session_id, [])


# 3. Chat Interaction (Streaming)
# MODIFIED: Accept updated ChatMessageInput model
@app.post("/api/chat/{session_id}")
async def chat_endpoint(session_id: str, message_input: ChatMessageInput):
    """Handles incoming user messages and streams back the AI response using selected settings."""
    if session_id not in chat_sessions:
        return {"error": "Session not found"}, 404

    # Pass all relevant info from the input model to the generator
    return StreamingResponse(
        ai_response_generator(
            session_id,
            message_input.message,
            agent_id=message_input.agent_id,
            temperature=message_input.temperature,
            top_k=message_input.top_k,
            top_p=message_input.top_p,
        ),
        media_type="text/plain",
    )


# 4. WebSocket for Notifications
@app.websocket("/ws/notifications")
async def websocket_endpoint(websocket: WebSocket):
    # ... (keep existing implementation)
    connection_id = str(uuid.uuid4())  # Assign unique ID to connection
    await websocket.accept()
    active_connections[connection_id] = websocket
    print(f"WebSocket connection established: {connection_id}")
    try:
        while True:
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        print(f"WebSocket connection closed: {connection_id}")
        if connection_id in active_connections:  # Check before deleting
            del active_connections[connection_id]
    except Exception as e:
        print(f"WebSocket error for {connection_id}: {e}")
        if connection_id in active_connections:
            del active_connections[connection_id]
