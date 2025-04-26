// static/js/components/SessionList.vue.js
const { ref, onMounted } = Vue;

const SessionList = {
  // Define emits to notify parent about session selection
  emits: ["select-session"],
  setup(props, { emit }) {
    // Destructure emit from context
    const sessions = ref([]); // { id: string, name: string }
    const isLoading = ref(false);
    const selectedSessionId = ref(null); // Track selection locally for styling

    const fetchSessions = async () => {
      isLoading.value = true;
      try {
        const response = await fetch("/api/sessions");
        if (!response.ok) throw new Error("Failed to fetch sessions");
        sessions.value = await response.json();
      } catch (error) {
        console.error("Error fetching sessions:", error);
        // Handle error display if needed
      } finally {
        isLoading.value = false;
      }
    };

    const addSession = async () => {
      isLoading.value = true;
      try {
        // Verify this URL and method:
        const response = await fetch("/api/sessions", { method: "POST" });
        if (!response.ok)
          throw new Error(`Failed to create session (${response.status})`); // Add status code
        const newSession = await response.json();
        sessions.value.unshift(newSession);
        selectSession(newSession.id);
      } catch (error) {
        console.error("Error creating session:", error);
      } finally {
        isLoading.value = false;
      }
    };

    const deleteSession = async (sessionId, event) => {
      event.stopPropagation(); // Prevent session selection when clicking delete
      if (
        !confirm(
          `Are you sure you want to delete session ${sessionId.substring(
            0,
            8
          )}?`
        )
      ) {
        return;
      }
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 204) {
          // 204 No Content is success
          throw new Error("Failed to delete session");
        }
        // Remove from local list
        sessions.value = sessions.value.filter((s) => s.id !== sessionId);
        // If the deleted session was selected, deselect it
        if (selectedSessionId.value === sessionId) {
          selectSession(null); // Deselect
        }
      } catch (error) {
        console.error("Error deleting session:", error);
      }
    };

    const selectSession = (sessionId) => {
      console.log("SessionList: Selecting session:", sessionId);
      selectedSessionId.value = sessionId; // Update local selection state
      emit("select-session", sessionId); // Emit event for parent component (main app)
    };

    // Fetch sessions when the component mounts
    onMounted(fetchSessions);

    return {
      sessions,
      isLoading,
      selectedSessionId,
      addSession,
      deleteSession,
      selectSession,
      fetchSessions, // Expose if needed externally (e.g., for refresh button)
    };
  },
  template: `
        <div class="session-list-container">
            <h2>Chat Sessions</h2>
            <button @click="addSession" :disabled="isLoading" class="add-session-btn">
                + New Chat
            </button>
            <div v-if="isLoading && sessions.length === 0">Loading sessions...</div>
            <ul v-else-if="sessions.length > 0">
                <li v-for="session in sessions"
                    :key="session.id"
                    @click="selectSession(session.id)"
                    :class="{ selected: session.id === selectedSessionId }"
                    class="session-item">
                    <span class="session-name">{{ session.name || 'Unnamed Session' }}</span>
                     <button @click="deleteSession(session.id, $event)" class="delete-btn">X</button>
                </li>
            </ul>
            <div v-else-if="!isLoading">No sessions yet. Create one!</div>
        </div>
    `,
};

export default SessionList;
