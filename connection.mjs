import pkg from 'pg';
const { Pool } = pkg; 

/* const pool = new Pool({   
    connectionString: process.env.DATABASE_URL,   
    ssl: { rejectUnauthorized: false } });  

const getConnection = async () => {   
    try {     
        const client = await pool.connect();    
        return client;      
    } catch (err) {   
        console.error("Error connecting to PostgreSQL database:", err);     
        throw err;   
    } };  

export default getConnection; */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,  
    ssl: {
        rejectUnauthorized: false // For development purposes only. Should be true in production.
    }
});

// Connect to the database
(async () => {
    try {
        await pool.connect();
        console.log("Connected to the database");
    } catch (error) {
        console.error("Error connecting to the database:", error);
    }
});

//export { pool };
export default pool;


/* 
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const getConnection = async () => {
    try {
        const client = await pool.connect();
        return {
            query: async (text, params) => {
                try {
                    const result = await client.query(text, params);
                    return result;
                } catch (queryError) {
                    console.error('Error executing query:', queryError);
                    throw queryError;
                }
            },
            release: () => client.release() // Make sure to release the client when done
        };
    } catch (connectionError) {
        console.error('Error connecting to PostgreSQL database:', connectionError);
        throw connectionError;
    }
};

export default getConnection;

 */