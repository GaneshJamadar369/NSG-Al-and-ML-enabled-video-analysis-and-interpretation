const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors()); // allow requests from any origin (for testing)
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/nsgdb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(()=> console.log('MongoDB connected'))
  .catch(err=> console.log(err));

// Create user schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String
});

const User = mongoose.model('User', userSchema);

// Signup API
app.post('/signup', async (req,res)=>{
  try{
    const { username, email, password } = req.body;
    if(!username || !email || !password){
      return res.status(400).json({ message:'Fill all fields' });
    }

    const newUser = new User({ username, email, password });
    await newUser.save();
    res.json({ message: 'Signup successful!' });
  } catch(err){
    res.status(500).json({ message:'Server error' });
  }
});

// Optional: view all users (for testing only)
app.get('/users', async (req,res)=>{
  const users = await User.find({}, { password:0 });
  res.json(users);
});

// Start server
app.listen(PORT, ()=> console.log(`Server running on http://localhost:${PORT}`));
