const mlInsightsEnabled = import.meta.env.VITE_ML_INSIGHTS_ENABLED === 'true'

export const menuItems = [
  { key: 'overview', label: 'Overview', isTitle: true },
  { key: 'dashboard', label: 'Dashboard', icon: '/icons/sprite.svg#home', url: '/' },
  { key: 'analytics', label: 'Analytics', icon: '/icons/sprite.svg#bar-chart-2', url: '/analytics' },
  { key: 'calendar', label: 'Care Calendar', icon: '/icons/sprite.svg#calendar', url: '/calendar' },
  { key: 'forecast', label: 'Forecast', icon: '/icons/sprite.svg#cloud', url: '/forecast' },
  ...(mlInsightsEnabled ? [{ key: 'insights', label: 'Insights', icon: '/icons/sprite.svg#zap', url: '/insights' }] : []),
  { key: 'manage', label: 'Manage', isTitle: true },
  { key: 'bulk-upload', label: 'Bulk Upload', icon: '/icons/sprite.svg#upload', url: '/bulk-upload' },
  { key: 'settings', label: 'Settings', icon: '/icons/sprite.svg#settings', url: '/settings' },
]
