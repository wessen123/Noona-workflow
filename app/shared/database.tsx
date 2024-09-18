import { pool } from '~/database.server'; // Adjust the path as per your project structure

// Utility function to format dates for MySQL
const formatDateForMySQL = (date: Date) => {
  const d = new Date(date);
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const getScheduledTasks = async (currentDateTime) => {
  const sql = 'SELECT * FROM schedule WHERE dt <= ?';
  const [rows] = await pool.query(sql, [currentDateTime]);
  return rows.map(row => {
    // Parse the wf and event columns if they are stored as JSON strings
    row.wf = typeof row.wf === 'string' ? JSON.parse(row.wf) : row.wf;
    row.event = typeof row.event === 'string' ? JSON.parse(row.event) : row.event;
    return row;
  });
};

// Function to delete a scheduled task by ID
export const deleteScheduledTask = async (taskId) => {
  const sql = 'DELETE FROM schedule WHERE id = ?';
  await pool.query(sql, [taskId]);
};

// Function to get scheduled tasks by companyId
export const getScheduledTasksByCompanyId = async (companyId: string) => {
  const sql = 'SELECT * FROM schedule WHERE companyId = ?';
  const [rows] = await pool.query(sql, [companyId]);
  return rows;
};

// Function to get sent items by companyId
export const getSentByCompanyId = async (companyId: string) => {
  const sql = `
    SELECT s.id, s.wf, s.event, s.timestamp, s.dt, s.companyId 
    FROM sent s
    WHERE s.companyId = ?
  `;
  const [rows] = await pool.query(sql, [companyId]);

  // Assuming wf is stored as a JSON string, we need to parse it
  return rows.map(row => ({
    ...row,
    wf: JSON.parse(row.wf)
  }));
};

// Function to get workflows by companyId and triggers
export const getWorkflowsByCompanyIdAndTriggers = async (companyId: string, triggers: string[]) => {
  const sql = 'SELECT * FROM workflows WHERE companyId = ? AND `trigger` IN (?)';
  const [rows] = await pool.query(sql, [companyId, triggers]);
  return rows;
};

// Function to add a task to scheduled tasks
export const addToScheduledTasks = async (workflow: any, event: any, timestamp: Date) => {
  const sql = 'INSERT INTO schedule (wf, event, timestamp, dt, companyId) VALUES (?, ?, ?, ?, ?)';
  const values = [
    JSON.stringify(workflow),
    JSON.stringify(event),
    formatDateForMySQL(timestamp), // Apply formatting here
    formatDateForMySQL(timestamp),
    event.companyId
  ];
  const [result] = await pool.query(sql, values);
  return result;
};

// Function to add a workflow
export const addWorkflow = async (trigger: string, action: string, settings: any, name: string, companyId: string) => {
  const now = new Date();
  const sql = `
    INSERT INTO workflows (\`trigger\`, action, settings, name, companyId, dt, \`timestamp\`)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    trigger,
    action,
    JSON.stringify(settings),
    name,
    companyId,
    formatDateForMySQL(now),
    formatDateForMySQL(now) // Apply formatting here
  ];
  const [result] = await pool.query(sql, values);
  return result;
};

// Function to get workflows by companyId
export const getWorkflowsByCompanyId = async (companyId: string) => {
  const sql = 'SELECT * FROM workflows WHERE companyId = ?';
  const [rows] = await pool.query(sql, [companyId]);
  return rows;
};

// Function to store OAuth token
export const storeOAuthToken = async (companyId: string, token: any) => {
  const sql = `
    INSERT INTO oauth_tokens (companyId, token)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE token = VALUES(token)
  `;
  const values = [companyId, JSON.stringify(token)];
  await pool.query(sql, values);
};

// Function to add a task to sent
export const addToSent = async (wf: any, event: any, timestamp: Date) => {
  const sql = 'INSERT INTO sent (wf, event, timestamp, dt, companyId) VALUES (?, ?, ?, ?, ?)';
  const values = [
    JSON.stringify(wf),
    JSON.stringify(event),
    formatDateForMySQL(timestamp), // Apply formatting here
    formatDateForMySQL(timestamp),
    event.companyId
  ];
  const [result] = await pool.query(sql, values);
  return result;
};

// Function to create a session
export const createSession = async (data: any, expires?: Date) => {
  const sql = 'INSERT INTO sessions (data, expires) VALUES (?, ?)';
  const [result] = await pool.query(sql, [JSON.stringify(data), expires ? formatDateForMySQL(expires) : null]);
  return result.insertId;
};

// Function to read a session by ID
export const readSession = async (id: number) => {
  const sql = 'SELECT data FROM sessions WHERE id = ?';
  const [rows] = await pool.query(sql, [id]);
  return rows.length ? JSON.parse(rows[0].data) : null;
};

// Function to update a session by ID
export const updateSession = async (id: number, data: any, expires?: Date) => {
  const sql = 'UPDATE sessions SET data = ?, expires = ? WHERE id = ?';
  await pool.query(sql, [JSON.stringify(data), expires ? formatDateForMySQL(expires) : null, id]);
};

// Function to delete a session by ID
export const deleteSession = async (id: number) => {
  const sql = 'DELETE FROM sessions WHERE id = ?';
  await pool.query(sql, [id]);
};

// Function to add an app token
export const addAppToken = async (companyId: string, appToken: any) => {
  const sql = `
    INSERT INTO apptokens (companyId, token)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE token = VALUES(token)
  `;
  const values = [companyId, JSON.stringify(appToken)];
  await pool.query(sql, values);
};

// Function to get OAuth token by companyId
export const getOAuthTokenByCompanyId = async (companyId: string) => {
  const sql = 'SELECT token FROM oauth_tokens WHERE companyId = ?';
  const [rows] = await pool.query(sql, [companyId]);
  return rows.length ? JSON.parse(rows[0].token) : null;
};

// Function to check if an event has already been processed
export const checkIfProcessed = async (eventId: string, workflowId: string) => {
  const sql = 'SELECT COUNT(*) AS count FROM processed_events WHERE event_id = ? AND workflow_id = ?';
  const [rows] = await pool.query(sql, [eventId, workflowId]);
  return rows[0].count > 0;
};

// Function to mark an event as processed
export const markAsProcessed = async (eventId: string, workflowId: string) => {
  const sql = 'INSERT INTO processed_events (event_id, workflow_id, processed_at) VALUES (?, ?, NOW())';
  await pool.query(sql, [eventId, workflowId]);
};

// Function to fetch a workflow by its ID and company ID
export async function getWorkflowById(workflowId: number, companyId: string) {
  const sql = `SELECT * FROM workflows WHERE id = ? AND companyId = ?`;
  const [rows] = await pool.query(sql, [workflowId, companyId]);
  return rows[0];
}

// Function to update a workflow's settings
export async function updateWorkflowById(workflowId: number, companyId: string, updates: any) {
  const { settings } = updates;
  const sql = `
    UPDATE workflows
    SET settings = ?
    WHERE id = ? AND companyId = ?
  `;
  await pool.query(sql, [JSON.stringify(settings), workflowId, companyId]);
}

// Function to delete a workflow by ID
export const deleteWorkflowById = async (workflowId: number, companyId: string) => {
  const sql = 'DELETE FROM workflows WHERE id = ? AND companyId = ?';
  await pool.query(sql, [workflowId, companyId]);
};

// Function to log an action
export const logAction = async (eventId: string, workflowId: number, companyId: string, actionType: string, status: string, details: any) => {
  const sql = `
    INSERT INTO action_logs (event_id, workflow_id, company_id, action_type, status, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const values = [eventId, workflowId, companyId, actionType, status, JSON.stringify(details)];
  try {
    await pool.query(sql, values);
    console.log(`Action logged successfully for event ${eventId}`);
  } catch (error) {
    console.error('Error logging action:', error);
  }
};   

export const getActionLogsByCompanyId = async (companyId) => {
  const sql = 'SELECT * FROM action_logs WHERE company_id = ? ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, [companyId]);

  return rows.map(row => {
    let details;
    try {
      // Attempt to parse details as JSON
      details = JSON.parse(row.details);
    } catch (error) {
      console.error("Error parsing details JSON:", error, "Details content:", row.details);
      // Fall back to raw details if parsing fails
      details = row.details;
    }

    return {
      id: row.id,
      event_id: row.event_id,
      workflow_id: row.workflow_id,
      company_id: row.company_id,
      action_type: row.action_type,
      status: row.status,
      details: details,  // Parsed JSON or raw string
      created_at: row.created_at
    };
  });
};


// Function to delete a sent item by ID
export const deleteSentById = async (sentId: number) => {
  const sql = 'DELETE FROM sent WHERE id = ?';
  try {
    const [result] = await pool.query(sql, [sentId]);
    console.log(`Deleted sent item ${sentId}. Affected rows: ${result.affectedRows}`);
    return result;
  } catch (error) {
    console.error(`Failed to delete sent item ${sentId}: ${error.message}`);
    throw error;
  }
};


// Function to delete a log by ID
export const deleteLogById = async (logId) => {
  const sql = 'DELETE FROM action_logs WHERE id = ?';
  const [result] = await pool.query(sql, [logId]);
  console.log('Delete result:', result); // Debugging line
  return result;
};
