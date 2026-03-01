/* ============================================
   FINTRACK AI - LAYOUT COMPONENT
   Main application layout wrapper
   ============================================ */

import { Suspense, useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu,
  Bell,
  Search,
  Plus,
  Settings,
  HelpCircle,
  LogOut,
  MessageSquare,
  Calendar,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { useAuthStore } from '../../store/auth';
import { cn, formatDate, getInitials } from '../../lib/utils';
import Sidebar from './Sidebar';

// ============================================
// TYPES
// ============================================

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// ============================================
// MOCK DATA
// ============================================

const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'warning',
    title: 'Q4 Tax Payment Due',
    message: 'Your quarterly payment is due in 14 days',
    timestamp: new Date(),
    read: false,
  },
  {
    id: '2',
    type: 'success',
    title: 'Transaction Synced',
    message: '15 new transactions imported from Chase',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    read: false,
  },
  {
    id: '3',
    type: 'info',
    title: 'AI Insight Available',
    message: 'New savings opportunity detected',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
    read: true,
  },
];

// ============================================
// ANIMATIONS
// ============================================

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
};

function ContentLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-dark-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

const dropdownVariants = {
  hidden: { opacity: 0, y: -10, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { duration: 0.15 }
  },
  exit: { 
    opacity: 0, 
    y: -10, 
    scale: 0.95,
    transition: { duration: 0.1 }
  }
};

// ============================================
// NOTIFICATION DROPDOWN COMPONENT
// ============================================

function NotificationDropdown({
  notifications,
  isOpen,
  onClose
}: {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
}) {
  const getTypeIcon = (type: string) => ({
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    error: AlertCircle,
  }[type] || Info);

  const getTypeColor = (type: string) => ({
    info: 'blue',
    success: 'emerald',
    warning: 'amber',
    error: 'red',
  }[type] || 'gray');

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-full mt-2 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-400 text-xs font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
                Mark all read
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => {
                  const Icon = getTypeIcon(notification.type);
                  const color = getTypeColor(notification.type);
                  
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "px-4 py-3 border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors cursor-pointer",
                        !notification.read && "bg-primary-500/5"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          `bg-${color}-500/20 text-${color}-400`
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-dark-400 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-dark-500 mt-1">
                            {formatDate(notification.timestamp.toISOString(), 'relative')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center">
                  <Bell className="w-10 h-10 mx-auto text-dark-600 mb-3" />
                  <p className="text-dark-400">No notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-dark-700 bg-dark-800/50">
              <button className="w-full text-sm text-center text-primary-400 hover:text-primary-300 transition-colors">
                View all notifications
              </button>
            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// COMMAND PALETTE COMPONENT
// ============================================

function CommandPalette({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  const navigate = useNavigate();

  const commands = [
    { id: '1', icon: Plus, label: 'Add Transaction', shortcut: 'T', action: () => navigate('/transactions') },
    { id: '2', icon: MessageSquare, label: 'Open AI Advisor', shortcut: 'A', action: () => navigate('/advisor') },
    { id: '3', icon: Search, label: 'Search Transactions', shortcut: 'S', action: () => navigate('/transactions') },
    { id: '4', icon: Settings, label: 'Open Settings', shortcut: ',', action: () => navigate('/settings') },
    { id: '5', icon: Calendar, label: 'View Tax Calendar', shortcut: 'C', action: () => navigate('/tax') },
  ];

  const filteredCommands = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-dark-700">
              <Search className="w-5 h-5 text-dark-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands, pages..."
                autoFocus
                className="flex-1 bg-transparent text-white placeholder-dark-500 focus:outline-none"
              />
              <kbd className="px-2 py-1 bg-dark-700 rounded text-xs text-dark-400">ESC</kbd>
            </div>

            {/* Commands List */}
            <div className="py-2 max-h-80 overflow-y-auto">
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  onClick={() => { command.action(); onClose(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <command.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{command.label}</span>
                  <kbd className="px-2 py-0.5 bg-dark-700 rounded text-xs text-dark-500">
                    ⌘{command.shortcut}
                  </kbd>
                </button>
              ))}

              {filteredCommands.length === 0 && (
                <div className="py-8 text-center text-dark-500">
                  No commands found
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// HEADER COMPONENT
// ============================================

function Header({
  onMenuClick,
  isSidebarCollapsed
}: {
  onMenuClick: () => void;
  isSidebarCollapsed: boolean;
}) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close notifications when clicking outside
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get page title
  const getPageTitle = () => {
    const path = location.pathname;
    const titles: Record<string, string> = {
      '/': 'Dashboard',
      '/transactions': 'Transactions',
      '/accounts': 'Accounts',
      '/tax': 'Tax Center',
      '/advisor': 'AI Advisor',
      '/settings': 'Settings',
      '/invoices': 'Invoices',
      '/goals': 'Goals',
      '/budgets': 'Budgets',
      '/reports': 'Reports',
    };
    return titles[path] || 'Nexora';
  };

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const unreadNotifications = mockNotifications.filter(n => !n.read).length;

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-dark-900/80 backdrop-blur-xl border-b border-dark-800 z-30 transition-all duration-300",
      isSidebarCollapsed ? "left-20" : "left-[280px]",
      "max-lg:left-0"
    )}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page Title */}
          <div>
            <h1 className="text-lg font-semibold text-white">{getPageTitle()}</h1>
            <p className="text-xs text-dark-500 hidden sm:block">
              {formatDate(new Date().toISOString(), 'full')}
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <button
            onClick={() => setShowCommandPalette(true)}
            className="hidden md:flex items-center gap-3 px-4 py-2.5 w-64 lg:w-80 bg-dark-800/60 border border-dark-700/80 rounded-xl text-dark-400 hover:text-dark-200 hover:border-primary-500/40 hover:bg-dark-800 hover:shadow-[0_0_0_1px_rgba(99,102,241,0.15)] transition-all duration-200 group"
          >
            <Search className="w-4 h-4 text-dark-500 group-hover:text-primary-400 transition-colors duration-200 flex-shrink-0" />
            <span className="text-sm flex-1 text-left text-dark-500 group-hover:text-dark-300 transition-colors duration-200">
              Search Transactions
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <kbd className="px-1.5 py-0.5 bg-dark-700/80 border border-dark-600/50 rounded text-[10px] text-dark-500 font-mono">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-dark-700/80 border border-dark-600/50 rounded text-[10px] text-dark-500 font-mono">K</kbd>
            </div>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 rounded-xl text-dark-400 hover:text-white hover:bg-white/10 transition-colors border border-dark-700/60 bg-dark-800/40"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            <NotificationDropdown
              notifications={mockNotifications}
              isOpen={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-dark-700/60 transition-all group"
            >
              <span className="hidden sm:block text-sm font-medium text-dark-300 group-hover:text-white transition-colors">
                {user?.full_name || 'User'}
              </span>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {getInitials(user?.full_name || 'User')}
              </div>
            </button>

            {/* User Dropdown */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="absolute right-0 top-full mt-2 w-56 bg-dark-800 border border-dark-700 rounded-xl shadow-xl py-2 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-dark-700 mb-1">
                    <p className="text-sm font-semibold text-white">{user?.full_name}</p>
                    <p className="text-xs text-dark-400 truncate">{user?.email}</p>
                  </div>
                  <NavLink
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">Settings</span>
                  </NavLink>
                  <NavLink
                    to="/help"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-dark-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span className="text-sm">Help & Support</span>
                  </NavLink>
                  <div className="my-1 border-t border-dark-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />
    </header>
  );
}

// ============================================
// MAIN LAYOUT COMPONENT
// ============================================

export default function Layout() {
  const { isAuthenticated, isInitialized, checkAuth } = useAuthStore();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // Loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-purple-500 rounded-2xl flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-2xl">F</span>
          </div>
          <p className="text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <Sidebar
            isCollapsed={false}
            onToggle={() => {}}
            isMobile={true}
            onClose={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <Header
        onMenuClick={() => setMobileSidebarOpen(true)}
        isSidebarCollapsed={sidebarCollapsed}
      />

      {/* Main Content */}
      <main className={cn(
        "pt-16 min-h-screen transition-all duration-300",
        sidebarCollapsed ? "lg:pl-20" : "lg:pl-[280px]"
      )}>
        <div className="p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Suspense fallback={<ContentLoader />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}