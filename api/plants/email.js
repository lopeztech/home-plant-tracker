'use strict';

// SendGrid transactional email helper.
// Falls back to a no-op when SENDGRID_API_KEY is not set or @sendgrid/mail is unavailable.

const SENDER = process.env.SENDGRID_FROM_EMAIL || 'notifications@plants.lopezcloud.dev';

const TEMPLATES = {
  dailyDigest: 'd-daily-digest-template-id',
  weeklyDigest: 'd-weekly-digest-template-id',
  plantAlert: 'd-plant-alert-template-id',
};

let _sgMail;
try { _sgMail = require('@sendgrid/mail'); } catch { _sgMail = null; }

async function sendEmail({ to, template, dynamicData }) {
  if (!_sgMail) return { skipped: true, reason: 'sendgrid_unavailable' };
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return { skipped: true, reason: 'no_api_key' };
  _sgMail.setApiKey(apiKey);
  const templateId = TEMPLATES[template];
  if (!templateId) throw new Error(`Unknown email template: ${template}`);
  await _sgMail.send({ to, from: SENDER, templateId, dynamicTemplateData: dynamicData || {} });
  return { sent: true };
}

module.exports = { sendEmail, TEMPLATES };
