
//import getConnection from './connection.mjs';
import pool from './connection.mjs';

const paginate = (tableName, lobbyFilter) => {
    return async (req, res, next) => {
      try {
        const page = parseInt(req.query.page) || 1; // Default page to 1 if not provided
        const limit = parseInt(req.query.limit) || 3; // Default limit to 3 if not provided
        const currentUser = req.user;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const results = {};
        let totalCountQuery;
        let paginatedQuery;
        lobbyFilter = false;
        
        // Construct the base query to fetch paginated records
        let baseQuery = `SELECT * FROM ${tableName}`;

        if (lobbyFilter && currentUser.role === "member") {
            baseQuery += `
            WHERE ${tableName}.id IN (
                SELECT user_id FROM users_lobbies 
                WHERE lobby_id = (SELECT lobby_id FROM users_lobbies WHERE user_id = $1)
            )`;
            totalCountQuery = await pool.query(`SELECT COUNT(*) FROM (${baseQuery})`, [currentUser.id]);
        } else {
            totalCountQuery = await pool.query(`SELECT COUNT(*) FROM (${baseQuery})`);
        };
        
        // Fetch total count of records in the specified table
        const totalCount = parseInt(totalCountQuery.rows[0].count);
  
        if (endIndex < totalCount) {
          results.next = {
            page: page + 1,
            limit: limit
          }
        };
  
        if (startIndex > 0) {
          results.previous = {
            page: page - 1,
            limit: limit
          }
        };
  
        // Fetch paginated records from the specified table
        if (lobbyFilter && currentUser.role === "member") {
             paginatedQuery = await pool.query(
                `${baseQuery} OFFSET $2 LIMIT $3`,
                [currentUser.id, startIndex, limit]
              );
        } else {
            paginatedQuery = await pool.query(
                `${baseQuery} OFFSET $1 LIMIT $2`,
                [startIndex, limit]
              );
        }
    
        results.data = paginatedQuery.rows;
        // Attach paginated results to the response object
        res.paginatedResults = results;
        next();

      } catch (error) {
        console.error('Pagination middleware error:', error);
        return res.status(500).json({ error: 'Internal server error with pagination' });
      }
    };
  };
  
export default paginate;