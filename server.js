const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const OpenAI = require('openai');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Constants
const MAX_PDF_TEXT_FOR_ANALYSIS = 3000;
const TEXT_PREVIEW_LENGTH = 500;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Validate OpenAI API Key
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in environment variables');
  console.error('Please create a .env file and add your OpenAI API key');
  process.exit(1);
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rate limiting to prevent DoS attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Route: Generate study plan
app.post('/api/generate-plan', async (req, res) => {
  try {
    const { syllabus } = req.body;

    if (!syllabus || syllabus.trim() === '') {
      return res.status(400).json({ error: 'Syllabus text is required' });
    }

    // Call ChatGPT to generate study plan
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful study planning assistant. Create detailed, organized study plans based on the syllabus provided."
        },
        {
          role: "user",
          content: `Create a comprehensive study plan for the following syllabus:\n\n${syllabus}\n\nPlease provide:\n1. A breakdown of topics\n2. Suggested time allocation for each topic\n3. Study tips and strategies\n4. Recommended order of studying`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const studyPlan = completion.choices[0].message.content;

    res.json({ studyPlan });
  } catch (error) {
    console.error('Error generating study plan:', error);
    res.status(500).json({ error: 'Failed to generate study plan. Please check your API key and try again.' });
  }
});

// Route: Analyze PDF
app.post('/api/analyze-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Validate file path is within uploads directory to prevent path traversal
    const filePath = path.resolve(req.file.path);
    const uploadsPath = path.resolve(uploadsDir);
    if (!filePath.startsWith(uploadsPath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Read PDF file
    const dataBuffer = fs.readFileSync(filePath);
    
    // Parse PDF
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    // Delete uploaded file after processing
    fs.unlinkSync(filePath);

    if (!pdfText || pdfText.trim() === '') {
      return res.status(400).json({ error: 'Could not extract text from PDF' });
    }

    // Analyze with ChatGPT
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing previous year question papers and identifying important topics and patterns."
        },
        {
          role: "user",
          content: `Analyze this previous year question paper and provide insights:\n\n${pdfText.substring(0, MAX_PDF_TEXT_FOR_ANALYSIS)}\n\nPlease provide:\n1. Key topics covered\n2. Frequently asked questions\n3. Important concepts to focus on\n4. Pattern analysis and study recommendations`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const analysis = completion.choices[0].message.content;

    res.json({ 
      analysis,
      extractedText: pdfText.substring(0, TEXT_PREVIEW_LENGTH) + '...' // Preview of extracted text
    });
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path) {
      const filePath = path.resolve(req.file.path);
      const uploadsPath = path.resolve(uploadsDir);
      if (filePath.startsWith(uploadsPath) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.status(500).json({ error: 'Failed to analyze PDF. Please try again.' });
  }
});

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Planonit API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Make sure to set your OPENAI_API_KEY in .env file`);
});
