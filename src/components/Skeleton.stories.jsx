import { SkeletonRect, SkeletonCircle, SkeletonText, SkeletonPlantCard, SkeletonCard } from './Skeleton'

export default {
  title: 'Primitives/Skeleton',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Skeleton loaders for use while data is being fetched. All components ' +
          'are `aria-hidden="true"` and carry `role="presentation"` so they are ' +
          'invisible to screen readers.',
      },
    },
  },
}

export const Rect = {
  name: 'SkeletonRect',
  render: () => (
    <div className="d-flex flex-column gap-2" style={{ maxWidth: 400 }}>
      <SkeletonRect height={16} />
      <SkeletonRect height={12} width="70%" />
      <SkeletonRect height={12} width="50%" />
    </div>
  ),
}

export const Circle = {
  name: 'SkeletonCircle',
  render: () => (
    <div className="d-flex gap-3 align-items-center">
      <SkeletonCircle size={24} />
      <SkeletonCircle size={36} />
      <SkeletonCircle size={48} />
      <SkeletonCircle size={64} />
    </div>
  ),
}

export const Text = {
  name: 'SkeletonText',
  render: () => (
    <div className="d-flex flex-column gap-3" style={{ maxWidth: 400 }}>
      <SkeletonText lines={1} />
      <SkeletonText lines={2} />
      <SkeletonText lines={3} lastLineWidth="40%" />
    </div>
  ),
}

export const PlantCard = {
  name: 'SkeletonPlantCard',
  render: () => (
    <div style={{ maxWidth: 380, border: '1px solid var(--bs-border-color)', borderRadius: 8 }}>
      <SkeletonPlantCard />
      <SkeletonPlantCard />
      <SkeletonPlantCard />
      <SkeletonPlantCard />
    </div>
  ),
}

export const Card = {
  name: 'SkeletonCard',
  render: () => (
    <div style={{ maxWidth: 440 }}>
      <SkeletonCard lines={3} />
      <SkeletonCard height={200} className="mt-3" />
    </div>
  ),
}
