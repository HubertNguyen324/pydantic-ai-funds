// static/js/components/TopicListPanel.vue.js
const { ref, reactive, computed } = Vue; // No change in imports

const TopicListPanel = {
  props: {
    topics: { type: Array, default: () => [] },
    availableAgents: { type: Array, default: () => [] },
    currentSettings: { type: Object, required: true },
  },
  emits: ["create-topic", "select-topic", "delete-topic", "update-settings"],
  setup(props, { emit }) {
    const localSelectedTopicId = ref(null); // For styling list items only
    // Removed: showNewTopicModal, newTopicData refs

    // Computed properties for settings remain the same
    const settingsProxy = computed({
      /* ... keep as is ... */
    });
    const updateSetting = (key, value) => {
      /* ... keep as is ... */
      let parsedValue = value;
      if (key === "temperature" || key === "topP") {
        parsedValue = Number(value);
      } else if (key === "topK") {
        // Allow empty string or 0 to represent null/off
        parsedValue =
          value === "" || Number(value) === 0 ? null : Number(value);
      } else if (key === "topP") {
        parsedValue =
          value === "" || Number(value) === 0 ? null : Number(value);
      }
      // Ensure null is sent if value results in 0 for K/P
      if (key === "topK" && parsedValue === 0) parsedValue = null;
      if (key === "topP" && parsedValue === 0) parsedValue = null;

      emit("update-settings", { ...props.currentSettings, [key]: parsedValue });
    };

    // --- Topic Action Methods ---
    const selectTopic = (topicId) => {
      localSelectedTopicId.value = topicId;
      emit("select-topic", topicId);
    };

    const triggerDeleteTopic = (topicId, event) => {
      event.stopPropagation();
      if (confirm(`Delete topic ${topicId.substring(0, 8)}?`)) {
        emit("delete-topic", topicId);
      }
    };

    // MODIFIED: Directly trigger topic creation
    const triggerCreateTopic = () => {
      if (props.availableAgents.length > 0) {
        // Use the first available agent as default
        const defaultAgent = props.availableAgents[0];
        const defaultAgentId = defaultAgent.id;
        // Generate a default name (can be simpler)
        const defaultName = `Chat (${defaultAgent.name})`; // Or use timestamp
        console.log(
          `Requesting new topic with agent ${defaultAgentId} and name ${defaultName}`
        );
        emit("create-topic", { agent_id: defaultAgentId, name: defaultName });
      } else {
        alert("Agent list not loaded yet. Please wait and try again.");
        // Optionally disable the button if agents haven't loaded
      }
    };

    // Removed: openNewTopicModal, submitNewTopic methods

    // Format date helper remains the same
    const formatDate = (isoString) => {
      /* ... keep as is ... */
      if (!isoString) return "";
      const date = new Date(isoString);
      return date.toLocaleString();
    };

    return {
      localSelectedTopicId,
      selectTopic,
      triggerDeleteTopic,
      triggerCreateTopic, // Expose new method
      formatDate,
      settingsProxy,
      updateSetting,
      // Removed: showNewTopicModal, newTopicData
    };
  },
  // --- Template ---
  // Remove the modal div entirely
  template: `
        <div class="topic-list-container">
            <div class="topics-area">
                <h2>Chat Topics</h2>
                <button @click="triggerCreateTopic" class="add-topic-btn" :disabled="availableAgents.length === 0">
                    + New Topic
                </button>

                <ul v-if="topics.length > 0">
                    <li v-for="topic in topics"
                        :key="topic.id"
                        @click="selectTopic(topic.id)"
                        :class="{ selected: topic.id === localSelectedTopicId }"
                        class="topic-item">
                        <div class="topic-info">
                             <span class="topic-name">{{ topic.name }}</span>
                             <span class="topic-agent">Agent: {{ topic.agent_id.replace('agent_','') }}</span>
                             <span class="topic-date">{{ formatDate(topic.created_at) }}</span>
                        </div>
                        <button @click="triggerDeleteTopic(topic.id, $event)" class="delete-btn">X</button>
                    </li>
                </ul>
                <div v-else>No chat topics yet.</div>
            </div>

            <div class="agent-settings-area">
                <h3>Message Settings</h3>
                <p class="settings-info">Applied to next message in selected topic.</p>
                 <div class="setting-item slider-item">
                    <label for="temperature">Temp:</label> <input type="range" id="temperature" min="0" max="2" step="0.1"
                           :value="settingsProxy.temperature ?? 0.7" @input="updateSetting('temperature', $event.target.value)">
                    <span>{{ settingsProxy.temperature?.toFixed(1) ?? 'N/A' }}</span>
                </div>
                <div class="setting-item slider-item">
                    <label for="top-k">Top-K:</label> <input type="range" id="top-k" min="0" max="100" step="1"
                           :value="settingsProxy.topK ?? 0" @input="updateSetting('topK', $event.target.value)">
                     <span>{{ settingsProxy.topK ?? 'Off' }}</span>
                </div>
                 <div class="setting-item slider-item">
                    <label for="top-p">Top-P:</label> <input type="range" id="top-p" min="0" max="1" step="0.05"
                           :value="settingsProxy.topP ?? 0" @input="updateSetting('topP', $event.target.value)">
                     <span>{{ settingsProxy.topP?.toFixed(2) ?? 'Off' }}</span>
                </div>
            </div>

            </div>
    `,
};

export default TopicListPanel;
