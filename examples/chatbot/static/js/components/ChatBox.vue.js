// static/js/components/ChatBox.vue.js

// Assuming Vue is loaded globally via a script tag in your HTML
const { ref, watch, nextTick, onUpdated } = Vue;

const ChatBox = {
  // Define the properties this component expects from its parent
  props: {
    topicId: String, // The ID of the currently selected topic
    topicName: String, // The name of the currently selected topic
    messages: { type: Array, default: () => [] }, // Array of message objects
    isLoadingHistory: Boolean, // Indicates if message history is being loaded
    isStreaming: Boolean, // Indicates if a message is currently streaming
  },
  // Define the custom events this component can emit
  emits: ["send-message"],

  // The setup function is where you define reactive state, computed properties, and methods
  setup(props, { emit }) {
    // Reactive reference for the current input text in the message box
    const currentInput = ref("");
    // Reactive reference to the messages container DOM element for scrolling
    const chatContainer = ref(null);

    // Function to scroll the chat container to the bottom
    const scrollToBottom = () => {
      // Use nextTick to ensure DOM updates are complete before scrolling
      nextTick(() => {
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
      });
    };

    // Handler for sending a message
    const handleSendMessage = () => {
      const messageText = currentInput.value.trim();
      // Prevent sending if message is empty, no topic is selected, or AI is streaming
      if (!messageText || !props.topicId || props.isStreaming) {
        console.warn("Send message prevented:", {
          messageTextEmpty: !messageText,
          noTopic: !props.topicId,
          isStreaming: props.isStreaming,
        });
        return;
      }
      // Emit the 'send-message' event to the parent component with the message text
      emit("send-message", messageText);
      // Clear the input field after sending
      currentInput.value = "";
      // Scroll to the bottom after the user sends a message (optimistic scroll)
      // The parent will add the message to the array, which will trigger the watcher/onUpdated scroll.
      // This initial scroll provides immediate feedback.
      scrollToBottom();
    };

    // Helper function to format ISO date strings into a readable format
    const formatDate = (isoString) => {
      if (!isoString) return "";
      try {
        const date = new Date(isoString);
        // Use toLocaleString for a user-friendly date/time format
        return date.toLocaleString();
      } catch (e) {
        console.error("Invalid date string:", isoString, e);
        return "Invalid Date";
      }
    };

    // Watcher: Scroll to bottom whenever the messages array or streaming state changes
    // This ensures the chat stays scrolled to the bottom as new messages or chunks arrive.
    watch(
      () => [props.messages, props.isStreaming],
      () => {
        console.log("Messages or streaming state changed, scrolling...");
        scrollToBottom();
      },
      {
        deep: true, // Deep watch is needed because we modify properties of objects within the messages array during streaming
        // immediate: true // Uncomment if you want to scroll immediately on initial load
      }
    );

    // Lifecycle Hook: Scroll to bottom after the component's DOM is updated
    // This provides an additional guarantee that scrolling happens after the DOM
    // reflects the latest state, useful for ensuring scroll after history load or initial render.
    onUpdated(() => {
      // console.log("ChatBox updated, scrolling...");
      scrollToBottom();
    });

    // Return the reactive state, computed properties, and methods to be used in the template
    return {
      currentInput, // The text in the input field
      chatContainer, // Reference to the messages container DOM element
      handleSendMessage, // Method to send a message
      formatDate, // Helper function for date formatting
      // Props are directly accessible in the template, no need to return them unless aliasing
      // topicId, topicName, messages, isLoadingHistory, isStreaming
    };
  },

  // --- Template ---
  // The HTML structure for the ChatBox component
  template: `
    <div class="chat-box-wrapper">
      <div class="chat-header">
        <h3>{{ topicName || 'Select a Topic' }}</h3>
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

// Export the component definition
export default ChatBox;
