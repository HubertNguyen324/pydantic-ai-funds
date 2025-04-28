// static/js/components/NotificationWidget.vue.js

// Assuming Vue is loaded globally via a script tag in your HTML
const { ref, computed } = Vue;

const NotificationWidget = {
  // Define the properties this component expects from its parent
  props: {
    notifications: { type: Array, default: () => [] }, // Array of notification objects { id, message, type }
  },
  // Define the custom events this component can emit
  emits: ["close-notification", "clear-notifications"],

  // The setup function is where you define reactive state, computed properties, and methods
  setup(props, { emit }) {
    // Reactive reference to control the visibility of the notification list
    const isVisible = ref(true);

    // Computed property to get the number of notifications
    const notificationCount = computed(() => props.notifications.length);

    // Function to toggle the visibility of the notification list
    const toggleVisibility = () => {
      isVisible.value = !isVisible.value;
    };

    // Function to emit the 'close-notification' event to the parent
    const closeNotification = (id) => {
      emit("close-notification", id);
    };

    // Function to emit the 'clear-notifications' event to the parent
    const clearAllNotifications = () => {
      emit("clear-notifications");
    };

    // Return the reactive state, computed properties, and methods to be used in the template
    return {
      isVisible, // Visibility state
      toggleVisibility, // Method to toggle visibility
      closeNotification, // Method to close a single notification
      clearAllNotifications, // Method to clear all notifications
      notificationCount, // Computed property for the count
      // The notifications prop is used directly in the template
    };
  },

  // --- Template ---
  // The HTML structure for the NotificationWidget component
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
          <li v-for="n in notifications" :key="n.id" :class="['notification-item', n.type]">
            <span>{{ n.message }}</span>
            <button @click="closeNotification(n.id)" class="close-btn">X</button>
          </li>
        </ul>
      </div>
    </div>
  `,
};

// Export the component definition
export default NotificationWidget;
