import EmptyState from './EmptyState'

export default {
  title: 'Primitives/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    icon: {
      description: 'SVG sprite icon name (from /icons/sprite.svg)',
      control: 'text',
    },
    title: { control: 'text' },
    description: { control: 'text' },
  },
}

export const NoPlants = {
  name: 'No Plants',
  args: {
    icon: 'feather',
    title: 'No plants yet',
    description: 'Add your first plant to start tracking watering schedules and care history.',
    actions: [
      { label: 'Add a plant', icon: 'plus', onClick: () => {} },
    ],
  },
}

export const NoResults = {
  name: 'No Search Results',
  args: {
    icon: 'search',
    title: 'No plants match your search',
    description: 'Try a different name or species.',
    actions: [],
  },
}

export const NoFloor = {
  name: 'No Floorplan',
  args: {
    icon: 'layout',
    title: 'No floorplan uploaded',
    description: 'Upload a floorplan image to place plants on the map.',
    actions: [
      { label: 'Go to Settings', icon: 'settings', href: '/settings' },
    ],
  },
}

export const MultipleActions = {
  name: 'Multiple Actions',
  args: {
    icon: 'inbox',
    title: 'Nothing here yet',
    description: 'Get started by adding content or importing from another source.',
    actions: [
      { label: 'Create new', icon: 'plus', onClick: () => {} },
      { label: 'Import', icon: 'upload', onClick: () => {} },
    ],
  },
}

export const Minimal = {
  name: 'Title only',
  args: {
    icon: 'info',
    title: 'Nothing to show',
    description: undefined,
    actions: [],
  },
}
