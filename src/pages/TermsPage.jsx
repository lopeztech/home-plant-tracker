import { Link } from 'react-router'

export default function TermsPage() {
  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <div className="mb-4">
        <Link to="/" className="btn btn-sm btn-outline-secondary mb-3">&larr; Back to app</Link>
        <h1 className="h2 fw-bold">Terms of Service</h1>
        <p className="text-muted">Last updated: April 2026</p>
      </div>

      <section className="mb-4">
        <h2 className="h5 fw-600">1. Acceptance</h2>
        <p>
          By using Plant Tracker you agree to these terms. If you do not agree, please do not use the service.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">2. Use of the service</h2>
        <ul>
          <li>Plant Tracker is provided for personal, non-commercial plant-care tracking.</li>
          <li>You must be at least 13 years old to use the service.</li>
          <li>You are responsible for maintaining the security of your Google account credentials.</li>
          <li>You agree not to upload unlawful, harmful, or infringing content.</li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">3. AI features</h2>
        <p>
          AI-generated care recommendations and plant analyses are provided for informational purposes only.
          They do not constitute professional horticultural advice. Results may be inaccurate; always use
          your own judgement when caring for plants.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">4. Data and account deletion</h2>
        <p>
          You own your data. You may export or delete your data at any time from{' '}
          <Link to="/settings/data">Settings &rarr; Data &amp; export</Link>. Account deletion is permanent
          and irreversible.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">5. Availability and liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; without warranty of any kind. We do not guarantee
          uptime, accuracy, or fitness for a particular purpose. We are not liable for any loss of data
          or indirect damages arising from use of the service.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">6. Changes to these terms</h2>
        <p>
          We may update these terms at any time. Continued use of the service after changes are posted
          constitutes acceptance of the revised terms.
        </p>
      </section>

      <hr />
      <p className="text-muted fs-sm">
        <Link to="/privacy">Privacy Policy</Link> &middot; &copy; {new Date().getFullYear()} Plant Tracker
      </p>
    </div>
  )
}
