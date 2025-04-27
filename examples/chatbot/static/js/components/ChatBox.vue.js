// static/js/components/ChatBox.vue.js
const { ref, watch, nextTick } = Vue; // Keep imports

const ChatBox = {
  // --- Props ---
  // Receive session ID AND agent settings from parent
  props: {
    sessionId: String,
    agentId: String,
    temperature: Number,
    topK: Number, // Can be null
    topP: Number, // Can be null
  },
  emits: [],
  setup(props) {
    const messages = ref([]);
    const currentInput = ref("");
    const isLoading = ref(false);
    const chatContainer = ref(null);

    // --- Methods ---
    const scrollToBottom = () => {
      /* ... keep existing ... */
      nextTick(() => {
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
        }
      });
    };

    const fetchMessages = async (sessionId) => {
      /* ... keep existing ... */
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

    // MODIFIED: Include agent settings in the fetch body
    const sendMessage = async () => {
      if (!currentInput.value.trim() || !props.sessionId || isLoading.value)
        return;

      const userMessage = { role: "user", content: currentInput.value };
      messages.value.push(userMessage);
      const messageToSend = currentInput.value;
      currentInput.value = "";
      scrollToBottom();
      isLoading.value = true;

      const assistantMessage = { role: "assistant", content: "" };
      messages.value.push(assistantMessage);
      const assistantMessageIndex = messages.value.length - 1;

      try {
        // --- Prepare payload with settings ---
        const payload = {
          message: messageToSend,
          agent_id: props.agentId,
          temperature: props.temperature,
          top_k: props.topK,
          top_p: props.topP,
        };
        console.log("Sending chat message with payload:", payload); // Log for debugging

        const response = await fetch(`/api/chat/${props.sessionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), // Send the full payload
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Handle streaming response (keep existing logic)
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamedContent += chunk;
          messages.value[assistantMessageIndex].content = streamedContent;
          scrollToBottom();
        }
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

    // Watcher remains the same
    watch(
      () => props.sessionId,
      (newSessionId, oldSessionId) => {
        console.log(`ChatBox: Session changed to ${newSessionId}`);
        fetchMessages(newSessionId);
      },
      { immediate: true }
    );

    return {
      messages,
      currentInput,
      isLoading,
      sendMessage,
      chatContainer,
    };
  },
  // Template remains the same
  template: `
        <div class="chat-box-wrapper">
            <div class="messages-container" ref="chatContainer">
                <div v-if="!sessionId" class="system-message">Select or create a session to start chatting.</div>
                <div v-else-if="isLoading && messages.length === 0" class="system-message">Loading chat...</div>
                <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
                    <span class="role-indicator">{{ msg.role === 'user' ? 'You' : 'AI' }}:</span>
                    <pre class="content">{{ msg.content }}</pre>
                     <span v-if="isLoading && msg.role === 'assistant' && index === messages.length - 1 && !msg.content" class="typing-indicator">...</span>
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

export default ChatBox;
