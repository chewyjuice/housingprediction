import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // in milliseconds, 0 for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      duration: notification.duration ?? 5000, // Default 5 seconds
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration (if not persistent)
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      addNotification,
      removeNotification,
      clearAll
    }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClose: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(onClose, 300); // Match animation duration
  };

  const getNotificationStyles = () => {
    const baseStyles = "relative p-4 rounded-lg shadow-lg border transition-all duration-300 transform";
    const visibilityStyles = isVisible && !isLeaving 
      ? "translate-x-0 opacity-100" 
      : "translate-x-full opacity-0";

    switch (notification.type) {
      case 'success':
        return `${baseStyles} ${visibilityStyles} bg-green-50 border-green-200 text-green-800`;
      case 'error':
        return `${baseStyles} ${visibilityStyles} bg-red-50 border-red-200 text-red-800`;
      case 'warning':
        return `${baseStyles} ${visibilityStyles} bg-yellow-50 border-yellow-200 text-yellow-800`;
      case 'info':
      default:
        return `${baseStyles} ${visibilityStyles} bg-blue-50 border-blue-200 text-blue-800`;
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className={getNotificationStyles()}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mr-3 mt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium">{notification.title}</h4>
          {notification.message && (
            <p className="mt-1 text-sm opacity-90">{notification.message}</p>
          )}
          
          {notification.action && (
            <div className="mt-2">
              <button
                onClick={notification.action.onClick}
                className="text-sm font-medium underline hover:no-underline focus:outline-none"
              >
                {notification.action.label}
              </button>
            </div>
          )}
        </div>
        
        <button
          onClick={handleClose}
          className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {/* Progress bar for timed notifications */}
      {notification.duration && notification.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black bg-opacity-10 rounded-b-lg overflow-hidden">
          <div 
            className="h-full bg-current opacity-30 animate-pulse"
            style={{
              animation: `shrink ${notification.duration}ms linear forwards`
            }}
          />
        </div>
      )}
      
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

// Utility hooks for common notification patterns
export const useNotificationHelpers = () => {
  const { addNotification } = useNotifications();

  const showSuccess = (title: string, message?: string) => {
    return addNotification({ type: 'success', title, message });
  };

  const showError = (title: string, message?: string) => {
    return addNotification({ type: 'error', title, message, duration: 8000 });
  };

  const showWarning = (title: string, message?: string) => {
    return addNotification({ type: 'warning', title, message, duration: 6000 });
  };

  const showInfo = (title: string, message?: string) => {
    return addNotification({ type: 'info', title, message });
  };

  const showPersistent = (type: Notification['type'], title: string, message?: string, action?: Notification['action']) => {
    return addNotification({ type, title, message, duration: 0, action });
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showPersistent,
  };
};

export default NotificationProvider;