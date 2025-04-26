// app.js
// No named imports needed for createApp, ref, onMounted, watch when using the global Vue build
// import { createApp, ref, onMounted, watch } from 'https://unpkg.com/vue@3/dist/vue.global.js'; // Remove this line

// Import components
import ChatSessionList from "./components/ChatSessionList.js";
import ChatBox from "./components/ChatBox.js";
import NotificationArea from "./components/NotificationArea.js";
import NotificationToggleButton from "./components/NotificationToggleButton.js";

// Remove compatibility configuration for delimiters
// Vue.compatConfig = { MODE: 3 }; // Ensure Vue 3 mode
// Vue.configureCompat({
//     DELIMITER_SET: [['[[', ']]']]
// });

// --- Root Vue App ---
const App = {
  setup() {
    // Access ref, onMounted, and watch from the global Vue object
    const sessions = Vue.ref([]);
    const currentSessionId = Vue.ref(null);
    const currentSessionMessages = Vue.ref([]);
    const notifications = Vue.ref([]);
    const showNotifications = Vue.ref(true); // State to toggle notification area visibility

    // Fetch initial sessions on mount
    Vue.onMounted(async () => {
      await fetchSessions();
      // Select the initial session. The ID is passed from the Jinja2 template.
      // We need to get this value from the HTML itself now.
      const initialSessionIdElement = document.querySelector(
        'meta[name="initial-session-id"]'
      );
      const initialSessionId = initialSessionIdElement
        ? initialSessionIdElement.content
        : null;

      if (initialSessionId) {
        selectSession(initialSessionId);
      } else if (sessions.value.length > 0) {
        selectSession(sessions.value[0].id);
      }

      // Start polling for notifications
      pollNotifications();
    });

    // Watch for currentSessionId changes to fetch messages
    Vue.watch(currentSessionId, async (newSessionId) => {
      if (newSessionId) {
        await fetchMessages(newSessionId);
      } else {
        currentSessionMessages.value = [];
      }
    });

    const fetchSessions = async () => {
      try {
        const response = await fetch("/sessions");
        sessions.value = await response.json();
      } catch (error) {
        console.error("Error fetching sessions:", error);
      }
    };

    const fetchMessages = async (sessionId) => {
      try {
        const response = await fetch(`/sessions/${sessionId}/messages`);
        if (!response.ok) {
          // If session not found, maybe it was deleted elsewhere? Refresh sessions.
          if (response.status === 404) {
            console.warn(
              `Session ${sessionId} not found, refreshing sessions.`
            );
            await fetchSessions();
            // Try selecting the first available session if the current one is gone
            if (sessions.value.length > 0) {
              selectSession(sessions.value[0].id);
            } else {
              currentSessionId.value = null; // No sessions left
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        currentSessionMessages.value = await response.json();
      } catch (error) {
        console.error(
          `Error fetching messages for session ${sessionId}:`,
          error
        );
        currentSessionMessages.value = []; // Clear messages on error
      }
    };

    const selectSession = (sessionId) => {
      currentSessionId.value = sessionId;
    };

    const addSession = async () => {
      try {
        const response = await fetch("/sessions", { method: "POST" });
        const data = await response.json();
        await fetchSessions(); // Refresh the session list
        selectSession(data.session_id); // Select the new session
      } catch (error) {
        console.error("Error adding session:", error);
      }
    };

    const deleteSession = async (sessionId) => {
      if (sessions.value.length <= 1) {
        alert("Cannot delete the last session.");
        return;
      }
      if (confirm("Are you sure you want to delete this session?")) {
        try {
          const response = await fetch(`/sessions/${sessionId}`, {
            method: "DELETE",
          });
          if (response.ok) {
            await fetchSessions(); // Refresh the session list
            if (currentSessionId.value === sessionId) {
              // If the deleted session was the current one, select the first available session
              selectSession(
                sessions.value.length > 0 ? sessions.value[0].id : null
              );
            }
          } else {
            console.error("Error deleting session:", await response.text());
          }
        } catch (error) {
          console.error("Error deleting session:", error);
        }
      }
    };

    const sendMessage = async (message) => {
      if (!currentSessionId.value) return;

      // Add user message immediately to the UI
      currentSessionMessages.value.push({ sender: "user", text: message.text });

      try {
        const response = await fetch(
          `/sessions/${currentSessionId.value}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
          }
        );

        if (!response.ok) {
          // Handle session not found or other errors
          console.error("Error sending message:", await response.text());
          // Remove the last user message if sending failed
          currentSessionMessages.value.pop();
          // If session not found, refresh sessions and maybe select another one
          if (response.status === 404) {
            await fetchSessions();
            if (sessions.value.length > 0) {
              selectSession(sessions.value[0].id);
            } else {
              currentSessionId.value = null;
            }
          }
        } else {
          // Handle streaming AI response
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let receivedText = "";
          let aiMessageIndex = -1; // Index of the AI message in the messages array

          // Add a placeholder for the AI message
          currentSessionMessages.value.push({ sender: "ai", text: "" });
          aiMessageIndex = currentSessionMessages.value.length - 1;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            receivedText += decoder.decode(value, { stream: true });

            // Update the last AI message with the new chunk
            if (aiMessageIndex !== -1) {
              // Split by newline as the backend yields lines
              const lines = receivedText.split("\n");
              // Use the last complete line or the full text if no newline yet
              currentSessionMessages.value[aiMessageIndex].text =
                lines[lines.length - 1] || receivedText;
            }
          }
          // Ensure the final message is correctly set after streaming ends
          if (aiMessageIndex !== -1) {
            currentSessionMessages.value[aiMessageIndex].text =
              receivedText.trim();
          }
        }
      } catch (error) {
        console.error("Network or other error sending message:", error);
        // Remove the last user message if sending failed
        currentSessionMessages.value.pop();
      } finally {
        // The ChatBox component manages its own sending state based on the input field.
        // In a more complex app, you might manage a global sending state here.
      }
    };

    // Polling for notifications
    const pollNotifications = async () => {
      try {
        const response = await fetch("/notifications");
        notifications.value = await response.json();
      } catch (error) {
        console.error("Error polling notifications:", error);
      }
      // Poll every 5 seconds
      setTimeout(pollNotifications, 5000);
    };

    const removeNotification = async (notificationId) => {
      try {
        const response = await fetch(`/notifications/${notificationId}`, {
          method: "DELETE",
        });
        if (response.ok) {
          // Remove from local state
          notifications.value = notifications.value.filter(
            (n) => n.id !== notificationId
          );
        } else {
          console.error("Error removing notification:", await response.text());
        }
      } catch (error) {
        console.error("Error removing notification:", error);
      }
    };

    const clearAllNotifications = async () => {
      if (confirm("Are you sure you want to clear all notifications?")) {
        try {
          const response = await fetch("/notifications", { method: "DELETE" });
          if (response.ok) {
            // Clear local state
            notifications.value = [];
          } else {
            console.error(
              "Error clearing notifications:",
              await response.text()
            );
          }
        } catch (error) {
          console.error("Error clearing notifications:", error);
        }
      }
    };

    const toggleNotifications = () => {
      showNotifications.value = !showNotifications.value;
    };

    return {
      sessions,
      currentSessionId,
      currentSessionMessages,
      notifications,
      showNotifications,
      selectSession,
      addSession,
      deleteSession,
      sendMessage,
      removeNotification,
      clearAllNotifications,
      toggleNotifications,
    };
  },
};

// Register components
// Access createApp from the global Vue object
const app = Vue.createApp(App);
app.component("chat-session-list", ChatSessionList);
app.component("chat-box", ChatBox);
app.component("notification-area", NotificationArea);
app.component("notification-toggle-button", NotificationToggleButton);

// Mount the app
app.mount("#app");
