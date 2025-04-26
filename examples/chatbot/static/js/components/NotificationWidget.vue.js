// static/js/components/NotificationWidget.vue.js
const { ref, onMounted, onUnmounted } = Vue;

const NotificationWidget = {
  setup() {
    const notifications = ref([]); // { id: string, message: string }
    const isVisible = ref(true); // Controls widget visibility
    const ws = ref(null); // WebSocket instance

    const connectWebSocket = () => {
      // Adjust protocol based on http/https
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/notifications`;

      console.log("Attempting to connect WebSocket:", wsUrl);
      ws.value = new WebSocket(wsUrl);

      ws.value.onopen = () => {
        console.log("WebSocket connected for notifications.");
        // Maybe request initial notifications if backend supports it
      };

      ws.value.onmessage = (event) => {
        try {
          const notificationData = JSON.parse(event.data);
          // Add unique ID if not provided by backend (or use backend's ID)
          const newNotification = {
            id: notificationData.id || `notif-${Date.now()}`, // Use backend ID if available
            message: notificationData.message,
          };
          console.log("Received notification:", newNotification);
          notifications.value.unshift(newNotification); // Add to top
        } catch (error) {
          console.error("Failed to parse notification:", event.data, error);
        }
      };

      ws.value.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Optional: Implement reconnection logic here
      };

      ws.value.onclose = (event) => {
        console.log("WebSocket disconnected:", event.reason);
        ws.value = null;
        // Optional: Attempt to reconnect after a delay
        // setTimeout(connectWebSocket, 5000); // Reconnect after 5s
      };
    };

    const closeNotification = (id) => {
      notifications.value = notifications.value.filter((n) => n.id !== id);
    };

    const clearAllNotifications = () => {
      notifications.value = [];
    };

    const toggleVisibility = () => {
      isVisible.value = !isVisible.value;
    };

    // Lifecycle hooks
    onMounted(() => {
      connectWebSocket();
    });

    onUnmounted(() => {
      if (ws.value) {
        ws.value.close();
        console.log("WebSocket connection closed on component unmount.");
      }
    });

    return {
      notifications,
      isVisible,
      toggleVisibility,
      closeNotification,
      clearAllNotifications,
    };
  },
  template: `
        <div class="notification-widget-container">
            <button @click="toggleVisibility" class="toggle-button sticky-toggle">
                {{ isVisible ? 'Hide' : 'Show' }} Notifications ({{ notifications.length }})
            </button>
            <div v-show="isVisible" class="notification-list">
                 <div v-if="notifications.length > 0" class="notification-controls">
                     <button @click="clearAllNotifications" class="clear-all-btn">Clear All</button>
                 </div>
                <div v-if="notifications.length === 0" class="no-notifications">
                    No new notifications.
                </div>
                <ul>
                    <li v-for="n in notifications" :key="n.id" class="notification-item">
                        <span>{{ n.message }}</span>
                        <button @click="closeNotification(n.id)" class="close-btn">X</button>
                    </li>
                </ul>
            </div>
        </div>
    `,
};

export default NotificationWidget;
