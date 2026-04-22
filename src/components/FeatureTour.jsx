import Joyride, { STATUS } from 'react-joyride'
import { useTour } from '../context/TourContext.jsx'

const TOUR_STEPS = {
  setup: [
    {
      target: 'body',
      title: 'Welcome to Plant Tracker',
      content: 'This quick tour covers the key areas of the app. You can replay any tour from the sidebar at any time.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: 'aside.app-sidebar',
      title: 'Sidebar Navigation',
      content: 'Use the sidebar to navigate between pages: Dashboard, Analytics, Calendar, Forecast, and more.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-today"]',
      title: "Today's Tasks",
      content: 'The Today page shows exactly which plants need watering or care right now.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-settings"]',
      title: 'Settings',
      content: 'Start here — upload a floorplan photo and configure your floors. Gemini AI identifies rooms automatically.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-analytics"]',
      title: 'Analytics',
      content: 'Track your care consistency, watering patterns, and plant health over time.',
      placement: 'right',
      disableBeacon: true,
    },
  ],
  floorplan: [
    {
      target: 'body',
      title: 'Your Interactive Floorplan',
      content: 'The Dashboard shows your floorplan with plant markers. Click anywhere on the map to add a plant at that position.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="floor-nav"]',
      title: 'Multiple Floors',
      content: 'If your home has multiple floors, switch between them using these tabs. Add floors in Settings.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="plant-list"]',
      title: 'Plant List',
      content: 'All your plants appear here, grouped by room. Search, filter, and click any plant to view or edit it.',
      placement: 'left',
      disableBeacon: true,
    },
    {
      target: '[data-tour="floorplan-panel"]',
      title: 'Place Plants',
      content: 'Click anywhere on the floorplan to add a plant marker. Drag existing markers to reposition them.',
      placement: 'top',
      disableBeacon: true,
    },
  ],
  analytics: [
    {
      target: '[data-tour="nav-analytics"]',
      title: 'Analytics Overview',
      content: 'The Analytics page shows charts for watering frequency, health distribution, and care consistency.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-calendar"]',
      title: 'Care Calendar',
      content: 'The Calendar view shows your care schedule for the month — see what needs attention and when.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-forecast"]',
      title: 'Watering Forecast',
      content: 'The Forecast page predicts exactly when each plant will next need water, factoring in weather.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-today"]',
      title: "Today's Tasks",
      content: "Start each day here — it shows only the plants that need attention today so nothing gets missed.",
      placement: 'right',
      disableBeacon: true,
    },
  ],
  'bulk-upload': [
    {
      target: 'body',
      title: 'Bulk Import from Photos',
      content: 'You can import many plants at once by uploading photos. Gemini AI identifies the species automatically.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="nav-bulk-upload"]',
      title: 'Bulk Upload',
      content: 'Open Bulk Upload from the sidebar. Drop in up to 20 photos and review the AI-identified results before saving.',
      placement: 'right',
      disableBeacon: true,
    },
  ],
}

const joyrideStyles = {
  options: {
    zIndex: 10000,
    arrowColor: 'var(--bs-body-bg)',
    backgroundColor: 'var(--bs-body-bg)',
    textColor: 'var(--bs-body-color)',
    primaryColor: 'var(--bs-primary, #3e7d5f)',
  },
  tooltip: {
    borderRadius: 8,
  },
  buttonNext: {
    borderRadius: 6,
  },
  buttonBack: {
    color: 'var(--bs-secondary)',
  },
}

const joyrideLocale = {
  back: 'Back',
  close: 'Close',
  last: 'Done',
  next: 'Next',
  open: 'Open dialog',
  skip: 'Skip tour',
}

export default function FeatureTour() {
  const { activeTour, completeTour } = useTour()

  if (!activeTour || !TOUR_STEPS[activeTour]) return null

  const handleCallback = ({ status }) => {
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      completeTour(activeTour)
    }
  }

  return (
    <Joyride
      key={activeTour}
      steps={TOUR_STEPS[activeTour]}
      run
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      styles={joyrideStyles}
      locale={joyrideLocale}
    />
  )
}
