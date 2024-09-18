import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Function to format date to MySQL DATETIME format
const formatDateForMySQL = (date) => {
  const d = new Date(date);
  const pad = (n) => (n < 10 ? '0' + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Function to initialize database schema
const initializeDatabase = async () => {
  try {
    // Create tables if they do not exist
    await createTables();
    console.log('Database initialization successful');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

// Function to create necessary tables
const createTables = async () => {
  const connection = await pool.getConnection();
  try {
    // Create 'schedule' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wf TEXT NOT NULL,
        event TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        dt DATETIME NOT NULL,
        companyId VARCHAR(255) NOT NULL
      );
    `);

    // Create 'processed_events' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS processed_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        workflow_id VARCHAR(255) NOT NULL,
        processed_at DATETIME NOT NULL,
        UNIQUE KEY (event_id, workflow_id)
      );
    `);

    // Create 'sent' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sent (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wf TEXT NOT NULL,
        event TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        dt DATETIME NOT NULL,
        companyId VARCHAR(255) NOT NULL
      );
    `);

    // Create 'workflows' table (Note: `trigger` is a reserved keyword, so it needs backticks)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`trigger\` VARCHAR(255),
        action VARCHAR(255),
        settings TEXT,
        name VARCHAR(255),
        companyId VARCHAR(255),
        dt DATETIME,
        \`timestamp\` DATETIME
      );
    `);

    // Create 'sessions' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        data TEXT,
        expires DATETIME NULL
      );
    `);

    // Create 'oauth_tokens' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        companyId VARCHAR(255) PRIMARY KEY,
        token TEXT
      );
    `);

    // Create 'apptokens' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS apptokens (
        companyId VARCHAR(255) PRIMARY KEY,
        appToken TEXT
      );
    `);

    // Create 'action_logs' table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(255) NOT NULL,
        workflow_id INT NOT NULL,
        company_id VARCHAR(255) NOT NULL,
        action_type ENUM('email', 'sms', 'webhook') NOT NULL,
        status ENUM('success', 'failure') NOT NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

  } finally {
    connection.release(); // Release the connection back to the pool
  }
};

// Function to add a workflow
const addWorkflow = async (workflowData) => {
  const { trigger, action, settings, name, companyId, dt } = workflowData;

  const formattedDt = formatDateForMySQL(dt);  // Ensure the date is formatted here

  const sql = `
    INSERT INTO workflows (\`trigger\`, action, settings, name, companyId, dt, \`timestamp\`)
    VALUES (?, ?, ?, ?, ?, ?, NOW())
  `;
  
  try {
    await pool.query(sql, [trigger, action, settings, name, companyId, formattedDt]);
    console.log('Workflow added successfully');
  } catch (error) {
    console.error('Error adding workflow:', error);
    throw error; // Re-throw the error after logging it
  }
};

// Initialize database when this module is loaded
initializeDatabase();

export { pool, addWorkflow };
