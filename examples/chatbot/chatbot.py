# chatbot_agent.py
from pydantic_ai import Agent
from pydantic_ai.models import Model
from pydantic_ai.messages import ModelMessage
from pydantic import BaseModel, Field
from typing import AsyncGenerator, List, Literal, Optional, TypedDict


# Assuming your message structure is consistent
class ChatMessage(TypedDict):
    """Format of messages sent to the browser."""
    role: Literal["user", "model"]
    timestamp: str
    content: str


# --- New Models for Notifications and Agent Response ---


class Notification(BaseModel):
    """
    Represents a notification to be displayed to the user.
    This model could be the arguments for a 'send_notification' function call.
    """

    title: str = Field(..., description="Title of the notification.")
    message: str = Field(..., description="Content of the notification.")
    type: str = Field(
        "info",
        description="Type of notification (e.g., 'info', 'success', 'warning', 'error').",
    )


class AgentResponse(BaseModel):
    """
    Represents the structured response from the chatbot agent,
    potentially including a text response and/or a notification.
    """

    response_text: Optional[str] = Field(
        None, description="The main text response to the user."
    )
    notification: Optional[Notification] = Field(
        None, description="Optional notification to display."
    )
    # In a real function calling scenario, you might have a field like:
    # function_call: Optional[Dict[str, Any]] = Field(None, description="Details if the agent wants to call a function.")


# --- Function the Agent Can "Call" (Simulated) ---


def send_notification(notification_data: Notification):
    """
    Simulates sending a notification to the user interface.
    In a real app, this might trigger a frontend event or update a DB status.
    """
    print(f"--- Simulating Notification ---")
    print(f"Title: {notification_data.title}")
    print(f"Message: {notification_data.message}")
    print(f"Type: {notification_data.type}")
    print(f"-----------------------------")
    # This function doesn't return anything the LLM needs, but performs an action.


class AIChatAgent:
    def __init__(self, model: Model, sys_prompt: str):
        self.agent = Agent(model=model, system_prompt=sys_prompt)

    def chat(self, user_message: str, chat_history: list[ModelMessage]) -> ChatMessage:
        """
        Generates a response based on the user message and chat history,
        potentially including a notification via simulated function calling.
        """
        print(f"Agent received message: {user_message}")
        print(f"Agent sees history: {chat_history}")

        # Default response structure
        agent_response = AgentResponse(response_text="Sorry, I didn't understand that.")

        # --- Simulated PydanticAI Function Calling Logic ---
        # In a real PydanticAI implementation:
        # 1. You would provide the definition of the `send_notification` function
        #    (or its schema derived from the Notification model) to the LLM via PydanticAI.
        # 2. The LLM would decide *if* it needs to call the function based on the user message.
        # 3. If it decides to call, it generates a structured output (e.g., JSON)
        #    conforming to the Notification model (the function arguments).
        # 4. PydanticAI would parse this output.
        # 5. Your code would detect the function call, validate arguments, and execute `send_notification`.
        # 6. You might then make another LLM call to get a user-facing text response *after* the action,
        #    or just return a confirmation.

        # --- Simulation: Check for a trigger phrase ---
        if "send a notification" in user_message.lower():
            print("Detected trigger phrase for notification.")
            # Simulate the LLM deciding to call the function and providing arguments
            notification_data = Notification(
                title="Action Complete",
                message="The requested action has been performed.",
                type="success",
            )

            # Simulate executing the function
            send_notification(notification_data)

            # Construct the response to the frontend
            # Include the notification payload
            agent_response = AgentResponse(
                response_text="Okay, I've sent a notification.",  # Optional text response
                notification=notification_data,
            )

        else:
            # --- Existing Placeholder Logic (if no notification triggered) ---
            # This part remains the same as before, returning just a text response.
            if "hello" in user_message.lower() or "hi" in user_message.lower():
                response_text = "Hello! How can I assist you today?"
            elif "recommend" in user_message.lower():
                response_text = (
                    "I can help with recommendations. What are you interested in?"
                )
            elif len(chat_history) > 0 and "hello" in chat_history[-1].text.lower():
                response_text = "Yes, I'm here to help!"
            else:
                response_text = f"You said: '{user_message}'. Tell me more!"

            agent_response = AgentResponse(response_text=response_text)
            # --- End Placeholder Logic ---

        # Return the structured AgentResponse
        return agent_response

    async def stream_chat(self, user_prompt: str, chat_history: list[ModelMessage]) -> AsyncGenerator[ChatMessage, None]: