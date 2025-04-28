// static/js/components/NotificationWidget.vue.js
const { ref, computed } = Vue; // Removed onMounted/Unmounted

const NotificationWidget = {
  props: {
    notifications: { type: Array, default: () => [] }, // Receive notifications as prop
  },
  emits: ["close-notification", "clear-notifications"],
  setup(props, { emit }) {
    const isVisible = ref(true);

    // Use computed property for length if needed in template directly
    const notificationCount = computed(() => props.notifications.length);

    const toggleVisibility = () => {
      isVisible.value = !isVisible.value;
    };

    // Emit events for parent to handle state changes
    const closeNotification = (id) => {
      emit("close-notification", id);
    };

    const clearAllNotifications = () => {
      emit("clear-notifications");
    };

    // No WebSocket logic here anymore, parent handles it

    return {
      isVisible,
      toggleVisibility,
      closeNotification,
      clearAllNotifications,
      notificationCount, // Expose computed count
      // Use props.notifications directly in template
    };
  },
  template: `
        <div class="notification-widget-container">
            <button @click="toggleVisibility" class="toggle-button sticky-toggle">
                {{ isVisible ? 'Hide' : 'Show' }} Notifications ({{ notificationCount }})
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
