import * as database from '~/shared/database'; // Adjust the path as necessary
import { sendEmail } from '../services/emailService';
import { sendSmsapi, sendSms } from '../services/smsService';
import { sendWebhook } from '../services/webhookService';
import { replacePlaceholders, stripHtmlTags } from './placeholders';
import { formatPhoneNumber } from './formatPhoneNumber';
import { generateCode } from './generateCode';

interface Event {
  companyId: string;
  customerEmail: string;
  customer_name: string;
  customerPhone: string;
  customerCode: string;  // Ensure this is correctly set
  id: string;
  starts_at?: Date;
  ends_at?: Date;
  eventTitle?: string;
  eventDescription?: string;
}

interface Workflow {
  id: string;
  action: string;
  settings: string;
}

export const runAction = async (wf: Workflow, event: Event) => {
  if (!event.companyId) {
    console.error('Missing companyId in event:', event);
    return { status: 'error', message: 'Missing companyId' };
  }

  // Ensure the customerCode is set and consistent
  if (!event.customerCode) {
    console.error('Missing customerCode in event:', event);
    return { status: 'error', message: 'Missing customerCode' };
  }

  let settings;
  try {
    settings = JSON.parse(wf.settings);
  } catch (error) {
    console.error('Error parsing workflow settings:', error);
    return { status: 'error', message: 'Error parsing settings' };
  }

  const values = {
    customerCode: event.customerCode,
    customerEmail: event.customerEmail,
    customerName: event.customer_name,
    customerPhone: event.customerPhone,
    eventTitle: event.eventTitle || "The Golf Session",
    eventDescription: event.eventDescription || "Enjoy a day on the green!"
  };

  // Debugging log to check values object
  console.log('Values object for action:', values);

  switch (wf.action) {
    case 'email':
      return await handleEmailAction(wf, settings, event, values);
    case 'sms':
      return await handleSmsAction(wf, settings, event, values);
    case 'webhook':
      return await handleWebhookAction(wf, settings, event, values);
    default:
      console.error('Action not implemented:', wf.action);
      return { status: 'error', message: 'Action not implemented' };
  }
};

async function handleEmailAction(wf: Workflow, settings: any, event: Event, values: any) {
  const emailSubject = replacePlaceholders(settings.emailTemplate.subject, values);
  const emailBody = replacePlaceholders(settings.emailTemplate.body, values);
  const recipients = settings.emailTemplate.recipients.split(',').map(email => replacePlaceholders(email.trim(), values));

  let results = [];
  for (const recipient of recipients) {
    const result = await sendEmail(recipient, process.env.FROM_EMAIL, emailSubject, emailBody);
    results.push(result);
    const timestamp = new Date();
    await database.addToSent(wf, event, timestamp);
    await database.logAction(event.id, wf.id, event.companyId, 'email', result.status, { recipient, subject: emailSubject, body: emailBody, error: result.error });
  }

  return { status: 'success', results };
}

async function handleSmsAction(wf: Workflow, settings: any, event: Event, values: any) {
  let smsBody = replacePlaceholders(settings.smsTemplate.body, values);
  smsBody = stripHtmlTags(smsBody);

  const recipients = settings.smsTemplate.recipients.split(',')
    .map(recipient => replacePlaceholders(recipient.trim(), values))
    .map(formatPhoneNumber)
    .filter(phone => phone.startsWith('+'));

  let results = [];
  for (const recipient of recipients) {
    const result = await sendSmsapi(recipient, smsBody);
    results.push(result);
    const timestamp = new Date();
    await database.addToSent(wf, event, timestamp);
    await database.logAction(event.id, wf.id, event.companyId, 'sms', result.status, { recipient, body: smsBody, error: result.error });
  }

  if (results.length === 0) {
    return { status: 'failure', message: 'No valid recipients found' };
  }

  return { status: 'success', results };
}

async function handleWebhookAction(wf: Workflow, settings: any, event: Event, values: any) {
  const webhookUrl = 'https://eunitstest.onrender.com/api/addbooking';
  const eventData = formatEventData(event, values);  // Pass both 'event' and 'values'

  // Debugging log to check eventData before sending
  console.log('EventData sent to webhook:', eventData);

  const result = await sendWebhook(webhookUrl, eventData);

  let responseToLog = {};
  if (result && result.response && result.response.result) {
    const { bookingCode, bookingCustomerName, bookingCustomerPhone, bookingCompanyEmail, timestamp } = result.response.result;

    responseToLog = {
      bookingCode,
      bookingCustomerName,
      bookingCustomerPhone,
      bookingCompanyEmail,
      timestamp
    };
  } else {
    responseToLog = { error: "Invalid response format or missing result in the webhook response." };
  }

  await database.logAction(event.id, wf.id, event.companyId, 'webhook', result.status, responseToLog);

  const timestamp = new Date();
  await database.addToSent(wf, event, timestamp);

  return result;
}

// Helper function to format event data for webhook
const formatEventData = (event: Event, values: any) => {
  return {
    bookingStartsAtTime: Math.floor(new Date(event.starts_at).getTime() / 1000).toString(),
    bookingEndsAtTime: Math.floor(new Date(event.ends_at).getTime() / 1000).toString(),
    bookingStartDate: new Date(event.starts_at).toISOString().split('T')[0].replace(/-/g, '/'),
    bookingEndDate: new Date(event.ends_at).toISOString().split('T')[0].replace(/-/g, '/'),
    bookingCode: values.customerCode,  // Use 'values.customerCode' to ensure consistency
    bookingCustomerName: event.customer_name || "test",
    bookingCustomerPhone: event.customerPhone || "7771991",
    bookingCompanyEmail: event.customerEmail || "test@gmail.com",
    Connection: "Golf Session",
    status: "notdone",
    company: "Golfstöðin",
    timestamp: new Date().toISOString(),
    Integration: "Noona Golf Session",
    company_ID: "2",
    eConformationText: "false",
    bookingCustomerPhoneLocal: null
  };
};
