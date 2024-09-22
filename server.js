const express = require('express');
const app = express();
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config();
const bcrypt = require('bcrypt');
const emailValidator = require('email-validator');

// Middleware to handle JSON data and CORS for the frontend
app.use(express.json());

const defaultdb = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});
defaultdb.connect((err) => {
  if (err) {
      console.error('Error connecting to MySQL:', err.message);
      return;
  }
  console.log('Connected to MySQL server.');
});
app.use(cors());
app.get('/create-cart-table', (req, res) => {
  const sql = `
  CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    image VARCHAR(255) NOT NULL,
    description TEXT NOT NULL
  )`;
  defaultdb.query(sql, (err, result) => {
      if (err) throw err;
      res.send('Cart table created!');
  });
});

// Sample API route

app.post('/api/register', (req, res) => {
  const { email, password } = req.body;

  // Validate email
  if (!email || !emailValidator.validate(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
  }

  // Validate password
  if (!password) {
      return res.status(400).json({ message: 'Password cannot be empty' });
  }

  const checkUserQuery = 'SELECT * FROM users WHERE email = ?';
  defaultdb.query(checkUserQuery, [email], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Server error' });
      }
      if (result.length > 0) {
          return res.status(400).json({ message: 'User already exists' });
      }

      // Hash the password
      bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
              return res.status(500).json({ message: 'Error hashing password' });
          }

          const insertUserQuery = 'INSERT INTO users (email, password) VALUES (?, ?)';
          defaultdb.query(insertUserQuery, [email, hashedPassword], (err, result) => {
              if (err) {
                  return res.status(500).json({ message: 'Database error' });
              }
              res.status(201).json({ message: 'User registered successfully' });
          });
      });
  });
});
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !emailValidator.validate(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
  }

  if (!password) {
      return res.status(400).json({ message: 'Password cannot be empty' });
  }

  const query = 'SELECT * FROM users WHERE email = ?';
  defaultdb.query(query, [email], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Server error' });
      }
      if (result.length === 0) {
          return res.status(400).json({ message: 'User not found' });
      }

      const user = result[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err) {
              return res.status(500).json({ message: 'Error comparing passwords' });
          }
          if (isMatch) {
              return res.json({ message: 'Login successful' });
          } else {
              return res.status(400).json({ message: 'Invalid credentials' });
          }
      });
  });
});


// Route to add product to the cart
app.get('/api/cart', (req, res) => {
  const query = 'SELECT * FROM cart';
  defaultdb.query(query, (err, results) => {
      if (err) {
          return res.status(500).json({ message: 'Error fetching cart', error: err });
      }
      res.json(results);
  });
});

// API to add a item
app.post('/api/cart', (req, res) => {
  const cart = req.body;
  console.log(cart);

  // Validate if cart items contain all required fields
  for (const item of cart) {
    if (!item.name || !item.price || !item.quantity || !item.image || !item.description) {
      return res.status(400).json({ message: 'All fields are required' });
    }
  }

  // SQL query to insert data into the "cart" table
  const query = `
      INSERT INTO cart (name, price, quantity, image, description)
      VALUES ?
  `;
  const values = cart.map(item => [
    item.name,
    item.price,
    item.quantity,
    item.image,
    item.description
  ]);

  // Execute query to insert data
  defaultdb.query(query, [values], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: 'Error inserting into cart', error: err });
    }
    res.status(201).json({ message: 'Items added successfully', result });
  });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
