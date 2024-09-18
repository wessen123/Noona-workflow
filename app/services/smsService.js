import { formatPhoneNumber } from '../utils/formatPhoneNumber';
import axios from 'axios';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Account SID from www.twilio.com/console
const authToken = process.env.TWILIO_AUTH_TOKEN; // Your Auth Token from www.twilio.com/console
const client = twilio(accountSid, authToken);

export const sendSmsapi = async (phone, message) => {
  const apiUrl = 'https://smsengine.onrender.com/api/smsapi';
  const fixedCompanyId = "2";
  const formattedPhone = formatPhoneNumber(phone);
  try {
    const response = await axios.post(apiUrl, { phoneNo: formattedPhone, body: message, company_ID: fixedCompanyId }, { headers: { 'Content-Type': 'application/json' } });
    console.log('success to send SMS:', response.data);
    return { status: 'success', data: response.data };
  } catch (error) {
    console.error('Failed to send SMS:', error.response ? error.response.data : error.message);
    return { status: 'failure', error: error.message, details: error.response ? error.response.data : 'No details available' };
  }
};

export const sendSms = async (phone, message) => {
  console.log("Preparing to send SMS...");
  const formattedPhone = formatPhoneNumber(phone);

  if (!formattedPhone) {
    console.error('Failed to format phone number or phone number is empty after formatting.');
    return { status: 'failure', error: 'Invalid phone number' };
  }

  console.log("Formatted phone number for SMS:", formattedPhone);  // Log the formatted phone number

  try {
    const messageResponse = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });
    console.log(`SMS sent to ${formattedPhone}: ${messageResponse.sid}`);
    return { status: 'success', sid: messageResponse.sid };
  } catch (error) {
    console.error('Error sending SMS to', formattedPhone, ':', error.message);
    return { status: 'failure', error: error.message };
  }
};
