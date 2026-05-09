export default function CommunityGuidelinesPage() {
  return (
    <div className="content-wrapper" style={{ maxWidth: 720 }}>
      <h1 className="mb-4">Community Guidelines</h1>
      <p className="text-muted">Last updated: April 2026</p>

      <h2 className="h5 mt-4">What this space is for</h2>
      <p>The Plant Tracker Cuttings Board is a place for gardeners in the UK to share surplus plant cuttings, divisions, seeds, and mature plants with their local community. It is free to use and free to list.</p>

      <h2 className="h5 mt-4">Rules</h2>
      <ul>
        <li><strong>Plants only.</strong> Listings must be for genuine plant material — cuttings, divisions, seeds, seedlings, or mature plants. Off-topic listings will be removed.</li>
        <li><strong>Free or cash-in-person only.</strong> No payment links, no Stripe, no PayPal. Suggested donation strings (e.g. "£2 for postage") are allowed.</li>
        <li><strong>No full postcodes.</strong> Only share the outward code (first part, e.g. "SW1A"). Never post your full address publicly.</li>
        <li><strong>Honest descriptions.</strong> Describe the plant accurately — health, size, age, and any known pests or diseases.</li>
        <li><strong>One listing per plant per period.</strong> Don't create duplicate listings for the same cutting.</li>
        <li><strong>Coordinate off-platform or via email.</strong> There is no in-app chat; share a contact email or phone number to arrange collection.</li>
      </ul>

      <h2 className="h5 mt-4">Moderation</h2>
      <p>Listings are reviewed by our AI moderation system before going live. Listings that receive 3 or more community reports are automatically hidden pending manual review. Repeated violations result in account suspension.</p>

      <h2 className="h5 mt-4">Reporting</h2>
      <p>Use the "Report" button on any listing to flag it. Please include a brief reason. We aim to review all reports within 48 hours.</p>

      <h2 className="h5 mt-4">Karma</h2>
      <p>After a successful handover, the lister receives +1 karma. Karma is visible on your public profile and builds trust within the community.</p>

      <h2 className="h5 mt-4">Contact</h2>
      <p>For questions about the marketplace, email <a href="mailto:community@lopezcloud.dev">community@lopezcloud.dev</a>.</p>
    </div>
  )
}
