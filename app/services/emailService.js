import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_APIKEY);

export const sendEmail = async (to, from, subject, html) => {
  const msg = {
    to,
    from,
    subject,
    text: html, // Consider converting HTML to plain text
    html
  };
  try {
    const result = await sgMail.send(msg);
    return { status: 'success', response: result };
  } catch (error) {
    console.error('SendGrid error:', error);
    return { status: 'failure', error: error.message };
  }
};
