export const ARTICLES = [
  {
    id: 'adding-plants',
    title: 'Adding and editing plants',
    tags: ['plant', 'add', 'edit', 'species', 'room', 'frequency', 'watering'],
    sections: [
      {
        heading: 'What information do I need?',
        text: 'Only a name is required. Species, room, health, and watering frequency are optional but help Gemini AI give better care recommendations when you use the Analyse button.',
      },
      {
        heading: 'How is watering frequency used?',
        text: 'Frequency (days between waterings) controls how often the app reminds you to water on the Today page. It also drives the consistency score in Analytics. Tap the Gemini button when adding a plant to get a suggested frequency for your species.',
      },
      {
        heading: 'What is plantedIn?',
        text: 'Select "In ground", "Garden bed", or "Pot" to tell the app how the plant is planted. Potted plants show pot size and soil type fields. The planting type also affects watering and feeding calculations.',
      },
    ],
  },
  {
    id: 'health-grades',
    title: 'Plant health grades',
    tags: ['health', 'excellent', 'good', 'fair', 'poor', 'grade', 'status'],
    sections: [
      {
        heading: 'What do the health grades mean?',
        text: 'Health is a self-assessment you set when adding or editing a plant. Excellent = thriving with lush growth. Good = healthy, normal growth. Fair = some stress signs such as yellowing or wilting. Poor = significant decline, possible pest or disease.',
      },
      {
        heading: 'How is health used?',
        text: 'The Analytics "At-Risk Plants" panel surfaces Poor and Fair plants. ML Insights uses health history as a signal in the care quality score. Watering recommendations are adjusted automatically when health is Poor.',
      },
    ],
  },
  {
    id: 'watering-logic',
    title: 'Watering logic, rain skipping & seasonal adjustments',
    tags: ['watering', 'frequency', 'rain', 'outdoor', 'skip', 'seasonal', 'multiplier', 'today'],
    sections: [
      {
        heading: 'How does the Today task list work?',
        text: 'A plant appears on the Today list when it is due or overdue for watering (days since last watered ≥ frequency). Tap the water-drop icon to log a watering instantly.',
      },
      {
        heading: 'Outdoor rain skipping',
        text: 'When weather data is available and recent rainfall exceeds the skip threshold, outdoor plants are automatically removed from the Today list. You can still log a manual watering at any time.',
      },
      {
        heading: 'Seasonal multipliers',
        text: 'Outdoor plant watering frequency is adjusted by season. The app waters more often in hot summer months and less in winter. The multiplier is applied automatically based on your location and the current hemisphere.',
      },
    ],
  },
  {
    id: 'floorplan-ai',
    title: 'Floorplan AI analysis',
    tags: ['floorplan', 'ai', 'gemini', 'privacy', 'rooms', 'analyse', 'upload', 'zones'],
    sections: [
      {
        heading: 'What does floorplan analysis do?',
        text: 'When you upload a photo of your floor plan in Settings → Property, Gemini AI identifies rooms and draws labelled zone outlines on the map. You can then edit, rename, resize, or delete the suggested zones.',
      },
      {
        heading: 'What data is sent to Gemini?',
        text: 'Only the image you upload is sent to the Gemini API. No plant records or personal data are included. The image is processed in real time and is not stored by Gemini after the analysis completes.',
      },
      {
        heading: 'Can I draw zones manually?',
        text: 'Yes. In Settings → Property, expand a floor and drag on the empty map area to draw a new zone. Drag the corners to resize or drag the zone itself to move it.',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Understanding Analytics charts',
    tags: ['analytics', 'chart', 'consistency', 'score', 'heatmap', 'at-risk', 'distribution', 'radial'],
    sections: [
      {
        heading: 'Consistency score',
        text: 'Measures how closely your actual watering intervals match your target frequency. 80–100 = consistent; 60–79 = moderate; below 60 = irregular. Calculated from the watering log for the selected plant.',
      },
      {
        heading: 'Health distribution donut',
        text: 'Shows the breakdown of all your plants by current health status. Click a segment to filter the at-risk list. Hover for exact counts.',
      },
      {
        heading: 'Watering activity heatmap',
        text: 'Each cell represents one day over the last 12 weeks. Darker green = more plants watered that day. White/grey = no watering recorded. Hover a cell to see the exact date and count.',
      },
      {
        heading: 'At-Risk Plants',
        text: 'A plant is flagged as at risk if its health is Poor or Fair, or if it is more than 3 days overdue for watering based on its frequency setting.',
      },
    ],
  },
  {
    id: 'temperature-units',
    title: 'Temperature units',
    tags: ['temperature', 'celsius', 'fahrenheit', 'units', 'weather', 'metric', 'imperial'],
    sections: [
      {
        heading: 'What does the temperature unit affect?',
        text: 'The temperature unit applies to all weather displays across the app: the forecast strip in the sidebar, the weather alert banner, the Forecast page, and temperature thresholds in watering recommendations.',
      },
      {
        heading: 'Where do I change it?',
        text: 'Go to Settings → Preferences → Units and tap the toggle to switch between °C and °F. The change takes effect immediately across all pages.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & your data',
    tags: ['privacy', 'data', 'gdpr', 'delete', 'export', 'google', 'security', 'storage'],
    sections: [
      {
        heading: 'What data does the app store?',
        text: 'Plant records, watering logs, floor plan images, and plant photos are stored in your personal Firestore database scoped to your Google account ID. No third parties have access to your plant data.',
      },
      {
        heading: 'How do I export or delete my data?',
        text: 'Go to Settings → Data & Export. You can download a full copy of your plant records and watering history, or delete your account and all associated records permanently.',
      },
    ],
  },
  {
    id: 'ml-insights',
    title: 'ML Insights & care scores',
    tags: ['insights', 'ml', 'score', 'grade', 'pattern', 'prediction', 'anomaly', 'recommendation', 'pro'],
    sections: [
      {
        heading: 'What is the care score?',
        text: 'Each plant receives a care score from 0–100 based on four dimensions: watering consistency, timing accuracy, observed health outcomes, and responsiveness to care problems. A letter grade (A–F) summarises the score.',
      },
      {
        heading: 'What is the watering pattern?',
        text: 'ML Insights analyses your watering history to classify your pattern as Optimal, Over-watered, Under-watered, or Inconsistent. The pattern is shown with contributing factors to help you adjust.',
      },
      {
        heading: 'Why do I need 3 plants and 10 waterings?',
        text: 'The aggregate insights (pattern breakdown chart, collection health score) need enough data to be statistically meaningful. Once you have 3 plants and 10 total watering events logged, the full Insights page unlocks.',
      },
    ],
  },
]
