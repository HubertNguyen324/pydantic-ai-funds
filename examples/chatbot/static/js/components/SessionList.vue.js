// static/js/components/SessionList.vue.js
const { ref, onMounted, computed } = Vue; // Add computed

const SessionList = {
  // --- Props ---
  // Receive agent settings and data from parent
  props: {
    availableAgents: { type: Array, default: () => [] },
    // Use modelValue convention for v-model
    selectedAgentId: String,
    temperature: Number,
    topK: Number, // Can be null
    topP: Number, // Can be null
  },
  // --- Emits ---
  // Emit selection AND updates for v-model bindings
  emits: [
    "select-session",
    "update:selectedAgentId",
    "update:temperature",
    "update:topK",
    "update:topP",
  ],
  setup(props, { emit }) {
    const sessions = ref([]);
    const isLoadingSessions = ref(false);
    const localSelectedSessionId = ref(null); // Only for styling list items

    // --- Computed properties to handle potential null values for sliders ---
    // Provide default values if props are null/undefined, needed for sliders
    const currentTemp = computed({
      get: () => props.temperature ?? 0.7,
      set: (val) => emit("update:temperature", Number(val)), // Ensure number
    });
    const currentTopK = computed({
      get: () => props.topK ?? 0, // Use 0 if null for slider, backend handles 0/null
      set: (val) => emit("update:topK", val === 0 ? null : Number(val)), // Send null if slider is at 0
    });
    const currentTopP = computed({
      get: () => props.topP ?? 0, // Use 0 if null for slider
      set: (val) =>
        emit("update:topP", val === 0 ? null : Number(val.toFixed(2))), // Send null if slider is at 0, format
    });
    const currentAgentId = computed({
      get: () => props.selectedAgentId,
      set: (val) => emit("update:selectedAgentId", val),
    });

    // --- Methods ---
    const fetchSessions = async () => {
      isLoadingSessions.value = true;
      try {
        const response = await fetch("/api/sessions");
        if (!response.ok) throw new Error("Failed to fetch sessions");
        sessions.value = await response.json();
      } catch (error) {
        console.error("Error fetching sessions:", error);
      } finally {
        isLoadingSessions.value = false;
      }
    };

    const addSession = async () => {
      // isLoadingSessions.value = true; // Maybe separate loading state?
      try {
        const response = await fetch("/api/sessions", { method: "POST" });
        if (!response.ok)
          throw new Error(`Failed to create session (${response.status})`);
        const newSession = await response.json();
        sessions.value.unshift(newSession);
        selectSession(newSession.id); // Automatically select
      } catch (error) {
        console.error("Error creating session:", error);
      } finally {
        // isLoadingSessions.value = false;
      }
    };

    const deleteSession = async (sessionId, event) => {
      event.stopPropagation();
      if (
        !confirm(
          `Are you sure you want to delete session ${sessionId.substring(
            0,
            8
          )}?`
        )
      )
        return;
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 204)
          throw new Error("Failed to delete session");
        sessions.value = sessions.value.filter((s) => s.id !== sessionId);
        if (localSelectedSessionId.value === sessionId) {
          selectSession(null); // Deselect if deleted
        }
      } catch (error) {
        console.error("Error deleting session:", error);
      }
    };

    const selectSession = (sessionId) => {
      console.log("SessionList: Selecting session:", sessionId);
      localSelectedSessionId.value = sessionId; // Update local styling state
      emit("select-session", sessionId); // Emit to parent
    };

    // Fetch sessions when the component mounts
    onMounted(fetchSessions);

    // --- Return values for template ---
    return {
      sessions,
      isLoadingSessions,
      localSelectedSessionId, // Use this for styling only
      addSession,
      deleteSession,
      selectSession,
      fetchSessions,

      // Use computed properties for bindings
      currentAgentId,
      currentTemp,
      currentTopK,
      currentTopP,
    };
  },
  // --- Template ---
  // Add the settings section at the bottom
  template: `
        <div class="session-list-container">
            <div class="sessions-area"> <h2>Chat Sessions</h2>
                <button @click="addSession" :disabled="isLoadingSessions" class="add-session-btn">
                    + New Chat
                </button>
                <div v-if="isLoadingSessions && sessions.length === 0">Loading sessions...</div>
                <ul v-else-if="sessions.length > 0">
                    <li v-for="session in sessions"
                        :key="session.id"
                        @click="selectSession(session.id)"
                        :class="{ selected: session.id === localSelectedSessionId }"
                        class="session-item">
                        <span class="session-name">{{ session.name || 'Unnamed Session' }}</span>
                        <button @click="deleteSession(session.id, $event)" class="delete-btn">X</button>
                    </li>
                </ul>
                <div v-else-if="!isLoadingSessions">No sessions yet. Create one!</div>
            </div>

            <div class="agent-settings-area">
                <h3>AI Agent Settings</h3>

                <div class="setting-item">
                    <label for="agent-select">Agent:</label>
                    <select id="agent-select" v-model="currentAgentId">
                         <option disabled value="">Loading...</option>
                        <option v-for="agent in availableAgents" :key="agent.id" :value="agent.id">
                            {{ agent.name }}
                        </option>
                    </select>
                </div>

                <div class="setting-item slider-item">
                    <label for="temperature">Temperature:</label>
                    <input type="range" id="temperature" min="0" max="2" step="0.1" v-model="currentTemp">
                    <span>{{ currentTemp.toFixed(1) }}</span>
                </div>

                <div class="setting-item slider-item">
                    <label for="top-k">Top-K:</label>
                    <input type="range" id="top-k" min="0" max="100" step="1" v-model="currentTopK">
                    <span>{{ currentTopK === 0 ? 'Off' : currentTopK }}</span> </div>

                 <div class="setting-item slider-item">
                    <label for="top-p">Top-P:</label>
                    <input type="range" id="top-p" min="0" max="1" step="0.05" v-model="currentTopP">
                     <span>{{ currentTopP === 0 ? 'Off' : currentTopP.toFixed(2) }}</span> </div>
            </div>
        </div>
    `,
};

export default SessionList;
