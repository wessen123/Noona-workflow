import { json } from '@remix-run/node';
import { runAction } from '~/utils/run-action';
import * as api from '~/shared/api';
import * as database from '~/shared/database';
import { verifyHashFromHeader } from '~/utils/hash';
import { generateCode } from '~/utils/generateCode';
import { translateIcelandicChars } from '~/services/translation';
export const action = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ message: 'Method Not Allowed' }, { status: 405 });
  }

  try {
    const webhookPayload = await request.json();
    let event = webhookPayload.data;

    console.log('Received event:', event);

    const companyId = event.company;
    verifyHashFromHeader(companyId, request.headers);

    // Generate the customerCode once here
    const customerCode = generateCode();
    event = await addCustomerDetailsToEvent(companyId, event, customerCode);

    // Generate a new title, description, and booking success message
    const originalTitle = event.event_types[0].title;
    const duration = getDurationString(event.duration); // Assuming a function to convert duration to "1 - 2 klst" format
    const newTitle = `${originalTitle}(${customerCode})`;
    const newDescription = `(${customerCode}) er aðgangskóðinn þinn í Golfstöðina. Kóðinn veitir þér aðgang 15 mínútum fyrir bókaðan tíma..\n\n${newTitle}`;
    const newBookingSuccessMessage = `(${customerCode}) er aðgangskóðinn þinn í Golfstöðina. Kóðinn veitir þér aðgang 15 mínútum fyrir bókaðan tíma.\n\n${newTitle}`;
    const translatedDescription = translateIcelandicChars(newDescription);
    const translatedBookingSuccessMessage = translateIcelandicChars(newBookingSuccessMessage);
    // Update event title, description, and booking success message
    event.event_types[0].title  += `(${customerCode})`;
    event.event_types[0].description = newDescription;
    event.event_types[0].connections.booking_success_message = newBookingSuccessMessage;

    
    // Update event in Noona with new title, description, and booking success message
        const updateResult = await api.updateEventInNoona(event.id, event);
        if (updateResult && event.unconfirmed) {
          event.unconfirmed = false;
          await api.updateEventInNoona(event.id, { ...event, unconfirmed : false });
            console.log('Event updated and confirmed in Noona by unconfirmed .');
        }if (updateResult && !event.confirmed) {
            console.log('Event is not confirmed. Confirming now...by confirmed');
          event.confirmed = true; // Assuming this field exists and is used to track confirmation
            await api.updateEventInNoona(event.id, { ...event, confirmed: true });
        }else {
            console.error('Failed to update or confirm event in Noona.');
        }

    const triggers = ['APPOINTMENT_BOOKED', 'TIME_BEFORE_APPOINTMENT', 'TIME_AFTER_APPOINTMENT'];
    const workflows = await database.getWorkflowsByCompanyIdAndTriggers(companyId, triggers);
    console.log(workflows);

    const now = workflows.filter(wf => wf.trigger === 'APPOINTMENT_BOOKED');
    const beforeEventStarts = workflows.filter(wf => wf.trigger === 'TIME_BEFORE_APPOINTMENT');
    const afterEventEnds = workflows.filter(wf => wf.trigger === 'TIME_AFTER_APPOINTMENT');

    for (const wf of now) {
      if (!isSameServiceType(wf, event)) continue;
      console.log('Running immediate action for workflow:', wf);
      await runAction(wf, { ...event, eventTitle: newTitle, eventDescription: newDescription, bookingSuccessMessage: newBookingSuccessMessage });
    }

for (const wf of beforeEventStarts) {
    if (!isSameServiceType(wf, event)) continue;
    console.log('Scheduling tasks before event starts for workflow:', wf);

    // Schedule the update 5 minutes after the event is created
    const updateTime = new Date(event.created_at);
    updateTime.setMinutes(updateTime.getMinutes() + 5); // 5 minutes after creation

    // Check if the current time is before the calculated update time
    if (updateTime > new Date()) {
        console.log('Scheduling event update 5 minutes after creation at:', updateTime);

        // Prepare new title, description, and booking success message
        const newTitle = `${event.event_types[0].title}(${customerCode})`;
        const newDescription = `(${customerCode}) is your access code. Golfstöðin is a self-service center. This code allows you entry up to 15 minutes before your registered timeslot.\n\n${newTitle}`;
        const newBookingSuccessMessage = `(${customerCode}) is your access code. Golfstöðin is a self-service center. This code allows you entry up to 15 minutes before your registered timeslot.\n\n${newTitle}`;

        // Add a task to the scheduler to update the event in Noona and run the action
        await addToSchedule(wf, event, updateTime, async () => {
            console.log('Updating event in Noona 2 minutes after creation:', event.id);

            // Update the event object with new details
            event.event_types[0].title = newTitle;
            event.event_types[0].description = newDescription;
            event.event_types[0].connections.booking_success_message = newBookingSuccessMessage;

            // Call the API to update the event in Noona
            await api.updateEventInNoona(event.id, event);

            // Run the associated action
            await runAction(wf, { ...event, eventTitle: newTitle, eventDescription: newDescription, bookingSuccessMessage: newBookingSuccessMessage });
            console.log('Event updated and action run successfully in Noona.');
        });
    }
}


    for (const wf of afterEventEnds) {
      if (!isSameServiceType(wf, event)) continue;
      console.log('Scheduling task after event ends for workflow:', wf);
      const { days, hours, minutes } = JSON.parse(wf.settings).interval;
      const dt = getDateOffset(event.ends_at, days, hours, minutes);
     // await addToSchedule(wf, event, dt);
    }

    console.log('Webhook received and event updated successfully');
    return json({ message: 'Webhook received and event updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return json({ message: 'Internal Server Error' }, { status: 500 });
  }
};



const addCustomerDetailsToEvent = async (companyId, event, customerCode) => {
  const oauthToken = await database.getOAuthTokenByCompanyId(companyId);
  const customer = await api.getCustomer(event.customer, process.env.NOONA_API_TOKEN);
  event.customerEmail = customer.email;
  event.customerPhone = customer.phone_country_code + customer.phone_number;
  event.companyId = companyId;
  event.customerCode = customerCode;  // Use the generated customerCode here
  return event;
};

// Function to convert duration to a string format like "1 - 2 klst"
const getDurationString = (durationMinutes) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return `${hours} - ${hours + 1} klst`; 
};

const isSameServiceType = (wf, event) => {
  if (!event.event_types || event.event_types.length === 0) {
    console.warn('Event has no event types:', event);
    return false;
  }

  const eventTypeId = event.event_types[0]?.id;
  if (!eventTypeId) {
    console.warn('Event type ID is missing:', event);
    return false;
  }

  let settings;
  try {
    settings = JSON.parse(wf.settings);
  } catch (error) {
    console.error('Error parsing workflow settings:', wf.settings);
    return false;
  }

  if (!settings.serviceType) {
    console.warn('Workflow settings or service Type is missing:', wf);
    return false;
  }

  return settings.serviceType.includes(eventTypeId);
};

const getDateOffset = (date, days, hours, minutes) => {
  const dt = new Date(date);
  dt.setDate(dt.getDate() + days);
  dt.setHours(dt.getHours() + hours);
  dt.setMinutes(dt.getMinutes() + minutes);
  return dt;
};

const addToSchedule = async (wf, event, timestamp, callback) => {
  try {
    console.log('Scheduling task:', { wf, event, timestamp });
    await database.addToScheduledTasks(wf, event, timestamp);
    if (callback) {
      setTimeout(callback, timestamp - new Date().getTime());
    }
    console.log('Task scheduled successfully:', { wf, event, timestamp });
  } catch (error) {
    console.error('Error scheduling task:', { wf, event, timestamp, error });
  }
};
