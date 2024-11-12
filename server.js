const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const emailValidator = require('email-validator');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // Middleware to handle JSON data and CORS for the frontend

// MySQL connection setup
console.log(process.env.DB_HOST)
const defaultdb = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.PORT
});

defaultdb.connect((err) => {
  if (err) {
    console.log(err)
    console.error('Error connecting to MySQL:', err.stack);
    return;
  }
  console.log('Connected to MySQL server.');
});

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the e-commerce API!');
});

// Route to create the 'cart' table in MySQL
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

// User registration route
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

// User login route
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

// Route to fetch all cart items
app.get('/api/cart', (req, res) => {
  const query = 'SELECT * FROM cart';
  defaultdb.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching cart', error: err });
    }
    res.json(results);
  });
});
app.delete('/api/cart/:id', (req, res) => {
  const itemId = req.params.id;
  const deleteQuery = 'DELETE FROM cart WHERE id = ?';

  defaultdb.query(deleteQuery, [itemId], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error deleting item from cart' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json({ message: 'Item removed successfully' });
  });
});
// Route to handle checkout and clear the cart
app.post('/api/checkout', (req, res) => {
  // Fetch cart items and calculate total
  const fetchCartQuery = 'SELECT * FROM cart';
  const clearCartQuery = 'DELETE FROM cart';

  defaultdb.query(fetchCartQuery, (err, cartItems) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching cart items for checkout' });
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Clear the cart
    defaultdb.query(clearCartQuery, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error clearing the cart after checkout' });
      }

      res.json({
        message: 'Checkout completed successfully. Cart is now empty.',
        cartItems,
        total,
      });
    });
  });
});
// Route to update cart item quantity
app.put('/api/cart/update-quantity', (req, res) => {
  const { id, action } = req.body;

  if (typeof id !== 'number' || !['increment', 'decrement'].includes(action)) {
    return res.status(400).json({ message: 'Invalid request parameters' });
  }

  // Query to fetch the cart item
  const fetchCartItemQuery = 'SELECT * FROM cart WHERE id = ?';
  defaultdb.query(fetchCartItemQuery, [id], (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching cart item' });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const item = result[0];
    let newQuantity = item.quantity;

    // Increment or decrement the quantity based on the action
    if (action === 'increment') {
      newQuantity++;
    } else if (action === 'decrement' && newQuantity > 1) {
      newQuantity--;
    }

    // Query to update the cart item quantity
    const updateQuantityQuery = 'UPDATE cart SET quantity = ? WHERE id = ?';
    defaultdb.query(updateQuantityQuery, [newQuantity, id], (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error updating cart item quantity' });
      }
      res.json({ message: 'Cart item quantity updated successfully', newQuantity });
    });
  });
});


// Route to add items to the cart
app.post('/api/cart', (req, res) => {
  const cart = req.body;

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
      return res.status(500).json({ message: 'Error inserting into cart', error: err });
    }
    res.status(201).json({ message: 'Items added successfully', result });
  });
});

// Start the server
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
