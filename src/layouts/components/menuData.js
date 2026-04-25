export const menuItems = [
  {
    key: 'garden',
    label: 'Garden',
    isSection: true,
    collapsible: true,
    children: [
      { key: 'today', label: 'Today', icon: '/icons/sprite.svg#check-circle', url: '/today' },
      { key: 'dashboard', label: 'Garden', icon: '/icons/sprite.svg#home', url: '/' },
      { key: 'calendar', label: 'Care Calendar', icon: '/icons/sprite.svg#calendar', url: '/calendar' },
      { key: 'forecast', label: 'Forecast', icon: '/icons/sprite.svg#cloud', url: '/forecast' },
      { key: 'propagation', label: 'Propagation', icon: '/icons/sprite.svg#git-branch', url: '/propagation' },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    isSection: true,
    collapsible: true,
    children: [
      { key: 'analytics', label: 'Analytics', icon: '/icons/sprite.svg#bar-chart-2', url: '/analytics' },
      { key: 'ml-insights', label: 'ML Insights', icon: '/icons/sprite.svg#zap', url: '/insights', requiresTier: 'home_pro' },
    ],
  },
  {
    key: 'manage',
    label: 'Manage',
    isSection: true,
    collapsible: true,
    children: [
      { key: 'bulk-upload', label: 'Bulk Upload', icon: '/icons/sprite.svg#upload', url: '/bulk-upload' },
      { key: 'settings', label: 'Settings', icon: '/icons/sprite.svg#settings', url: '/settings' },
      { key: 'billing', label: 'Billing', icon: '/icons/sprite.svg#credit-card', url: '/settings/billing' },
    ],
  },
]
