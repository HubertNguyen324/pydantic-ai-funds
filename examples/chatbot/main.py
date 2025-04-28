import asyncio
import uuid
import json  # For WebSocket messages
from datetime import datetime
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse  # Keep for serving index.html
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Dict, Any, AsyncGenerator, Optional

# --- Configuration ---
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# --- Agent Definition (Keep as before) ---
available_agents = [
    {"id": "agent_default", "name": "Default Assistant"},
    {"id": "agent_creative", "name": "Creative Writer"},
    {"id": "agent_technical", "name": "Technical Explainer"},
]

# --- Pydantic Models ---


# Represents a message in a chat topic history
class Message(BaseModel):
    role: str  # 'user' or 'assistant' or 'system'
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Represents a chat topic state
class ChatTopic(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    agent_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[Message] = []


# Represents the data stored per connected client
class ClientData(BaseModel):
    client_id: str
    topics: Dict[str, ChatTopic] = {}  # topic_id -> ChatTopic object


# --- In-Memory Data Store for Clients ---
# Maps client_id (from ConnectionManager) to their data
client_data_store: Dict[str, ClientData] = {}


# --- Connection Manager ---
class ConnectionManager:
    def __init__(self):
        # Maps client_id to WebSocket connection
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket) -> str:
        """Accepts a new connection, assigns a unique ID, and stores it."""
        await websocket.accept()
        client_id = str(uuid.uuid4())
        self.active_connections[client_id] = websocket
        # Initialize data store for this new client
        client_data_store[client_id] = ClientData(client_id=client_id)
        print(f"Client connected: {client_id}")
        return client_id

    def disconnect(self, client_id: str):
        """Removes a connection."""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        # Optionally remove client data, or keep it for potential reconnection?
        # For simplicity, let's remove it here.
        if client_id in client_data_store:
            del client_data_store[client_id]
        print(f"Client disconnected: {client_id}")

    async def send_personal_message(self, message: Dict, client_id: str):
        """Sends a JSON message to a specific client."""
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error sending message to {client_id}: {e}")
                # Consider disconnecting if send fails repeatedly

    async def broadcast(self, message: str):
        # Might not be needed with the current requirements, but good to have
        # Be careful with JSON structure if using send_json
        for client_id, websocket in self.active_connections.items():
            try:
                await websocket.send_text(message)  # Example using text
            except Exception as e:
                print(f"Error broadcasting to {client_id}: {e}")


manager = ConnectionManager()

# --- Helper Functions ---


# MODIFIED: Notify specific client via ConnectionManager
async def notify_client_task_completion(client_id: str, message: str):
    """Sends a task completion notification to a specific client."""
    notification_id = str(uuid.uuid4())
    notification_payload = {"id": notification_id, "message": message}
    await manager.send_personal_message(
        {"type": "notification", "payload": notification_payload}, client_id
    )
    print(f"Sent task completion notification to {client_id}")


# MODIFIED: Simulate task and notify originating client
async def simulate_ai_agent_task(
    client_id: str, topic_id: str, agent_id: str, user_message: str
):
    """Simulates a background task associated with a client/topic."""
    print(
        f"Agent '{agent_id}' starting task for client {client_id}, topic {topic_id} based on: '{user_message}'"
    )
    await asyncio.sleep(5)  # Simulate work
    result_message = f"Task from agent '{agent_id}' related to topic '{topic_id[:8]}' ('{user_message[:20]}...') completed!"
    print(f"Agent '{agent_id}' finished task for client {client_id}")
    await notify_client_task_completion(client_id, result_message)


# MODIFIED: AI Generator uses topic_id to find agent_id, accepts settings
async def ai_response_generator(
    client_id: str,
    topic_id: str,
    user_message_content: str,
    settings: Dict[str, Any],  # Contains temp, topk, topp
) -> AsyncGenerator[str, None]:
    """Generates streaming AI response for a given topic, using its fixed agent and current settings."""

    client_session_data = client_data_store.get(client_id)
    if not client_session_data:
        print(f"Error: Client data not found for {client_id}")
        yield json.dumps({"error": "Client session not found"})  # Send error chunk
        return

    topic = client_session_data.topics.get(topic_id)
    if not topic:
        print(f"Error: Topic {topic_id} not found for client {client_id}")
        yield json.dumps({"error": f"Chat topic {topic_id} not found"})
        return

    # --- Use FIXED agent_id from the topic ---
    agent_id = topic.agent_id
    agent_name = next(
        (agent["name"] for agent in available_agents if agent["id"] == agent_id),
        "Unknown Agent",
    )

    # --- Use CURRENT settings from the message request ---
    temperature = settings.get("temperature", 0.7)
    top_k = settings.get("top_k")  # Can be None
    top_p = settings.get("top_p")  # Can be None

    print(f"--- Generating Response (Client: {client_id}, Topic: {topic_id}) ---")
    print(f"Agent: {agent_name} ({agent_id}) [Fixed for Topic]")
    print(f"Settings (Current): Temp={temperature}, TopK={top_k}, TopP={top_p}")
    print(f"User Message: {user_message_content}")
    print(f"-----------------------------------")

    # 1. Add user message to history for this topic
    user_message = Message(role="user", content=user_message_content)
    topic.messages.append(user_message)

    # 2. Trigger background task (pass client_id for notification)
    asyncio.create_task(
        simulate_ai_agent_task(client_id, topic_id, agent_id, user_message_content)
    )

    # 3. Generate streamed response simulation
    simulated_response = (
        f"Okay, I received '{user_message_content}'. As agent {agent_name} for topic '{topic.name}', "
        f"using Temp={temperature:.1f}, TopK={top_k if top_k is not None else 'N/A'}, TopP={top_p if top_p is not None else 'N/A'}... "
        f"Streaming now."
    )
    assistant_message_content = ""
    chunk_delay = max(0.01, 0.1 - (temperature * 0.05))

    # Yield chunks back via WebSocket
    for char in simulated_response:
        assistant_message_content += char
        yield char  # Yield the character/chunk string
        await asyncio.sleep(chunk_delay)

    # 4. Add full assistant response to history *after* streaming
    assistant_message = Message(role="assistant", content=assistant_message_content)
    topic.messages.append(assistant_message)
    print(f"Topic {topic_id} updated for client {client_id}.")


# --- API Endpoints ---


# 1. Serve Frontend (Keep as is)
@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


# 2. Get Available Agents (Keep as is)
class AgentInfo(BaseModel):
    id: str
    name: str


@app.get("/api/agents", response_model=List[AgentInfo])
async def get_agents():
    return available_agents


# --- WebSocket Endpoint (Primary Communication Channel) ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = await manager.connect(websocket)
    client_session_data = client_data_store.get(client_id)  # Get reference

    if not client_session_data:
        print(f"CRITICAL: Failed to initialize data store for {client_id}")
        await websocket.close(code=1011)  # Internal error
        manager.disconnect(client_id)
        return

    # Send initial empty topic list or existing topics if persistence were added
    await manager.send_personal_message(
        {"type": "topic_list", "payload": []}, client_id
    )

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_type = message.get("type")
            payload = message.get("payload", {})

            print(f"Received from {client_id}: type={message_type}, payload={payload}")

            # --- Handle Different Message Types ---
            if message_type == "list_topics":
                topics_list = [
                    {
                        "id": t.id,
                        "name": t.name,
                        "agent_id": t.agent_id,
                        "created_at": t.created_at.isoformat(),
                    }
                    for t in client_session_data.topics.values()
                ]
                await manager.send_personal_message(
                    {"type": "topic_list", "payload": topics_list}, client_id
                )

            elif message_type == "create_topic":
                agent_id = payload.get("agent_id")
                topic_name = payload.get(
                    "name", f"Chat with {agent_id}"
                )  # Default name

                # Validate agent_id
                if not any(agent["id"] == agent_id for agent in available_agents):
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "payload": {"message": f"Invalid agent ID: {agent_id}"},
                        },
                        client_id,
                    )
                    continue

                new_topic = ChatTopic(name=topic_name, agent_id=agent_id)
                client_session_data.topics[new_topic.id] = new_topic
                print(
                    f"Client {client_id} created topic {new_topic.id} ({new_topic.name}) with agent {agent_id}"
                )

                # Send confirmation and updated list
                await manager.send_personal_message(
                    {
                        "type": "topic_created",
                        "payload": {
                            "id": new_topic.id,
                            "name": new_topic.name,
                            "agent_id": new_topic.agent_id,
                            "created_at": new_topic.created_at.isoformat(),
                        },
                    },
                    client_id,
                )
                # Send updated full list as well (or frontend can just add the new one)
                topics_list = [
                    {
                        "id": t.id,
                        "name": t.name,
                        "agent_id": t.agent_id,
                        "created_at": t.created_at.isoformat(),
                    }
                    for t in client_session_data.topics.values()
                ]
                await manager.send_personal_message(
                    {"type": "topic_list", "payload": topics_list}, client_id
                )

            elif message_type == "delete_topic":
                topic_id = payload.get("topic_id")
                if topic_id in client_session_data.topics:
                    del client_session_data.topics[topic_id]
                    print(f"Client {client_id} deleted topic {topic_id}")
                    # Send confirmation / new list
                    await manager.send_personal_message(
                        {"type": "topic_deleted", "payload": {"topic_id": topic_id}},
                        client_id,
                    )
                    topics_list = [
                        {
                            "id": t.id,
                            "name": t.name,
                            "agent_id": t.agent_id,
                            "created_at": t.created_at.isoformat(),
                        }
                        for t in client_session_data.topics.values()
                    ]
                    await manager.send_personal_message(
                        {"type": "topic_list", "payload": topics_list}, client_id
                    )
                else:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "payload": {
                                "message": f"Topic not found for deletion: {topic_id}"
                            },
                        },
                        client_id,
                    )

            elif message_type == "get_history":
                topic_id = payload.get("topic_id")
                topic = client_session_data.topics.get(topic_id)
                if topic:
                    history = [
                        {
                            "role": m.role,
                            "content": m.content,
                            "timestamp": m.timestamp.isoformat(),
                        }
                        for m in topic.messages
                    ]
                    await manager.send_personal_message(
                        {
                            "type": "history",
                            "payload": {"topic_id": topic_id, "messages": history},
                        },
                        client_id,
                    )
                else:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "payload": {
                                "message": f"Topic not found for history: {topic_id}"
                            },
                        },
                        client_id,
                    )

            elif message_type == "chat_message":
                topic_id = payload.get("topic_id")
                user_message_content = payload.get("message")
                settings = payload.get("settings", {})  # temp, topk, topp

                if not topic_id or not user_message_content:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "payload": {
                                "message": "Missing topic_id or message content"
                            },
                        },
                        client_id,
                    )
                    continue

                topic = client_session_data.topics.get(topic_id)
                if not topic:
                    await manager.send_personal_message(
                        {
                            "type": "error",
                            "payload": {
                                "message": f"Topic not found for chat: {topic_id}"
                            },
                        },
                        client_id,
                    )
                    continue

                # Add user message immediately (or let generator do it) - Generator adds it now.

                # Stream response back
                async for chunk in ai_response_generator(
                    client_id, topic_id, user_message_content, settings
                ):
                    await manager.send_personal_message(
                        {
                            "type": "message_chunk",
                            "payload": {"topic_id": topic_id, "chunk": chunk},
                        },
                        client_id,
                    )
                # Optionally send an 'end_of_stream' message
                await manager.send_personal_message(
                    {"type": "message_end", "payload": {"topic_id": topic_id}},
                    client_id,
                )

            else:
                print(f"Unknown message type from {client_id}: {message_type}")
                await manager.send_personal_message(
                    {
                        "type": "error",
                        "payload": {"message": f"Unknown command: {message_type}"},
                    },
                    client_id,
                )

    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        print(f"Error in WebSocket handler for {client_id}: {e}")
        # Attempt to send error to client before disconnecting if possible
        try:
            await manager.send_personal_message(
                {
                    "type": "error",
                    "payload": {"message": f"An internal error occurred: {str(e)}"},
                },
                client_id,
            )
        except:
            pass  # Ignore if sending fails during error handling
        manager.disconnect(client_id)
