
import express from 'express';
import pool from './connection.mjs';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import util from 'util';
import JWT from 'jsonwebtoken';
import cors from 'cors';

//import paginate from './pagination.mjs';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

const { promisify } = util;
const sign = promisify(JWT.sign);
const verify = promisify(JWT.verify);

app.use(cors());
app.use(express.json());

//Register route
app.post('/api/register', async (req, res) => {
    const { email, password, nickname, role } = req.body;
    //By default, a user is a member and not an admin
    if (!email || !password || !role || !nickname) {
      return res.status(400).send({ error: 'Invalid request' });
    };

    try {
      const encryptedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (nickname, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [nickname, email, encryptedPassword, role]
      );
      //return res.send("it went well ! user added");
      return res.status(201).send(result.rows[0]);
       
    } catch (err) {
      console.log(err);

      return res.status(500).send({ error: 'Internal server error' });
    };
});



//Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).send({ error: 'Invalid request' });
  } else {
    const q = await pool.query(
      'SELECT password, id, nickname, role from users WHERE email=$1',
      [email]
    );

    if (q.rowCount === 0) {
      res.status(404).send({ error: 'This user does not exist/Invalid Credentials' });
    } else {
      const result = q.rows[0];
      const match = await bcrypt.compare(password, result.password);
  
      if (!match) {
        res.status(403).send({ error: 'Wrong Password/Invalid Credentials' })
      } else {
        try {
          const accessToken = await sign(
            { id: result.id, nickname: result.nickname, email, role: result.role },
            process.env.JWT_SECRET,{ algorithm: 'HS512', expiresIn: '1h' }
          )
          console.log(req.headers['authorization']);
          return res.send({ accessToken, result });
        } catch (err) {
          console.log(err)
          return res.status(500).send({ error: 'Cannot access token' });
        }
      }
    }
  }
});



//Middleware that ensure Bearer tokens enable requests to authenticate using an access key (JWT)
app.use(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token;   //Bearer TOKEN

  /* if (authHeader) {
      token = authHeader.split(' ')[1];
      console.log("bonjour");
  }; */

  if (!authHeader) {
     return res.status(401).send('Unauthorized'); //without token
  };

  try {
    console.log("ici");
    token = authHeader.split(' ')[1];
    console.log("bonjour");
    const decoded = await verify(token, process.env.JWT_SECRET);
    console.log(decoded);

    if (decoded !== undefined) {
      req.user = decoded;
      return next();
    };

  } catch(err) {
    console.log(err);
    res.status(403).send('Invalid token');
  };
});



//Create a lobby (by the admin only)
app.post('/api/lobby', async (req, res) => { 
  const authHeader = req.headers['authorization'];
  let token = authHeader.split(' ')[1];
  const currentUser = JWT.verify(token, process.env.JWT_SECRET);
  const { name } = req.body;

  try {
    if (currentUser.role === "admin") {
      const result = await pool.query(
        'INSERT INTO lobbies (name) VALUES ($1) RETURNING *',
        [name]
      );
      res.status(201).send(result.rows[0]);
    } else {
      return res.status(401).send({ error: 'Unauthorized, You are not an admin !' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});



//Add an user into a lobby
app.post('/api/lobby/:id/add-user', async (req, res) => { 
  //The current logged in user
  const authHeader = req.headers['authorization'];
  let token = authHeader.split(' ')[1];
  const currentUser = JWT.verify(token, process.env.JWT_SECRET);
  console.log(currentUser.id);
 // console.log(currentUser.role);
  
  if (currentUser.role !== "admin") {
    return res.status(401).send({ error: 'Unauthorized' });
  };

    const { nickname, email } = req.body;
    if (!email || !nickname) {
      res.status(400).send({ error: 'Invalid request' });
    };

  try {
    const qIdNewUser = await pool.query(
      'SELECT id from users WHERE email=$1 AND nickname = $2',
      [email, nickname]
    );
  
    if (qIdNewUser.rowCount === 0) {
      res.status(404).send({ error: 'This user does not exist' });
    };
  
    const idNewUser = qIdNewUser.rows[0].id;
    console.log(idNewUser);

    //The id of the lobby in which we want to add the user
    let idLobby = req.params.id;
    //Find if the id lobby in param exists in the database
    const resultLobby = await pool.query(
      'SELECT * FROM lobbies WHERE id = $1',
      [idLobby]
    );

    if (isNaN(idLobby)) {
        return res.status(400).send({msg: "Bad Request. Invalid lobby's id !"});
    };
    
    if (resultLobby.rowCount === 0) {
        return res.status(404).send({msg: "This lobby does not exist"});
    }; 

    const  data  =  await pool.query(`SELECT * FROM users_lobbies WHERE user_id= $1 AND lobby_id= $2 ;`, [idNewUser, idLobby]); //Checking if user already exists
    const  arr  =  data.rows;  
    if (arr.length  !=  0) {
      return  res.status(400).json({error: "User already there, No need to add him again.",});
    } else {
      //Add the user into the rigth lobby (relation)
      const qNewUser = await pool.query(
        'INSERT INTO users_lobbies (user_id, lobby_id) VALUES ($1, $2) RETURNING *',
        [idNewUser, idLobby]
      );

      if (qNewUser.rowCount === 0) {
        return res.status(404).send({ error: 'User not added in the lobby' });
      } else {
        return res.status(201).send({ msg : 'User successfully added in the lobby !' });
      };
    };
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  };
});



//Add a message into a lobby
app.post('/api/lobby/:id', async (req, res) => { 
  //The current logged in user
  const authHeader = req.headers['authorization'];
  let token = authHeader.split(' ')[1];
  const currentUser = JWT.verify(token, process.env.JWT_SECRET);
  const { content } = req.body;
  if (!content) {
    return res.status(400).send({ error: 'Invalid request' });
  };


  try {
    //The id of the lobby in which we want to add the user
    let idLobby = req.params.id;
    //Find if the id lobby in param exists in the database
    const resultLobby = await pool.query(
      'SELECT * FROM lobbies WHERE id = $1',
      [idLobby]
    );

    if (isNaN(idLobby)) {
        return res.status(400).send({msg: "Bad Request. Invalid lobby's id !"});
    };
    
    if (resultLobby.rowCount === 0) {
        return res.status(404).send({msg: "This lobby does not exist"});
    }; 

    let data = await pool.query(`SELECT * FROM users_lobbies WHERE user_id= $1 AND lobby_id= $2 ;`, [currentUser.id, idLobby]);
    const  arr  =  data.rows;  

    if (arr.length  !=  0) {
      //Add the user's message into his lobby
      const qNewUser = await pool.query(
      'INSERT INTO messages (content, user_id, lobby_id) VALUES ($1, $2, $3) RETURNING *',
      [content, currentUser.id, idLobby]
      ); 
      if (qNewUser.rowCount === 0) {
        res.status(404).send({ error: 'Your message has not been posted !' });
      } else {
        res.status(201).send({  msg : 'Your message has been successfully posted in your lobby !'  });
      };

    } else {
      return  res.status(400).json({error: "You cannot post your message in this lobby : You are not registered in this lobby !",});
    };
      
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  };
});


//Retrieve all messages content from a lobby in an array
app.get('/api/lobby/:id', async (req, res) => {
  let arrayOfMessages = [];
  let idLobby = req.params.id;
  try {
    //Find if the id lobby in param exists in the database
    const resultLobby = await pool.query(
      'SELECT * FROM lobbies WHERE id = $1',
      [idLobby]
    );

    if (isNaN(idLobby)) {
        return res.status(400).send({msg: "Bad Request. Invalid lobby's id !"});
    };
    
    if (resultLobby.rowCount === 0) {
        return res.status(404).send({msg: "This lobby does not exist"});
    }; 

    const messages = await pool.query('SELECT DISTINCT m.content, m.user_id, u.nickname FROM messages m, users_lobbies ul, users u WHERE m.lobby_id = ul.lobby_id AND m.user_id = u.id AND m.lobby_id = $1',
    [idLobby]);

    let arrOfMessages = messages.rows;
    arrOfMessages.forEach(message => {
      // console.log(message.content);
      arrayOfMessages.push({"content": message.content, "user": message.user_id, "username": message.nickname});
    });

    if (arrayOfMessages.length === 0) {
      return res.send("No messages in this lobby");
    };

    res.send(arrayOfMessages);

  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});



//Retrieve a specific message's content from a lobby
app.get('/api/lobby/:idLobby/:idMessage', async (req, res) => {
  let idLobby = req.params.idLobby;
  let idMessage = req.params.idMessage;
  
  if (isNaN(idLobby) || isNaN(idMessage) ) {
    return res.status(400).send({msg: "Bad Request. Invalid lobby's or Message's id !"});
  };

  try {
    //Find if the id lobby in param exists in the database
    const resultLobby = await pool.query(
      'SELECT * FROM lobbies WHERE id = $1',
      [idLobby]
    );
    //Find if the id message in param exists in the database
    const resultMessage= await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [idMessage]
    );

    if (resultLobby.rowCount === 0 || resultMessage.rowCount === 0) {
        return res.status(404).send({msg: "This lobby or this Message does not exist"});
    }; 

    const message = await pool.query('SELECT DISTINCT content FROM messages m, users_lobbies ul WHERE m.lobby_id = ul.lobby_id AND m.lobby_id = $1 AND m.id = $2',
    [idLobby, idMessage]);

    if (message.rowCount === 0) {
      return res.status(404).send({msg: "No match ! : No message for this lobby or this message does not exist in this lobby !"});
    }

    res.send(message.rows[0]);
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});



//Retrieve all users from the same lobby as the logged in user
app.get('/api/users', async (req, res) => {
  const currentUser = req.user;
//  const paginatedResults = res.paginatedResults;
  
  try {
    //To know the id lobby of the logged in user
    const currentUserLobby = await pool.query('SELECT lobby_id FROM users_lobbies ul, users u WHERE u.id = ul.user_id AND u.id = $1', [currentUser.id]);

    if (currentUserLobby.rowCount === 0) {
      return res.status(403).send({ error: 'You cannot access this feature, you are not yet a part of a lobby !' });
    }

    let currentIdLobby = currentUserLobby.rows[0].lobby_id;
    const result = await pool.query('SELECT u.nickname, u.id, ul.lobby_id FROM users u, users_lobbies ul WHERE u.id = ul.user_id AND ul.lobby_id = $1', [currentIdLobby]);
    
    if (currentUser.role === "member") {
      console.log(result);
       if (result.rowCount === 0 || result.rows[0].id == currentUser.id) {
        return res.send("No other person is in your lobby !");
      } else {
      // Retrieve data from all user in the same lobby
        return res.send(result.rows);
       
      } 

      //res.json(paginatedResults);
     // const allUsersFromLobby = paginatedResults.data.map(element =>  element);
     // res.json(allUsersFromLobby);
      
    } else if (currentUser.role === "admin") {
      const allUsers = await pool.query('SELECT nickname FROM users');
      return res.json(allUsers.rows);
    //  return res.json(paginatedResults);
    } else {
      return res.status(403).send({ error: 'Unauthorized !' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});



//Retrieve a specific user (admin can see users from all lobbies, member can see user only from their lobby)
app.get('/api/users/:id', async (req, res) => {
  const currentUser = req.user;
  let paramIdUser = req.params.id;
  
  if (isNaN(paramIdUser)) {
    return res.status(400).send({msg: "Bad Request. Invalid lobby's or Message's id !"});
  };

  try {
    const currentUserLobby = await pool.query('SELECT lobby_id FROM users_lobbies ul, users u WHERE u.id = ul.user_id AND u.id = $1', [currentUser.id]);
    let currentIdLobby = currentUserLobby.rows[0].lobby_id;
    const result = await pool.query('SELECT u.nickname, u.email, u.role, u.id FROM users u, users_lobbies ul WHERE u.id = ul.user_id AND ul.lobby_id = $1 AND ul.user_id = $2', 
    [currentIdLobby, paramIdUser]);

    if (currentUser.role === "member") {
      if (result.rowCount === 0) {
        return res.send("This person is not in your lobby or unexistant !");
      } else if (result.rows[0].id == currentUser.id) {
        return res.send("This is you !");
      } else {
        return res.send(result.rows);
      }
    } else if (currentUser.role === "admin") {
      const allUsers = await pool.query('SELECT nickname, email, id, role FROM users WHERE id= $1',
      [paramIdUser]);
      
      if (result.rowCount === 0) {
        return res.send("This person is unexistant !");
      } else if (allUsers.rows[0].id == currentUser.id) {
        console.log(allUsers.rows[0].id);
        console.log(currentUser.id);

        res.send("This is you !");
      };
      res.send(allUsers.rows);

    } else {
      return res.status(403).send({ error: 'Unauthorized !' });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});



//Delete a user from a lobby (for admin only)
app.delete('/api/lobby/:idLobby/remove-user', async (req, res) => {
  const currentUser = req.user;
  let idLobby = req.params.idLobby;
  const { nickname, email, id } = req.body;

  if (!email || !nickname) {
    res.status(400).send({ error: 'Invalid request' });
  };
  const resultLobby = await pool.query(
    'SELECT * FROM lobbies WHERE id = $1',
    [idLobby]
  );

  if (isNaN(idLobby)) {
    return res.status(400).send({msg: "Bad Request. Invalid lobby's or Message's id !"});
  };

  if (resultLobby.rowCount === 0) {
    return res.status(404).send({msg: "This lobby does not exist"});
  }; 

  try {
    if (currentUser.role === "admin") {
      const  dataFromLobby  =  await pool.query(`SELECT * FROM users_lobbies WHERE user_id= $1 AND lobby_id= $2 ;`, [id, idLobby]); //Checking if user already exists
      const  arrLobby  =  dataFromLobby.rows;  

      if (arrLobby.length ===  0) {
        return  res.status(400).json({error: "This user does not exist in the lobby.",});
      } else {
        //Remove the user from the rigth lobby (relation)
        const userToDelete = await pool.query(
          'DELETE FROM users_lobbies WHERE user_id= $1 AND lobby_id= $2',
          [id, idLobby]
        );
        //Remove all messages from the user we want to delete
        const messagesToDelete = await pool.query(
          'DELETE FROM messages WHERE user_id= $1 AND lobby_id= $2',
          [id, idLobby]
        );
  
       /*  if (userToDelete.rowCount === 0) {
          res.status(404).send({ error: 'The user has not been deleted from the lobby' });
        } else {
          res.status(201).send({ msg : 'The user has been successfully deleted from the lobby !' });
        }; */
        res.status(201).send({ msg : 'The user and his messages has been successfully deleted from the lobby !' });
      };
    } else {
      return res.status(401).send({error : 'You do not have the right to delete a user !' });
    }
  } catch(err) {
    console.log(err);
    return res.status(500).send({ err: 'Internal server error' });
  }
});



//Delete a message (Admin can delete all messages and member just their own)
app.delete('/api/messages/:idMessage', async (req, res) => {
  const currentUser = req.user;
  let idMessage = req.params.idMessage;
  
  if (isNaN(idMessage) ) {
    return res.status(400).send({msg: "Bad Request. Invalid message's id !"});
  };

  const resultMessage = await pool.query(
    'SELECT * FROM messages WHERE id = $1',
    [idMessage]
  );

  if (resultMessage.rowCount === 0) {
    return res.status(404).send({msg: "This message does not exist"});
  }; 

  try {
    if (currentUser.role === "admin") {
      const deletedMessage = await pool.query(
        'DELETE FROM messages WHERE id=$1',
        [idMessage]
      );
      res.status(201).send({ msg : 'The message has been successfully deleted from the lobby !' });
    } else {
      const deletedMessage = await pool.query(
        'DELETE FROM messages WHERE id=$1 AND user_id = $2',
        [idMessage, currentUser.id]
      );
      if (deletedMessage.rowCount === 0) {  //It means there is no match, no corresponding row
        return res.status(403).send({ error: 'You are not authorized to delete this message. This message has been sent by another member !' });
      } else {
        return res.status(201).send({msg: "The message has been successfully deleted from the lobby !"});
      };
    };

  } catch(err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});




//Edit a message (Admin can edit all messages and member can only edit their own)
app.patch('/api/lobby/:idMessage', async (req, res) => {
  const currentUser = req.user;
  let idMessage = req.params.idMessage;
  const { content } = req.body;

  if (!content) {
    res.status(400).send({ error: 'Invalid request' });
  };

  if (isNaN(idMessage) ) {
    return res.status(400).send({msg: "Bad Request. Invalid message's id !"});
  };

  const resultMessage = await pool.query(
    'SELECT * FROM messages WHERE id = $1',
    [idMessage]
  );

  if (resultMessage.rowCount === 0) {
    return res.status(404).send({msg: "This message does not exist"});
  }; 

  try {
    if (currentUser.role === "admin") {
      const editedMessage = await pool.query(
        'UPDATE messages SET content = $1 WHERE id= $2',
        [content, idMessage]
      );
      res.status(201).send({ msg : 'The message has been successfully updated !' });
    } else {
      const editedMessage = await pool.query(
        'UPDATE messages SET content = $1 WHERE id= $2 AND user_id = $3',
        [content, idMessage, currentUser.id]
      );
      if (editedMessage.rowCount === 0) {  //It means there is no match, no corresponding row
        return res.status(403).send({ error: 'You are not authorized to update this message. This message does not belong to you !' });
      } else {
        return res.status(201).send({msg: "The message has been successfully updated !"});
      };
    };
  } catch (err) {
    console.log(err);
    return res.status(500).send({ error: 'Internal server error' });
  }
});



/* app.get('/api/users', async (req, res) => {
  const result = await pool.query('SELECT id, nickname, email, role FROM users');
  res.send(result.rows);
}) */

app.listen(PORT, () => console.log(`Server locker started on ${PORT}`));