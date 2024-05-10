# Lokkeroom Authentication system Insights and code exemple.


```js
import pg from 'pg'
import express from 'express'
import bcrypt from 'bcrypt'
import JWT from 'jsonwebtoken'
import dotenv from 'dotenv'
import { promisify } from 'util'

const { Pool } = pg

// Loading variables from the .env file
dotenv.config()

const pool = new Pool()
await pool.connect()

// Launching express
const server = express()

// Promisify the JWT helpers
// => transform callback into Promise based function (async)
const sign = promisify(JWT.sign)
const verify = promisify(JWT.verify)

// Use the json middleware to parse the request body
server.use(express.json())

server.post('/api/register', async (req, res) => {
  const { email, nickname, password } = req.body

  if (!email || !password || !nickname)
    return res.status(400).send({ error: 'Invalid request' })

  try {
    const encryptedPassword = await bcrypt.hash(password, 10)

    await pool.query(
      'INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3)',
      [email, encryptedPassword, nickname]
    )

    return res.send({ info: 'User succesfully created' })
  } catch (err) {
    console.log(err)

    return res.status(500).send({ error: 'Internal server error' })
  }
})

server.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).send({ error: 'Invalid request' })

  const q = await pool.query(
    'SELECT password, id, nickname from users WHERE email=$1',
    [email]
  )

  if (q.rowCount === 0) {
    return res.status(404).send({ error: 'This user does not exist' })
  }

  const result = q.rows[0]
  const match = await bcrypt.compare(password, result.password)

  if (!match) {
    return res.status(403).send({ error: 'Wrong password' })
  }

  try {
    const token = await sign(
      { id: result.id, nickname: result.nickname, email },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS512',
        expiresIn: '1h',
      }
    )

    return res.send({ token })
  } catch (err) {
    console.log(err)
    return res.status(500).send({ error: 'Cannot generate token' })
  }
})

// This middleware will ensure that all subsequent routes include a valid token in the authorization header
// The 'user' variable will be added to the request object, to be used in the following request listeners
server.use(async (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).send('Unauthorized')

  try {
    const decoded = await verify(
      req.headers.authorization.split(' ')[1],
      process.env.JWT_SECRET
    )

    if (decoded !== undefined) {
      req.user = decoded
      return next()
    }
  } catch (err) {
    console.log(err)
  }

  return res.status(403).send('Invalid token')
})

server.get('/api/hello', (req, res) => {
  res.send({ info: 'Hello ' + req.user.nickname })
})

server.get('/api/users', async (req, res) => {
  const q = await pool.query('SELECT nickname from users')
  return res.send(q.rows)
})

server.listen(3000, () => console.log('http://localhost:3000'))
```

## line-By-line insights


### 1. Libraries Import

The code begins by importing a number of libraries that it uses:

```js
import pg from 'pg'
import express from 'express'
import bcrypt from 'bcrypt'
import JWT from 'jsonwebtoken'
import dotenv from 'dotenv'
import { promisify } from 'util'
```


> The pg library is used to connect to and interact with a PostgreSQL database. This could be used to create, read, update, or delete data from the database. The express library is used to create a web server and handle HTTP requests. This could be used to create endpoints that can be accessed by web clients, such as a web browser or a mobile app.

> The bcrypt library is used to securely hash and salt passwords. When a user registers for an account, their password is passed through the bcrypt library, which generates a hash of the password. This hash is then stored in the database instead of the plaintext password. When a user attempts to log in, their password is passed through the bcrypt library again, and the resulting hash is compared to the hash stored in the database. If the hashes match, the user's password is considered correct. The use of a hashing function like bcrypt makes it computationally infeasible for an attacker to determine the plaintext password from the hashed password, even if they have access to the hashed password.

> The jsonwebtoken library is used to generate and verify JSON web tokens. These tokens are used to authenticate users. When a user logs in, a JSON web token is generated and sent to the user. The user can then send this token back to the server with each subsequent request to prove that they are authenticated. The server can then use the jsonwebtoken library to verify the token and determine whether the user is allowed to access the requested resource.

> The dotenv library is used to load environment variables from a .env file. Environment variables are key-value pairs that can be used to configure the behavior of an application. For example, an environment variable might be used to specify the connection string for a database, or the secret key used to sign JSON web tokens. By using the dotenv library, you can store these values in a .env file and load them into your application without having to hard-code them into your source code. This makes it easier to manage different environment-specific configurations and to keep sensitive information like secret keys out of your source code.

> The promisify function is a utility function that converts a callback-based function to a promise-based


The pg library is used to connect to a PostgreSQL database, the express library is used to set up an HTTP server and handle routes, the bcrypt library is used to encrypt and compare passwords, the jsonwebtoken library is used to generate and verify JSON web tokens (JWT), and the dotenv library is used to load environment variables from a .env file. The promisify function from the built-in util library is used to transform the JWT functions from using callbacks to using Promises.

### 2. Setting up the Database pool

Next, the code creates a new Pool instance from the pg library, which will be used to manage the connection to the database:

```js
const { Pool } = pg

// Loading variables from the .env file
dotenv.config()

const pool = new Pool()
await pool.connect()
```


> The const { Pool } = pg line uses destructuring assignment to create a new variable called Pool and set it to the Pool class exported by the pg library. This allows the code to use the Pool class without having to reference it through the pg namespace.

> The dotenv.config() method is used to load variables from a .env file, which is a common way to manage environment-specific configurations in Node.js applications. This method loads the contents of the .env file into process.env, where the variables can be accessed in the rest of the application.

> The const pool = new Pool() line creates a new Pool instance, which represents a group of connections to a database that are managed together. This allows the application to reuse connections and improve performance.

> The await pool.connect() line asynchronously establishes a connection to the database. This is necessary before any queries can be executed against the database. The await keyword is used to pause the execution of the code until the connect() method completes, at which point the result of the operation is returned and the code continues to execute. This is a convenient way to handle asynchronous operations in JavaScript without using callback functions.


The dotenv.config() function is called to load the environment variables from the .env file. Then, a new Pool instance is created and await pool.connect() is called to connect to the database.

### 3. Setup your Http Server

After the database connection is established, the code sets up an HTTP server using the express library:

```js
// Launching express
const server = express()
```

> The const server = express() line creates a new instance of the express web framework, which is a popular and widely-used framework for building web applications in Node.js. This line creates an express object that can be used to configure and run the web server, define routes, and add middleware functions that are executed for each incoming request.

> The express framework provides a simple and intuitive way to create a web server that can handle HTTP requests and responses, and provides a rich set of features for building web applications. It is built on top of the popular http module in Node.js, and allows you to define routes that match specific URL patterns and HTTP methods. When a request is received by the server that matches a defined route, the associated request handler function is executed and can generate a response to be sent back to the client.

> In this code, the server object is used to define the routes and middleware functions that make up the application. It is also used to start the web server and listen for incoming requests on a specific port.



### 4. Setup Promises

The next step is to "promisify" the JWT functions, which means transforming them from using callbacks to using Promises:

```js
// Promisify the JWT helpers
// => transform callback into Promise based function (async)
const sign = promisify(JWT.sign)
const verify = promisify(JWT.verify)
```


> These lines of code use the promisify method from the util module to convert the sign and verify methods from the jsonwebtoken (JWT) library into Promise-based functions.

> JavaScript Promises are a pattern for handling asynchronous operations in JavaScript. They provide a way to write asynchronous code that is easier to read and reason about than using traditional callback functions. A Promise represents the eventual result of an asynchronous operation, and can be in one of three states: pending, fulfilled, or rejected.

> The promisify method is a utility function that takes a function that uses callbacks, and returns a new function that returns a Promise instead. This allows the code to use the await keyword to wait for the Promise to resolve, instead of using a callback function. This makes the code easier to read and understand, and allows it to be written in a more linear and synchronous-looking style.

> In this code, the sign and verify methods from the jsonwebtoken library are used to create and verify JWTs, respectively. These methods are callback-based, so they are passed to the promisify method to convert them into Promise-based functions that can be used with the await keyword. This allows the code to use the await keyword when calling the sign and verify methods, making it easier to read and understand.


This is done using the promisify function from the util library.

### 5. Setup the register route

Next, the code sets up the /api/register route, which allows users to register by sending a POST request with their email, nickname, and password in the request body:

```js
server.post('/api/register', async (req, res) => {
  const { email, nickname, password } = req.body

  if (!email || !password || !nickname)
    return res.status(400).send({ error: 'Invalid request' })

  try {
    const encryptedPassword = await bcrypt.hash(password, 10)

    await pool.query(
      'INSERT INTO users (email, password, nickname) VALUES ($1, $2, $3)',
      [email, encryptedPassword, nickname]
    )

    return res.send({ info: 'User succesfully created' })
  } catch (err) {
    console.log(err)

    return res.status(500).send({ error: 'Internal server error' })
  }
})
```


> These lines of code define a route handler for the /api/register route, which is used to register a new user in the application. This route handler is attached to the server object using the server.post method, which specifies that this route should be matched for HTTP POST requests to the /api/register URL.

> The route handler function takes two arguments: req and res, which represent the incoming request and the response to be sent back to the client, respectively. This function is marked as async, which allows it to use the await keyword to wait for asynchronous operations to complete.

> Inside the function, the const { email, nickname, password } = req.body line uses destructuring assignment to extract the email, nickname, and password properties from the body property of the req object. This is used to extract the user-provided registration information from the request body.

> Next, the if statement checks if any of these properties is missing or falsy, and if so, it sends an error response with a status code of 400 (Bad Request) and an error message indicating that the request was invalid. This is used to validate the request and ensure that all required information was provided.

> The try block contains the main logic for handling the user registration. It first uses the bcrypt.hash method to asynchronously encrypt the user's password using the bcrypt algorithm. This is necessary to securely store the password in the database, as it should never be stored in plaintext.

> After the password is encrypted, the code uses the await pool.query method to execute an SQL query that inserts a new row into the users table with the provided email, password, and nickname values. This is used to persist the user's registration information in the database.

> If the query is successful, the code sends a response to the client with a status code of 200 (OK) and a success message indicating that the user was created successfully.

> The catch block is used to handle any errors that may have occurred during the execution of the try block. If an error is thrown, the console.log(err) line logs the error to the console, and the code sends a response to the client with a status code of 500 (Internal Server Error) and an error message indicating that an internal server error occurred.

The route first checks that the request body includes the required email, nickname, and password fields. If any of these fields is missing, the route sends an error response with a 400 status code.

Next, the code encrypts the user's password using the bcrypt.hash function, which returns a Promise that resolves to the encrypted password. The await keyword is used to wait for the Promise to resolve.

Once the password is encrypted, the code inserts a new record into the users table in the database using the pool.query function. This function also returns a Promise, which is again awaited to wait for the query to complete. If the query is successful, the route sends a success message to the user.

If any errors occur while registering the user (for example, if the email is already in use or if there is a problem with the database connection), the catch block is executed and an error response is sent to the user with a 500 status code.


### 6. Setup the login route

```js
server.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password)
    return res.status(400).send({ error: 'Invalid request' })

  const q = await pool.query(
    'SELECT password, id, nickname from users WHERE email=$1',
    [email]
  )

  if (q.rowCount === 0) {
    return res.status(404).send({ error: 'This user does not exist' })
  }

  const result = q.rows[0]
  const match = await bcrypt.compare(password, result.password)

  if (!match) {
    return res.status(403).send({ error: 'Wrong password' })
  }

  try {
    const token = await sign(
      { id: result.id, nickname: result.nickname, email },
      process.env.JWT_SECRET,
      {
        algorithm: 'HS512',
        expiresIn: '1h',
      }
    )

    return res.send({ token })
  } catch (err) {
    console.log(err)
    return res.status(500).send({ error: 'Cannot generate token' })
  }
})
```

> These lines of code define a route handler for the /api/login route, which is used to authenticate an existing user in the application. This route handler is attached to the server object using the server.post method, which specifies that this route should be matched for HTTP POST requests to the /api/login URL.

> The route handler function takes two arguments: req and res, which represent the incoming request and the response to be sent back to the client, respectively. This function is marked as async, which allows it to use the await keyword to wait for asynchronous operations to complete.

> Inside the function, the const { email, password } = req.body line uses destructuring assignment to extract the email and password properties from the body property of the req object. This is used to extract the user-provided login information from the request body.

> Next, the if statement checks if either of these properties is missing or falsy, and if so, it sends an error response with a status code of 400 (Bad Request) and an error message indicating that the request was invalid. This is used to validate the request and ensure that all required information was provided.

> The const q = await pool.query line executes an SQL query that retrieves the password, id, and nickname values for the user with the provided email address from the users table. This query is used to retrieve the user's information from the database and check their password.

> If the query returns no rows, the code sends a response to the client with a status code of 404 (Not Found) and an error message indicating that the user does not exist. This is used to inform the client that the provided email address does not match any existing users in the database.

> If the query returns a row, the const result = q.rows[0] line extracts the first row of the query result and saves it in a result variable. This is used to access the user's information, including their encrypted password.

> Next, the const match = await bcrypt.compare(password, result.password) line uses the bcrypt.compare method to asynchronously compare the provided password with the encrypted password from the database. This method returns a boolean value indicating whether the two passwords match.

> If the provided password does not match the encrypted password from the database, the code sends a response to the client with a status code of 403 (Forbidden) and an error message indicating that the password was incorrect. This is used to inform the client that the provided password was not correct for the specified user.

> If the provided password matches the encrypted password from the database, the code enters the try block and uses the await sign method to asynchronously create a new JWT using the jsonwebtoken library


The /api/login route works similarly to the /api/register route, but it first queries the database to find the user's record and then compares the provided password to the encrypted password stored in the database. If the password is correct, the route generates a JWT using the jsonwebtoken.sign function and sends it back to the user.


### 7. Setup the middleware

After the /api/register and /api/login routes are set up, the code defines a middleware function that is used to verify that all subsequent requests include a valid JWT in the Authorization header:

```js
server.use(async (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).send('Unauthorized')

  try {
    const decoded = await verify(
      req.headers.authorization.split(' ')[1],
      process.env.JWT_SECRET
    )

    if (decoded !== undefined) {
      req.user = decoded
      return next()
    }
  } catch (err) {
    console.log(err)
  }

  return res.status(403).send('Invalid token')
})

```


> These lines of code define a middleware function that is used to authenticate requests that include a JWT in the Authorization header. This middleware is attached to the server object using the server.use method, which specifies that this middleware should be executed for all incoming requests.

> The middleware function takes three arguments: req, res, and next, which represent the incoming request, the response to be sent back to the client, and the next middleware function in the chain, respectively. This function is marked as async, which allows it to use the await keyword to wait for asynchronous operations to complete.

> Inside the function, the if statement checks if the Authorization header is missing or falsy. If so, the code sends a response to the client with a status code of 401 (Unauthorized) and a message indicating that the request is unauthorized. This is used to prevent unauthorized access to the protected routes that come after this middleware in the chain.

> If the Authorization header is present, the try block is executed. It first uses the verify method from the jsonwebtoken library to asynchronously verify the JWT included in the Authorization header. This method takes the JWT as its first argument, and the JWT secret used to sign the JWT as its second argument. If the JWT is valid and has not expired, it returns the decoded JWT payload as an object.

> If the verify method returns a valid JWT payload, the req.user property is set to the decoded JWT payload, and the next function is called to continue to the next middleware in the chain. This sets a user property on the request object that contains the decoded JWT payload, and makes this information available to the subsequent route handlers.

This middleware function is called for every request that is sent to the server. If the request does not include an Authorization header, the function sends a 401 status code response indicating that the request is unauthorized.

If the Authorization header is present, the function uses the jsonwebtoken.verify function (which was promisified earlier) to verify the JWT. If the JWT is valid, the decoded user information is added to the req object and the request is allowed to continue to the next step. If the JWT is invalid or if there is an error while verifying the JWT, the function sends a 403 status code response indicating that the token is invalid.

After the middleware function, the code defines two example routes that demonstrate how to access the user information from the request object and how to use the database connection:


```js
server.get('/api/hello', (req, res) => {
  res.send({ info: 'Hello ' + req.user.nickname })
})

server.get('/api/users', async (req, res) => {
  const q = await pool.query('SELECT nickname from users')
  return res.send(q.rows)
})
```

The /api/hello route simply sends a message that includes the user's

The final step in the code is to start the server and listen for incoming requests:

```js
server.listen(3000, () => console.log('http://localhost:3000'))
```
This starts the server on port 3000 and logs a message to the console indicating the URL that can be used to access the server.



