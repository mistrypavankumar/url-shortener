require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const dns = require("dns");
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// Define the schema for URLs
const urlSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number,
});

// Create a model based on the schema
const URLModel = mongoose.model("URL", urlSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.use("/public", express.static(`${process.cwd()}/public`));

// Serve the static HTML file for the homepage
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});

// A simple API endpoint to check the API
app.get("/api/hello", (req, res) => {
  res.json({ greeting: "hello API" });
});

// POST endpoint to create a short URL
app.post("/api/shorturl", async (req, res) => {
  const originalUrl = req.body.url;
  // Regex to validate the basic structure of a URL
  const urlRegex = /^(https?:\/\/)(www\.)?[\w-]+(\.[\w-]+)+([\w.,@?^=%&amp;:/~+#-]*[\w@?^=%&amp;/~+#-])?$/;

  // Check if the URL is valid using regex
  if (!urlRegex.test(originalUrl)) {
    return res.status(404).json({ error: "invalid url" });
  }

  // Extract the hostname from the URL to perform DNS lookup
  try {
    const { hostname } = new URL(originalUrl);
    dns.lookup(hostname, async (err) => {
      if (err) {
        return res.status(404).json({ error: "invalid url" }); // Handle DNS errors by returning an 'invalid url' error
      }

      // Look for the URL in the database or create a new short URL entry
      try {
        const doc = await URLModel.findOne({ original_url: originalUrl });
        if (doc) {
          res.json({
            original_url: doc.original_url,
            short_url: doc.short_url,
          });
        } else {
          const shortUrl = Math.floor(Math.random() * 100000);
          const url = new URLModel({
            original_url: originalUrl,
            short_url: shortUrl,
          });
          const data = await url.save();
          res.json({
            original_url: data.original_url,
            short_url: data.short_url,
          });
        }
      } catch (dbError) {
        res.status(500).json({ error: "Database error" });
      }
    });
  } catch (urlError) {
    return res.status(400).json({ error: "invalid url" }); // Catch errors thrown by new URL() for invalid URLs
  }
});

// GET route to redirect to the original URL using the short URL
app.get("/api/shorturl/:short_url", async (req, res) => {
  try {
    const doc = await URLModel.findOne({ short_url: req.params.short_url });
    if (doc) {
      res.redirect(doc.original_url);
    } else {
      res.status(404).json({ error: "No short URL found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
