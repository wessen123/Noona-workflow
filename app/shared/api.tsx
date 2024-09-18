//const fetch = require('node-fetch');

import { signSha256 } from "../utils/hash";

const NOONA_BASE_PATH = 'https://api.noona.is/v1/hq';

// Function to get user details from token
export const getUserFromToken = async (token: string) => {
  const url = `${NOONA_BASE_PATH}/user`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token
    },
  });
  return await response.json();
};

// Function to exchange code for token
export const codeTokenExchange = async (code: string) => {
  const NOONA_CLIENT_ID = process.env.NOONA_CLIENT_ID;
  const NOONA_CLIENT_SECRET = process.env.NOONA_CLIENT_SECRET;

  const url = `${NOONA_BASE_PATH}/oauth/token?client_id=${NOONA_CLIENT_ID}&client_secret=${NOONA_CLIENT_SECRET}`;
  const data = { code, grant_type: 'authorization_code' };

  const response = await fetch(url, {
    body: JSON.stringify(data),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return await response.json();
};

// Function to get event types by company ID
export const getEventTypesByCompanyId = async (companyId: string, token: string) => {
  const url = `${NOONA_BASE_PATH}/companies/${companyId}/event_types`;

  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  const json = await response.json();
  console.log('Updated received event:', json);
  return json.map(eventType => ({ id: eventType.id, title: eventType.title, description: eventType.description }));
};

// Function to get customer details
export const getCustomer = async (customerId: string, token: string) => {
  const url = `${NOONA_BASE_PATH}/customers/${customerId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};

// Function to get existing webhooks for a company
export const getExistingWebhooks = async (companyId: string, token: string) => {
  const url = `${NOONA_BASE_PATH}/companies/${companyId}/webhooks`;

  const response = await fetch(url, {
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};

// Function to create a new webhook
export const createWebhook = async (token: string, companyId: string) => {
  const hash = signSha256(companyId);
  const webhook = {
    title: 'Entronoona event.created webhook',
    description: 'EntroNoona event.created webhook. Do not delete unless you know what you are doing.',
    callback_url: `${process.env.APP_BASE_URL}/${process.env.CALLBACK_URL}`,
    events: ['event.created'],
    headers: [
      {
        key: 'x-entronoona-hash',
        values: [hash],
      },
    ],
    enabled: true,
    company: companyId
  };

  const url = `${NOONA_BASE_PATH}/webhooks`;

  const response = await fetch(url, {
    body: JSON.stringify(webhook),
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
};



export const updateEventInNoona = async (eventId: string, event: any) => {
  const url = `${NOONA_BASE_PATH}/events/${eventId}`;
  const payload = {
    event_types: event.event_types,
    customer_name: event.customer_name,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    company: event.company,
    employee: event.employee,
    duration: event.duration,
    comment: event.comment,
    origin: event.origin,
    customer: event.customer,
    unconfirmed: event.unconfirmed, // Assuming the API expects this to manage confirmation status
    pinned: event.pinned, 
    confirmed: event.confirmed,
    update_origin: event.update_origin,
    
  };

  try {
    const response = await fetch(url, {
      method: 'POST', // Changed to PUT for full resource update
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NOONA_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to update event in Noona: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Event updated successfully in Noona:', data);
    return data;
  } catch (error) {
    console.error('Error updating event in Noona:', error);
    throw error;
  }
};

