// static/js/components/ChatBox.vue.js
const { ref, watch, nextTick, onUpdated } = Vue; // Add onUpdated

const ChatBox = {
  props: {
    topicId: String,
    topicName: String,
    messages: { type: Array, default: () => [] }, // Receive messages directly
    isLoadingHistory: Boolean,
    isStreaming: Boolean,
  },
  emits: ["send-message"],
  setup(props, { emit }) {
    const currentInput = ref("");
    const chatContainer = ref(null);

    const scrollToBottom = () => {
      nextTick(() => {
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
      });
    };

    const handleSendMessage = () => {
      const messageText = currentInput.value.trim();
      if (!messageText || !props.topicId || props.isStreaming) {
        return;
      }
      emit("send-message", messageText);
      currentInput.value = ""; // Clear input after emitting
      // Don't modify messages array here, parent handles optimistic update
      scrollToBottom(); // Scroll after user sends
    };

    // Format date helper
    const formatDate = (isoString) => {
      if (!isoString) return "";
      try {
        const date = new Date(isoString);
        return date.toLocaleString();
      } catch (e) {
        return "Invalid Date";
      }
    };

    // Scroll to bottom whenever messages array updates OR isStreaming state changes
    watch(
      () => [props.messages, props.isStreaming],
      () => {
        scrollToBottom();
      },
      { deep: true }
    ); // Deep watch on messages needed if object properties change

    // Alternative/additional scroll trigger on component update
    onUpdated(() => {
      // This might be too frequent, but ensures scroll on updates
      scrollToBottom();
    });

    return {
      currentInput,
      chatContainer,
      handleSendMessage,
      formatDate,
      // Directly use props in template: topicId, topicName, messages, isLoadingHistory, isStreaming
    };
  },
  template: `
        <div class="chat-box-wrapper">
            <div class="chat-header"> <h3>{{ topicName || 'Select a Topic' }}</h3>
                <span v-if="topicId">ID: {{ topicId.substring(0,8) }}</span>
            </div>
            <div class="messages-container" ref="chatContainer">
                <div v-if="!topicId" class="system-message">Select or create a topic to start chatting.</div>
                <div v-else-if="isLoadingHistory" class="system-message">Loading history...</div>
                <div v-else-if="messages.length === 0 && !isLoadingHistory" class="system-message">
                    No messages yet in this topic. Send one!
                </div>
                <div v-for="(msg, index) in messages" :key="msg.timestamp + '-' + index" :class="['message', msg.role]">
                    <div class="message-header">
                         <span class="role-indicator">{{ msg.role === 'user' ? 'You' : 'AI' }}</span>
                         <span class="timestamp">{{ formatDate(msg.timestamp) }}</span>
                    </div>
                    <pre class="content">{{ msg.content }}</pre>
                    <span v-if="isStreaming && msg.role === 'assistant' && index === messages.length - 1" class="typing-indicator">...</span>
                </div>
            </div>
            <div class="input-area">
                <input
                    type="text"
                    v-model="currentInput"
                    @keyup.enter="handleSendMessage"
                    :placeholder="!topicId ? 'Select a topic first...' : (isStreaming ? 'AI is responding...' : 'Type your message...')"
                    :disabled="!topicId || isStreaming"
                />
                <button @click="handleSendMessage" :disabled="!topicId || isStreaming || !currentInput.trim()">
                    Send
                </button>
            </div>
        </div>
    `,
};

export default ChatBox;
