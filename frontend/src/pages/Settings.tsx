/* ============================================
   FINTRACK AI - SETTINGS PAGE
   User settings and preferences
   ============================================ */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Lock,
  Bell,
  CreditCard,
  Shield,
  Palette,
  Globe,
  Download,
  Trash2,
  ChevronRight,
  Check,
  X,
  Eye,
  EyeOff,
  Camera,
  Edit3,
  Save,
  AlertTriangle,
  Info,
  Smartphone,
  Key,
  LogOut,
  Building2,
  MapPin,
  Phone,
  Calendar,
  Clock,
  Moon,
  Sun,
  Monitor,
  Zap,
  Brain,
  Receipt,
  FileText,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { cn, formatDate, getInitials } from '../lib/utils';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input, { PasswordInput } from '../components/ui/Input';

// ============================================
// TYPES
// ============================================

type SettingsTab = 'profile' | 'account' | 'notifications' | 'billing' | 'security' | 'preferences' | 'data';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: React.ElementType;
  description: string;
}

// ============================================
// CONSTANTS
// ============================================

const tabs: TabConfig[] = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Personal information' },
  { id: 'account', label: 'Account', icon: Building2, description: 'Business details' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Email and push alerts' },
  { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Plans and payment' },
  { id: 'security', label: 'Security', icon: Shield, description: 'Password and 2FA' },
  { id: 'preferences', label: 'Preferences', icon: Palette, description: 'Display and behavior' },
  { id: 'data', label: 'Data & Privacy', icon: Download, description: 'Export and delete' },
];

// ============================================
// ANIMATIONS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3 }
  }
};

// ============================================
// TOGGLE SWITCH COMPONENT
// ============================================

function ToggleSwitch({
  enabled,
  onChange,
  disabled = false
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200",
        enabled ? "bg-primary-500" : "bg-dark-600",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <motion.div
        animate={{ x: enabled ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </button>
  );
}

// ============================================
// SETTING ROW COMPONENT
// ============================================

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
  action,
  danger = false
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between py-4 border-b border-dark-800 last:border-0",
      danger && "text-red-400"
    )}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            danger ? "bg-red-500/20 text-red-400" : "bg-dark-800 text-dark-400"
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <h4 className={cn("font-medium", danger ? "text-red-400" : "text-white")}>{title}</h4>
          {description && (
            <p className="text-sm text-dark-500 mt-0.5">{description}</p>
          )}
          {children}
        </div>
      </div>
      {action}
    </div>
  );
}

// ============================================
// PROFILE TAB
// ============================================

function ProfileTab() {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.full_name || '',
    email: user?.email || '',
    phone: '',
    timezone: 'America/Chicago',
  });

  const handleSave = () => {
    setIsEditing(false);
    // Save logic here
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Avatar Section */}
      <Card variant="glass">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-3xl font-bold">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
              ) : (
                getInitials(user?.full_name || 'User')
              )}
            </div>
            <button className="absolute -bottom-2 -right-2 p-2 bg-dark-800 border border-dark-700 rounded-xl text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">{user?.full_name}</h3>
            <p className="text-dark-400">{user?.email}</p>
            <p className="text-sm text-dark-500 mt-1">
              Member since {formatDate(user?.created_at || new Date().toISOString(), 'monthYear')}
            </p>
          </div>
        </div>
      </Card>

      {/* Personal Information */}
      <Card variant="glass">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Personal Information</h3>
          <Button
            variant={isEditing ? "primary" : "secondary"}
            size="sm"
            leftIcon={isEditing ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            onClick={isEditing ? handleSave : () => setIsEditing(true)}
          >
            {isEditing ? 'Save Changes' : 'Edit'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            disabled={!isEditing}
            leftIcon={<User className="w-4 h-4" />}
          />
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            disabled={!isEditing}
            leftIcon={<Mail className="w-4 h-4" />}
          />
          <Input
            label="Phone Number"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={!isEditing}
            leftIcon={<Phone className="w-4 h-4" />}
            placeholder="+1 (555) 123-4567"
          />
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              disabled={!isEditing}
              className="w-full h-11 px-4 bg-dark-800/50 border border-dark-700 rounded-xl text-white focus:outline-none focus:border-primary-500 disabled:opacity-50"
            >
              <option value="America/Chicago">Central Time (Chicago)</option>
              <option value="America/New_York">Eastern Time (New York)</option>
              <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
              <option value="America/Denver">Mountain Time (Denver)</option>
            </select>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================
// NOTIFICATIONS TAB
// ============================================

function NotificationsTab() {
  const [settings, setSettings] = useState({
    emailTransactions: true,
    emailInsights: true,
    emailTaxReminders: true,
    emailWeeklySummary: true,
    emailMarketing: false,
    pushEnabled: true,
    pushTransactions: true,
    pushAlerts: true,
    smsEnabled: false,
    smsCriticalOnly: true,
  });

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Email Notifications */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Email Notifications</h3>
        <div className="space-y-1">
          <SettingRow
            icon={Receipt}
            title="Transaction Alerts"
            description="Get notified about new transactions and large purchases"
            action={
              <ToggleSwitch
                enabled={settings.emailTransactions}
                onChange={(v) => updateSetting('emailTransactions', v)}
              />
            }
          />
          <SettingRow
            icon={Sparkles}
            title="AI Insights"
            description="Receive personalized financial insights and recommendations"
            action={
              <ToggleSwitch
                enabled={settings.emailInsights}
                onChange={(v) => updateSetting('emailInsights', v)}
              />
            }
          />
          <SettingRow
            icon={Calendar}
            title="Tax Reminders"
            description="Quarterly payment reminders and deadline alerts"
            action={
              <ToggleSwitch
                enabled={settings.emailTaxReminders}
                onChange={(v) => updateSetting('emailTaxReminders', v)}
              />
            }
          />
          <SettingRow
            icon={FileText}
            title="Weekly Summary"
            description="Weekly financial summary and spending report"
            action={
              <ToggleSwitch
                enabled={settings.emailWeeklySummary}
                onChange={(v) => updateSetting('emailWeeklySummary', v)}
              />
            }
          />
          <SettingRow
            icon={Mail}
            title="Marketing & Updates"
            description="Product updates, tips, and promotional content"
            action={
              <ToggleSwitch
                enabled={settings.emailMarketing}
                onChange={(v) => updateSetting('emailMarketing', v)}
              />
            }
          />
        </div>
      </Card>

      {/* Push Notifications */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Push Notifications</h3>
        <div className="space-y-1">
          <SettingRow
            icon={Smartphone}
            title="Enable Push Notifications"
            description="Receive notifications on your device"
            action={
              <ToggleSwitch
                enabled={settings.pushEnabled}
                onChange={(v) => updateSetting('pushEnabled', v)}
              />
            }
          />
          <SettingRow
            icon={Bell}
            title="Transaction Notifications"
            description="Real-time alerts for account activity"
            action={
              <ToggleSwitch
                enabled={settings.pushTransactions}
                onChange={(v) => updateSetting('pushTransactions', v)}
                disabled={!settings.pushEnabled}
              />
            }
          />
          <SettingRow
            icon={AlertTriangle}
            title="Important Alerts"
            description="Security alerts and critical updates"
            action={
              <ToggleSwitch
                enabled={settings.pushAlerts}
                onChange={(v) => updateSetting('pushAlerts', v)}
                disabled={!settings.pushEnabled}
              />
            }
          />
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================
// SECURITY TAB
// ============================================

function SecurityTab() {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Password */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Password</h3>
        
        {!showChangePassword ? (
          <SettingRow
            icon={Lock}
            title="Change Password"
            description="Last changed 3 months ago"
            action={
              <Button variant="secondary" size="sm" onClick={() => setShowChangePassword(true)}>
                Change
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <PasswordInput
              label="Current Password"
              placeholder="Enter current password"
            />
            <PasswordInput
              label="New Password"
              placeholder="Enter new password"
              showStrength
            />
            <PasswordInput
              label="Confirm New Password"
              placeholder="Confirm new password"
            />
            <div className="flex items-center gap-3 pt-2">
              <Button variant="primary" leftIcon={<Save className="w-4 h-4" />}>
                Update Password
              </Button>
              <Button variant="ghost" onClick={() => setShowChangePassword(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Two-Factor Authentication */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Two-Factor Authentication</h3>
        <SettingRow
          icon={Shield}
          title="Enable 2FA"
          description="Add an extra layer of security to your account"
          action={
            <ToggleSwitch
              enabled={twoFactorEnabled}
              onChange={setTwoFactorEnabled}
            />
          }
        />
        
        {twoFactorEnabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-emerald-400">2FA is enabled</h4>
                <p className="text-sm text-emerald-400/80 mt-1">
                  Your account is protected with two-factor authentication.
                </p>
                <Button variant="outline" size="sm" className="mt-3">
                  Manage 2FA Settings
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </Card>

      {/* Active Sessions */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Active Sessions</h3>
        <div className="space-y-4">
          {[
            { device: 'MacBook Pro', location: 'Chicago, IL', current: true, lastActive: 'Now' },
            { device: 'iPhone 14', location: 'Chicago, IL', current: false, lastActive: '2 hours ago' },
          ].map((session, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center">
                  <Monitor className="w-5 h-5 text-dark-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{session.device}</h4>
                    {session.current && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-dark-500">{session.location} • {session.lastActive}</p>
                </div>
              </div>
              {!session.current && (
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300">
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="danger" size="sm" className="mt-4" leftIcon={<LogOut className="w-4 h-4" />}>
          Sign Out All Other Sessions
        </Button>
      </Card>
    </motion.div>
  );
}

// ============================================
// PREFERENCES TAB
// ============================================

function PreferencesTab() {
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [settings, setSettings] = useState({
    autoCategorizate: true,
    aiSuggestions: true,
    compactMode: false,
    showCents: true,
  });

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Appearance */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Appearance</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
            { value: 'system', label: 'System', icon: Monitor },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value as typeof theme)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                theme === option.value
                  ? "border-primary-500 bg-primary-500/10"
                  : "border-dark-700 hover:border-dark-600"
              )}
            >
              <option.icon className={cn(
                "w-6 h-6 mx-auto mb-2",
                theme === option.value ? "text-primary-400" : "text-dark-400"
              )} />
              <p className={cn(
                "text-sm font-medium",
                theme === option.value ? "text-primary-400" : "text-dark-400"
              )}>
                {option.label}
              </p>
            </button>
          ))}
        </div>
      </Card>

      {/* AI & Automation */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">AI & Automation</h3>
        <div className="space-y-1">
          <SettingRow
            icon={Brain}
            title="Auto-Categorization"
            description="Automatically categorize transactions using AI"
            action={
              <ToggleSwitch
                enabled={settings.autoCategorizate}
                onChange={(v) => setSettings({ ...settings, autoCategorizate: v })}
              />
            }
          />
          <SettingRow
            icon={Sparkles}
            title="AI Suggestions"
            description="Show AI-powered financial suggestions"
            action={
              <ToggleSwitch
                enabled={settings.aiSuggestions}
                onChange={(v) => setSettings({ ...settings, aiSuggestions: v })}
              />
            }
          />
        </div>
      </Card>

      {/* Display */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Display</h3>
        <div className="space-y-1">
          <SettingRow
            icon={Zap}
            title="Compact Mode"
            description="Show more information in less space"
            action={
              <ToggleSwitch
                enabled={settings.compactMode}
                onChange={(v) => setSettings({ ...settings, compactMode: v })}
              />
            }
          />
          <SettingRow
            icon={Receipt}
            title="Show Cents"
            description="Display cents in currency amounts"
            action={
              <ToggleSwitch
                enabled={settings.showCents}
                onChange={(v) => setSettings({ ...settings, showCents: v })}
              />
            }
          />
        </div>
      </Card>
    </motion.div>
  );
}

// ============================================
// DATA TAB
// ============================================

function DataTab() {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Export Data */}
      <Card variant="glass">
        <h3 className="text-lg font-semibold text-white mb-6">Export Your Data</h3>
        <p className="text-dark-400 mb-6">
          Download a copy of all your data including transactions, accounts, and settings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Transactions', format: 'CSV', size: '~2.3 MB' },
            { label: 'Tax Summary', format: 'PDF', size: '~450 KB' },
            { label: 'Full Export', format: 'ZIP', size: '~5.8 MB' },
          ].map((item) => (
            <button
              key={item.label}
              className="p-4 bg-dark-800/50 border border-dark-700 rounded-xl hover:border-primary-500/50 hover:bg-dark-800 transition-all text-left"
            >
              <Download className="w-5 h-5 text-primary-400 mb-2" />
              <h4 className="font-medium text-white">{item.label}</h4>
              <p className="text-xs text-dark-500 mt-1">{item.format} • {item.size}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Delete Account */}
      <Card variant="glass" className="border-red-500/30">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-dark-400 mb-6">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        
        {!showDeleteConfirm ? (
          <Button
            variant="danger"
            leftIcon={<Trash2 className="w-4 h-4" />}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Account
          </Button>
        ) : (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-400">Are you absolutely sure?</h4>
                <p className="text-sm text-red-400/80 mt-1">
                  This action cannot be undone. This will permanently delete your account and remove all your data.
                </p>
              </div>
            </div>
            <Input
              placeholder="Type 'DELETE' to confirm"
              className="mb-4"
            />
            <div className="flex items-center gap-3">
              <Button variant="danger">
                Yes, Delete My Account
              </Button>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

// ============================================
// MAIN SETTINGS COMPONENT
// ============================================

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab />;
      case 'notifications': return <NotificationsTab />;
      case 'security': return <SecurityTab />;
      case 'preferences': return <PreferencesTab />;
      case 'data': return <DataTab />;
      default: return <ProfileTab />;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <Card variant="glass" size="sm" className="sticky top-6">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left",
                  activeTab === tab.id
                    ? "bg-primary-500/20 text-primary-400"
                    : "text-dark-400 hover:text-white hover:bg-dark-800"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <div>
                  <p className="font-medium text-sm">{tab.label}</p>
                  <p className="text-xs opacity-70">{tab.description}</p>
                </div>
              </button>
            ))}
          </nav>
        </Card>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}