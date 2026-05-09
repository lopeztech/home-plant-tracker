// `personas` (optional): which Profile-mode personas the item is shown to.
// Items / sections without a `personas` key are universal. Filter is applied
// in Sidebar.jsx; ordering and labels stay declared here.
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
    key: 'pro',
    label: 'Pro',
    isSection: true,
    collapsible: true,
    personas: ['landscaper', 'both'],
    children: [
      { key: 'visits', label: 'Visits', icon: '/icons/sprite.svg#calendar', url: '/visits' },
      { key: 'materials', label: 'Materials', icon: '/icons/sprite.svg#package', url: '/materials' },
      { key: 'client-properties', label: 'Properties', icon: '/icons/sprite.svg#home', url: '/settings/client-properties' },
      { key: 'branding', label: 'Branding', icon: '/icons/sprite.svg#star', url: '/settings/branding' },
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

/**
 * Drop sections / children whose `personas` array doesn't include the
 * current accountType. Universal items (no `personas` key) always pass.
 * Empty sections (all children filtered out) are removed.
 *
 * `overrides` is an optional map of `{ [item.key]: 'household'|'landscaper'|'both'|'hidden' }`
 * set by the workspace admin. When present, the override wins over the static
 * `personas` array; missing keys fall back to the static default.
 */
export function filterMenuByPersona(items, accountType, overrides = {}) {
  const matches = (item) => {
    const override = overrides[item.key]
    if (override) {
      if (override === 'hidden') return false
      if (override === 'both') return true
      return override === accountType
    }
    return !item.personas || item.personas.includes(accountType)
  }
  return items
    .filter(matches)
    .map((section) => {
      if (!section.children) return section
      const children = section.children.filter(matches)
      return { ...section, children }
    })
    .filter((section) => !section.children || section.children.length > 0)
}
