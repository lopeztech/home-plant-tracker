const mlInsightsEnabled = import.meta.env.VITE_ML_INSIGHTS_ENABLED === 'true'

export const menuItems = [
  { key: 'overview', label: 'Overview', isTitle: true },
  { key: 'today', label: 'Today', icon: '/icons/sprite.svg#check-circle', url: '/today' },
  { key: 'dashboard', label: 'Garden', icon: '/icons/sprite.svg#home', url: '/' },
  { key: 'propagation', label: 'Propagation', icon: '/icons/sprite.svg#git-branch', url: '/propagation' },
  { key: 'analytics', label: 'Analytics', icon: '/icons/sprite.svg#bar-chart-2', url: '/analytics' },
  { key: 'calendar', label: 'Care Calendar', icon: '/icons/sprite.svg#calendar', url: '/calendar' },
  { key: 'forecast', label: 'Forecast', icon: '/icons/sprite.svg#cloud', url: '/forecast' },
  ...(mlInsightsEnabled ? [{ key: 'insights', label: 'Insights', icon: '/icons/sprite.svg#zap', url: '/insights' }] : []),
  { key: 'manage', label: 'Manage', isTitle: true },
  { key: 'bulk-upload', label: 'Bulk Upload', icon: '/icons/sprite.svg#upload', url: '/bulk-upload' },
  { key: 'settings', label: 'Settings', icon: '/icons/sprite.svg#settings', url: '/settings' },
  { key: 'billing', label: 'Billing', icon: '/icons/sprite.svg#credit-card', url: '/settings/billing' },
]
