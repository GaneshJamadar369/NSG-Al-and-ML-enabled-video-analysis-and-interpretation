import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import bcrypt from "bcrypt";

const app = express();
const PORT = 5004; // signup.html fetch port ke saath match kare

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ------------------ MongoDB Atlas connection ------------------
mongoose.connect(
  "mongodb+srv://nirbhaykuthe2007_db_user:12345@cluster0.v7ai8pi.mongodb.net/nsgdb?retryWrites=true&w=majority",
  { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(() => console.log("MongoDB connected"))
.catch(err => console.log("MongoDB connection error:", err));

// ------------------ User Schema ------------------
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);

// ------------------ Signup Route ------------------
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if(!username || !email || !password){
      return res.json({ msg: "All fields are required" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if(existingUser){
      return res.json({ msg: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();

    res.json({ msg: "Signup successful" });

  } catch(err) {
    console.log(err);
    res.json({ msg: "Server error. Try again later." });
  }
});

// ------------------ Start Server ------------------
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
