import { Link } from 'react-router'

export default function PrivacyPage() {
  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <div className="mb-4">
        <Link to="/" className="btn btn-sm btn-outline-secondary mb-3">&larr; Back to app</Link>
        <h1 className="h2 fw-bold">Privacy Policy</h1>
        <p className="text-muted">Last updated: April 2026</p>
      </div>

      <section className="mb-4">
        <h2 className="h5 fw-600">1. Who we are</h2>
        <p>
          Plant Tracker (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal plant-care application. Your data is
          stored in your own Google-authenticated account and is never sold or shared with third parties
          for advertising purposes.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">2. What data we collect</h2>
        <ul>
          <li><strong>Account data:</strong> Your Google profile name, email address, and profile picture are stored in your browser&apos;s <code>localStorage</code> to maintain your session.</li>
          <li><strong>Plant data:</strong> Plant names, species, care records, photos, measurements, and journal entries you enter are stored in Google Firestore scoped to your account.</li>
          <li><strong>Photos:</strong> Images you upload are stored in Google Cloud Storage in a bucket associated with your account.</li>
          <li><strong>Usage data:</strong> We do not collect analytics unless you explicitly consent via the consent banner.</li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">3. Third-party services</h2>
        <ul>
          <li><strong>Google OAuth:</strong> Authentication is handled by Google. See <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google&apos;s Privacy Policy</a>.</li>
          <li><strong>Google Gemini / Vertex AI:</strong> When you use AI features (plant analysis, care recommendations), images and text are sent to Google&apos;s generative AI APIs. Data is not used to train Google&apos;s models per enterprise terms.</li>
          <li><strong>Open-Meteo:</strong> Location-based weather data is fetched from Open-Meteo. Only approximate coordinates are sent; no account data is shared.</li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">4. Your rights (GDPR / CCPA)</h2>
        <p>You have the right to:</p>
        <ul>
          <li><strong>Access:</strong> Export all your data from Settings &rarr; Data &amp; export.</li>
          <li><strong>Erasure:</strong> Delete your account and all associated data from Settings &rarr; Data &amp; export &rarr; Delete account. Data is purged within 30 days (GDPR Article 17).</li>
          <li><strong>Portability:</strong> Your export is provided as a standard JSON file.</li>
          <li><strong>Opt-out:</strong> Non-essential tracking can be rejected via the consent banner at any time.</li>
        </ul>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">5. Data retention</h2>
        <p>
          Your data is retained as long as your account is active. You can delete your account at any time
          from <Link to="/settings/data">Settings &rarr; Data &amp; export</Link>.
        </p>
      </section>

      <section className="mb-4">
        <h2 className="h5 fw-600">6. Contact</h2>
        <p>
          For privacy enquiries, open an issue at the project repository or contact the account owner.
        </p>
      </section>

      <hr />
      <p className="text-muted fs-sm">
        <Link to="/terms">Terms of Service</Link> &middot; &copy; {new Date().getFullYear()} Plant Tracker
      </p>
    </div>
  )
}
