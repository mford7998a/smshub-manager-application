import { Module } from 'vuex';
import { logger } from '../../utils/logger';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  timestamp: Date;
  timeout?: number;
  action?: {
    text: string;
    handler: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  maxNotifications: number;
}

const notificationsModule: Module<NotificationState, any> = {
  namespaced: true,

  state: {
    notifications: [],
    maxNotifications: 5
  },

  mutations: {
    addNotification(state, notification: Notification) {
      state.notifications.unshift(notification);
      if (state.notifications.length > state.maxNotifications) {
        state.notifications.pop();
      }
    },

    removeNotification(state, id: string) {
      state.notifications = state.notifications.filter(n => n.id !== id);
    },

    clearNotifications(state) {
      state.notifications = [];
    }
  },

  actions: {
    notify({ commit, rootState }, notification: Omit<Notification, 'id' | 'timestamp'>) {
      const id = Math.random().toString(36).substr(2, 9);
      const timestamp = new Date();

      // Check notification settings
      const notificationSettings = rootState.settings.notifications;
      if (!notificationSettings.enabled) return;
      if (notificationSettings.errorOnly && notification.type !== 'error') return;

      // Create notification
      const fullNotification: Notification = {
        ...notification,
        id,
        timestamp,
        timeout: notification.timeout || 5000
      };

      commit('addNotification', fullNotification);
      logger.info(`Notification added: ${notification.type} - ${notification.message}`);

      // Show desktop notification if enabled
      if (notificationSettings.desktop && ['error', 'warning'].includes(notification.type)) {
        this.dispatch('notifications/showDesktopNotification', fullNotification);
      }

      // Play sound if enabled
      if (notificationSettings.sound && ['error', 'warning'].includes(notification.type)) {
        this.dispatch('notifications/playNotificationSound', notification.type);
      }

      // Auto-remove notification after timeout
      if (fullNotification.timeout > 0) {
        setTimeout(() => {
          commit('removeNotification', id);
        }, fullNotification.timeout);
      }

      return id;
    },

    async showDesktopNotification({ rootState }, notification: Notification) {
      try {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
          new Notification(notification.title || 'SMSHub Manager', {
            body: notification.message,
            icon: '/icon.png'
          });
        } else if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification(notification.title || 'SMSHub Manager', {
              body: notification.message,
              icon: '/icon.png'
            });
          }
        }
      } catch (error) {
        logger.error('Failed to show desktop notification:', error);
      }
    },

    playNotificationSound({ rootState }, type: string) {
      try {
        const audio = new Audio(`/sounds/${type}.mp3`);
        audio.play();
      } catch (error) {
        logger.error('Failed to play notification sound:', error);
      }
    },

    remove({ commit }, id: string) {
      commit('removeNotification', id);
    },

    clear({ commit }) {
      commit('clearNotifications');
    }
  },

  getters: {
    activeNotifications: state => state.notifications,
    hasNotifications: state => state.notifications.length > 0,
    errorCount: state => state.notifications.filter(n => n.type === 'error').length
  }
};

export default notificationsModule; 