// static/js/components/ChatBox.vue.js

// Use Vue's Composition API (assuming Vue is globally available)
const { ref, watch, nextTick } = Vue;

// --- Component Definition ---
const ChatBox = {
  props: {
    sessionId: String, // Receive selected session ID from parent
  },
  emits: [], // Define any events it might emit
  setup(props) {
    const messages = ref([]); // Holds messages for the current chat
    const currentInput = ref("");
    const isLoading = ref(false); // Indicate loading state
    const chatContainer = ref(null); // To scroll down automatically

    // --- Methods ---
    const scrollToBottom = () => {
      nextTick(() => {
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
      });
    };

    const fetchMessages = async (sessionId) => {
      if (!sessionId) {
        messages.value = [];
        return;
      }
      isLoading.value = true;
      try {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error("Failed to fetch messages");
        messages.value = await response.json();
        scrollToBottom();
      } catch (error) {
        console.error("Error fetching messages:", error);
        messages.value = [
          { role: "system", content: "Error loading chat history." },
        ];
      } finally {
        isLoading.value = false;
      }
    };

    const sendMessage = async () => {
      if (!currentInput.value.trim() || !props.sessionId || isLoading.value)
        return;

      const userMessage = { role: "user", content: currentInput.value };
      messages.value.push(userMessage); // Optimistic UI update
      const messageToSend = currentInput.value;
      currentInput.value = ""; // Clear input
      scrollToBottom();

      isLoading.value = true; // Indicate AI is "thinking"

      // Add placeholder for streaming assistant message
      const assistantMessage = { role: "assistant", content: "" };
      messages.value.push(assistantMessage);
      const assistantMessageIndex = messages.value.length - 1;

      try {
        const response = await fetch(`/api/chat/${props.sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: messageToSend }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamedContent += chunk;
          // Update the last message (assistant's) content incrementally
          messages.value[assistantMessageIndex].content = streamedContent;
          scrollToBottom(); // Keep scrolling as content streams
        }
        // Optional: Final decode call if there are remaining bytes
        // streamedContent += decoder.decode();
        // messages.value[assistantMessageIndex].content = streamedContent;

        console.log("Streaming complete.");
      } catch (error) {
        console.error("Error sending message or streaming response:", error);
        messages.value[
          assistantMessageIndex
        ].content = `Error: ${error.message}`;
      } finally {
        isLoading.value = false;
        scrollToBottom();
      }
    };

    // --- Watchers ---
    // Watch for changes in sessionId prop to load new chat history
    watch(
      () => props.sessionId,
      (newSessionId, oldSessionId) => {
        console.log(
          `ChatBox: Session changed from ${oldSessionId} to ${newSessionId}`
        );
        fetchMessages(newSessionId);
      },
      { immediate: true }
    ); // Run immediately on component mount if sessionId is already set

    // --- Template (as a string for this .js file example) ---
    // In a real .vue file, this would be in the <template> section
    const template = `
            <div class="chat-box-wrapper">
                <div class="messages-container" ref="chatContainer">
                    <div v-if="!sessionId" class="system-message">Select or create a session to start chatting.</div>
                    <div v-else-if="isLoading && messages.length === 0" class="system-message">Loading chat...</div>
                    <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
                        <span class="role-indicator">{{ msg.role === 'user' ? 'You' : 'AI' }}:</span>
                        <span class="content">{{ msg.content }}</span>
                         <span v-if="isLoading && msg.role === 'assistant' && index === messages.length - 1" class="typing-indicator">...</span>
                    </div>
                </div>
                <div class="input-area">
                    <input
                        type="text"
                        v-model="currentInput"
                        @keyup.enter="sendMessage"
                        placeholder="Type your message..."
                        :disabled="!sessionId || isLoading"
                    />
                    <button @click="sendMessage" :disabled="!sessionId || isLoading || !currentInput.trim()">Send</button>
                </div>
            </div>
        `;

    // --- Return values for the template ---
    return {
      messages,
      currentInput,
      isLoading,
      sendMessage,
      chatContainer, // Expose ref for template usage
      // fetchMessages is not directly called by template, but triggered by watcher
    };
  },
  // In a real .vue file, the template string above would be in <template>...</template>
  // For this JS file approach, we'll assign it (though this is not standard Vue practice)
  template: `
        <div class="chat-box-wrapper">
            <div class="messages-container" ref="chatContainer">
                <div v-if="!sessionId" class="system-message">Select or create a session to start chatting.</div>
                <div v-else-if="isLoading && messages.length === 0" class="system-message">Loading chat...</div>
                <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
                    <span class="role-indicator">{{ msg.role === 'user' ? 'You' : 'AI' }}:</span>
                    <pre class="content">{{ msg.content }}</pre> <span v-if="isLoading && msg.role === 'assistant' && index === messages.length - 1 && !msg.content" class="typing-indicator">...</span>
                </div>
            </div>
            <div class="input-area">
                <input
                    type="text"
                    v-model="currentInput"
                    @keyup.enter="sendMessage"
                    placeholder="Type your message..."
                    :disabled="!sessionId || isLoading"
                />
                <button @click="sendMessage" :disabled="!sessionId || isLoading || !currentInput.trim()">Send</button>
            </div>
        </div>
    `,
};

// Export the component definition (for use in main.js via import)
export default ChatBox;
