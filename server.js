// ==================== IMPORTS & CONFIGURATION ====================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/car-rental';

// ==================== RAZORPAY INITIALIZATION ====================
// Initialize Razorpay only if keys are provided
let razorpay = null;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && 
    RAZORPAY_KEY_ID !== 'your_razorpay_key_id_here' && 
    RAZORPAY_KEY_SECRET !== 'your_razorpay_key_secret_here') {
  try {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
    console.log('✅ Razorpay initialized successfully');
  } catch (error) {
    console.error('❌ Razorpay initialization error:', error.message);
    console.log('⚠️  Payment gateway will not be available. Please check your Razorpay keys in .env');
  }
} else {
  console.log('⚠️  Razorpay keys not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
  console.log('   Payment gateway will not be available until keys are configured.');
}

// ==================== EXPRESS MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads', { recursive: true });
}

// ==================== MONGODB CONNECTION ====================
// MongoDB connection with retry logic
const connectMongoDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️  Server will continue running but database operations will fail.');
    console.log('💡 To fix: Start MongoDB service with: sudo systemctl start mongod');
    console.log('   Or install MongoDB if not installed.');
  }
};

// Connect to MongoDB
connectMongoDB();

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Error:', err.message);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// ==================== SCHEMAS ====================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

const carSchema = new mongoose.Schema({
  carName: { type: String, required: true },
  model: { type: String, required: true },
  brand: { type: String, required: true },
  year: { type: Number, required: true },
  type: { type: String, enum: ['normal', 'premium', 'luxury'], required: true },
  gearType: { type: String, enum: ['auto', 'manual'], required: true },
  fuelType: { type: String, enum: ['petrol', 'diesel', 'cng', 'hybrid', 'ev'], required: true },
  seatingCapacity: { type: Number, required: true },
  
  pricing: {
    price12hr: { type: Number, required: true },
    price24hr: { type: Number, required: true },
    price36hr: { type: Number, required: true },
    price48hr: { type: Number, required: true },
    price60hr: { type: Number, required: true },
    price72hr: { type: Number, required: true }
  },
  
  securityDeposit: { type: Number, required: true },
  advanceAmount: { type: Number, required: true, default: 500 },
  driverAvailable: { type: Boolean, default: false },
  driverChargesPerDay: { type: Number, default: 0 },
  
  description: String,
  features: [String],
  imageUrl: String, // Keep for backward compatibility
  images: [{ type: String }], // New: Multiple images array
  registrationNumber: String,
  available: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },

  startTime: { type: Date, required: true },
  duration: { type: Number, required: true },
  endTime: { type: Date, required: true },

  fullName: { type: String, required: true },
  guardianName: { type: String, required: true },
  guardianRelation: { type: String, enum: ['S/o', 'W/o', 'D/o'], required: true },
  residentialAddress: { type: String, required: true },
  email: { type: String, required: true },
  mobile: { type: String, required: true },
  occupation: { type: String, required: true },

  reference1Name: { type: String },
  reference1Mobile: { type: String },
  reference2Name: { type: String },
  reference2Mobile: { type: String },

  drivingLicenseNumber: { type: String, required: true },
  licenseExpiryDate: { type: Date, required: true },

  drivingLicenseImage: { type: String },
  aadharCardImage: { type: String },
  livePhoto: { type: String },

  depositType: { type: String, enum: ['bike', 'cash'], required: true },
  bikeDetails: String,
  depositAmount: Number,
  depositStatus: { type: String, enum: ['pending', 'received', 'refunded'], default: 'pending' },

  withDriver: { type: Boolean, default: false },
  driverCharges: { type: Number, default: 0 },

  homeDelivery: { type: Boolean, default: false },
  deliveryAddress: String,
  deliveryDistance: Number,
  deliveryFee: { type: Number, default: 0 },

  vehicleName: String,
  vehicleNumber: String,
  startOdometer: Number,
  endOdometer: Number,

  basePrice: Number,
  lateReturnFee: { type: Number, default: 0 },
  totalPrice: Number,

  status: { 
    type: String, 
    enum: ['advance_paid', 'verified', 'rejected', 'active', 'completed'],
    default: 'advance_paid'
  },
  advanceAmount: Number,
  advancePaymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  advancePaymentDate: Date,
  adminNotes: String,
  verificationDate: Date,
  rejectionReason: String,

  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  paymentDate: Date,

  actualReturnTime: Date,
  lateHours: { type: Number, default: 0 },

  // receiptPdfUrl removed - PDFs are generated on-demand, no file storage needed

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  message: { type: String, required: true },
  type: { type: String, enum: ['booking_update', 'payment', 'general'], default: 'general' },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const updateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiryDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const updateReadSchema = new mongoose.Schema({
  updateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Update', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, {
  unique: true // Ensure a user can only have one read record per update
});

updateReadSchema.index({ updateId: 1, userId: 1 }, { unique: true });

const heroVideoSchema = new mongoose.Schema({
  videoUrl: { type: String, required: true },
  active: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

const offerBannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String },
  description: { type: String },
  active: { type: Boolean, default: true },
  linkUrl: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

// ==================== MODELS ====================
const User = mongoose.model('User', userSchema);
const Car = mongoose.model('Car', carSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Update = mongoose.model('Update', updateSchema);
const UpdateRead = mongoose.model('UpdateRead', updateReadSchema);
const HeroVideo = mongoose.model('HeroVideo', heroVideoSchema);
const OfferBanner = mongoose.model('OfferBanner', offerBannerSchema);

// ==================== MULTER SETUP ====================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, JPG, PNG) and PDFs are allowed!'));
    }
  }
});

// ==================== MIDDLEWARE ====================

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('No token provided');

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) throw new Error('User not found');

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware to check MongoDB connection
const checkMongoConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ 
      error: 'Database not connected. Please check MongoDB service.',
      details: 'MongoDB connection is required for this operation. Please ensure MongoDB is running.'
    });
  }
  next();
};

// ==================== HELPER FUNCTIONS ====================

const calculatePriceByDuration = (car, duration, withDriver) => {
  let basePrice = 0;
  
  if (duration === 12) {
    basePrice = car.pricing.price12hr;
  } else if (duration === 24) {
    basePrice = car.pricing.price24hr;
  } else if (duration === 36) {
    basePrice = car.pricing.price36hr;
  } else if (duration === 48) {
    basePrice = car.pricing.price48hr;
  } else if (duration === 60) {
    basePrice = car.pricing.price60hr;
  } else if (duration === 72) {
    basePrice = car.pricing.price72hr;
  } else {
    const days = Math.ceil(duration / 24);
    basePrice = car.pricing.price24hr * days;
  }
  
  let driverCharges = 0;
  if (withDriver && car.driverAvailable) {
    const days = Math.ceil(duration / 24);
    driverCharges = car.driverChargesPerDay * days;
  }
  
  return { basePrice, driverCharges };
};

const calculateTotalPrice = (car, duration, withDriver, homeDelivery, deliveryDistance) => {
  const { basePrice, driverCharges } = calculatePriceByDuration(car, duration, withDriver);
  let deliveryFee = 0;
  
  if (homeDelivery && deliveryDistance <= 5) {
    deliveryFee = 500;
  }
  
  return basePrice + driverCharges + deliveryFee;
};

const calculateLateReturnFee = (scheduledEndTime, actualReturnTime, hourlyRate = 100) => {
  if (actualReturnTime <= scheduledEndTime) return 0;
  const lateMs = actualReturnTime - scheduledEndTime;
  const lateHours = Math.ceil(lateMs / (1000 * 60 * 60));
  return lateHours * hourlyRate;
};

const createNotification = async (userId, message, bookingId = null, type = 'general') => {
  try {
    const notification = new Notification({ userId, bookingId, message, type });
    await notification.save();
  } catch (error) {
    console.error('Notification creation error:', error);
  }
};

// Generate PDF receipt for booking (returns buffer, doesn't save to file)
const generateReceiptPDF = async (booking, car, customer) => {
  return new Promise((resolve, reject) => {
    try {
      const PDFDocument = require('pdfkit');
      
      const doc = new PDFDocument({ 
        margin: 50, 
        size: 'A4',
        autoFirstPage: true
      });
      
      // Collect PDF data in buffer instead of writing to file
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      doc.on('error', (error) => {
        reject(error);
      });

    // Set initial position at document margin and disable any strokes to prevent unwanted borders
    const topMargin = 50; // Start at document margin
    doc.y = topMargin;
    doc.lineWidth(0); // Disable line drawing to prevent any borders
    
    // Logo (if exists) - centered at top
    // Check possible locations for the logo
    const possibleLogoPaths = [
      path.join(__dirname, 'uploads', 'logo.png'),
      path.join(__dirname, 'uploads', 'logo.jpg'),
      path.join(__dirname, 'uploads', 'logo.jpeg'),
    ];
    
    let logoPath = null;
    for (const testPath of possibleLogoPaths) {
      if (fs.existsSync(testPath)) {
        logoPath = testPath;
        console.log(`✅ Logo found at: ${logoPath}`);
        break;
      }
    }
    
    const logoWidth = 120; // Logo width in points
    
    if (logoPath) {
      try {
        const logoX = (doc.page.width - logoWidth) / 2; // Center horizontally
        // Place logo at top margin - maintain aspect ratio by only specifying width
        doc.image(logoPath, logoX, topMargin, { width: logoWidth });
        // Move down after logo with reasonable spacing (logo will typically be around 120px tall)
        doc.y = topMargin + logoWidth + 25; // Add extra spacing for logo
        console.log(`✅ Logo added to PDF successfully from: ${logoPath}`);
      } catch (error) {
        console.error('❌ Error adding logo to PDF:', error);
        console.error('Logo path attempted:', logoPath);
        console.error('Error details:', error.message);
        doc.y = topMargin; // Start position if logo fails
      }
    } else {
      console.log('⚠️  Logo not found. Checked paths:', possibleLogoPaths);
      doc.y = topMargin; // Start position if no logo
    }

    // Company Header
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a1a1a');
    doc.text('Zion Car Rentals', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica').fillColor('#666666');
    doc.text('Premium Car Rental Service', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    doc.text('8,5,199 Mallika Arjuna Colony, Old Bowenpally, Hyderabad - 500011', { align: 'center' });
    doc.moveDown(0.2);
    doc.text('Phone: +91 9100664083 | Email: zioncarrentals90@gmail.com', { align: 'center' });
    
    // Separator line
    doc.moveDown(0.8);
    doc.strokeColor('#cccccc');
    doc.lineWidth(0.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.8);
    
    // Receipt Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
    doc.text('Advance Payment Receipt', { align: 'center' });
    doc.moveDown(0.8);

    // Receipt Number and Date Section
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    const receiptNo = booking._id.toString().slice(-8).toUpperCase();
    const receiptDate = new Date(booking.advancePaymentDate || booking.createdAt).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
    
    doc.text(`Receipt No: ${receiptNo}`, 50, doc.y);
    const dateWidth = doc.widthOfString(`Date: ${receiptDate}`);
    doc.text(`Date: ${receiptDate}`, doc.page.width - 50 - dateWidth, doc.y);
    doc.moveDown(0.8);

    // Separator line
    doc.strokeColor('#e0e0e0');
    doc.lineWidth(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.8);

    // Customer Details Section (with 2 columns inside)
    const sectionStartY = doc.y;
    const leftMargin = 50;
    const sectionWidth = doc.page.width - 100;
    const lineHeight = 12;
    const sectionTitleHeight = 15;
    
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a');
    doc.text('Customer Details', leftMargin, sectionStartY);
    
    let currentY = sectionStartY + sectionTitleHeight;
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    const customerName = `${booking.fullName} ${booking.guardianRelation} ${booking.guardianName}`;
    
    // Customer details in 2 columns
    const leftColX = leftMargin;
    const rightColX = leftMargin + sectionWidth / 2 + 10;
    const colWidth = sectionWidth / 2 - 10;
    
    doc.text(`Name: ${customerName}`, leftColX, currentY, { width: colWidth });
    doc.text(`Email: ${booking.email}`, rightColX, currentY, { width: colWidth });
    currentY += lineHeight + 2;
    
    doc.text(`Mobile: ${booking.mobile}`, leftColX, currentY, { width: colWidth });
    doc.text(`Address: ${booking.residentialAddress}`, rightColX, currentY, { width: colWidth });
    currentY += lineHeight + 8;

    // Separator line
    doc.strokeColor('#e0e0e0');
    doc.lineWidth(0.3);
    doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).stroke();
    currentY += 12;

    // Booking Details Section (with 2 columns inside) - Below Customer Details
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a');
    doc.text('Booking Details', leftMargin, currentY);
    
    currentY += sectionTitleHeight;
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    
    // Booking details in 2 columns
    doc.text(`Vehicle: ${car.carName} (${car.brand} ${car.model} ${car.year})`, leftColX, currentY, { width: sectionWidth });
    currentY += lineHeight + 2;
    
    const startDateTime = new Date(booking.startTime).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    doc.text(`Start: ${startDateTime}`, leftColX, currentY, { width: colWidth });
    
    const endDateTime = new Date(booking.endTime).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    doc.text(`End: ${endDateTime}`, rightColX, currentY, { width: colWidth });
    currentY += lineHeight + 2;
    
    doc.text(`Duration: ${booking.duration} hrs`, leftColX, currentY, { width: colWidth });
    if (booking.withDriver) {
      doc.text('Driver: Included', rightColX, currentY, { width: colWidth });
    }
    currentY += lineHeight + 8;
    
    // Move document position to after both sections
    doc.y = currentY;

    // Separator line
    doc.strokeColor('#e0e0e0');
    doc.lineWidth(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.8);

    // Payment Summary Section
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a1a1a');
    doc.text('Payment Summary', { underline: false });
    doc.moveDown(0.5);
    
    const totalPrice = booking.totalPrice || 0;
    const advanceAmount = booking.advanceAmount || 0;
    const remainingAmount = totalPrice - advanceAmount;

    // Payment items in a table-like format
    doc.fontSize(9).font('Helvetica').fillColor('#333333');
    const leftCol = 50;
    const rightCol = doc.page.width - 200;
    
    // Total Rental Amount
    doc.text('Total Rental Amount:', leftCol, doc.y);
    doc.font('Helvetica-Bold');
    doc.text(`₹${totalPrice.toLocaleString('en-IN')}`, rightCol, doc.y, { align: 'right', width: 150 });
    doc.moveDown(0.5);
    
    // Advance Amount Paid
    doc.font('Helvetica');
    doc.text('Advance Amount Paid:', leftCol, doc.y);
    doc.font('Helvetica-Bold').fillColor('#2563eb');
    doc.text(`₹${advanceAmount.toLocaleString('en-IN')}`, rightCol, doc.y, { align: 'right', width: 150 });
    doc.moveDown(0.5);
    
    // Remaining Amount
    doc.font('Helvetica').fillColor('#333333');
    doc.text('Remaining Amount to be Paid:', leftCol, doc.y);
    doc.font('Helvetica-Bold').fillColor('#dc2626');
    doc.text(`₹${remainingAmount.toLocaleString('en-IN')}`, rightCol, doc.y, { align: 'right', width: 150 });
    doc.moveDown(1);

    // Separator line
    doc.strokeColor('#cccccc');
    doc.lineWidth(0.5);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.6);

    // Important Note
    doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#666666');
    const noteText = 'Note: The remaining amount must be paid at the time of vehicle pickup. Please bring your Aadhaar card and valid driving license for verification.';
    doc.text(noteText, 50, doc.y, { align: 'left', width: doc.page.width - 100 });
    doc.moveDown(0.8);

    // Footer
    doc.strokeColor('#e0e0e0');
    doc.lineWidth(0.3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(8).font('Helvetica').fillColor('#999999');
    doc.text('This is a computer-generated receipt. No signature required.', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333');
    doc.text('Thank you for choosing Zion Car Rentals!', { align: 'center' });

      doc.end();
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      reject(error);
    }
  });
};

// Check if a time range overlaps with existing bookings
const checkTimeOverlap = (requestedStart, requestedEnd, existingStart, existingEnd) => {
  return requestedStart < existingEnd && requestedEnd > existingStart;
};

// Get next available time and max duration for a car
const getAvailabilityInfo = async (carId, requestedStart, requestedDuration) => {
  const requestedEnd = new Date(requestedStart.getTime() + (requestedDuration * 60 * 60 * 1000));
  
  // Get all bookings that block availability (advance_paid, verified, active)
  const blockingStatuses = ['advance_paid', 'verified', 'active'];
  const existingBookings = await Booking.find({
    carId,
    status: { $in: blockingStatuses }
  }).sort({ startTime: 1 });

  // Check for overlaps
  for (const booking of existingBookings) {
    if (checkTimeOverlap(requestedStart, requestedEnd, booking.startTime, booking.endTime)) {
      // Find next available time (after this booking ends)
      const nextAvailableStart = booking.endTime;
      
      // Find max duration until next booking
      let maxDurationHours = null;
      const nextBooking = existingBookings.find(b => 
        b.startTime > nextAvailableStart && 
        checkTimeOverlap(nextAvailableStart, new Date(nextAvailableStart.getTime() + (72 * 60 * 60 * 1000)), b.startTime, b.endTime)
      );
      
      if (nextBooking) {
        const maxDurationMs = nextBooking.startTime - nextAvailableStart;
        maxDurationHours = Math.floor(maxDurationMs / (60 * 60 * 1000));
        // Round down to nearest 12 hours (since durations are in multiples of 12)
        maxDurationHours = Math.floor(maxDurationHours / 12) * 12;
        // Ensure minimum of 12 hours
        if (maxDurationHours < 12) {
          maxDurationHours = 0; // No duration available
        }
      } else {
        // No next booking, can book up to 72 hours
        maxDurationHours = 72;
      }
      
      return {
        available: false,
        nextAvailableStartTime: nextAvailableStart.toISOString(),
        maxDurationHours: maxDurationHours
      };
    }
  }
  
  return { available: true };
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, mobile, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, mobile, role: role || 'customer' });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== FORGOT PASSWORD ROUTES ====================

// Request password reset
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ 
        message: 'If an account with that email exists, a password reset link has been sent.' 
      });
    }

    // Generate reset token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(resetTokenExpiry);
    await user.save();

    // In production, send email with reset link
    // For now, return the token (remove this in production)
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`;
    
    console.log('Password reset link:', resetLink); // Remove in production
    
    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.',
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined, // Only in dev
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined // Only in dev
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify reset token
app.get('/api/auth/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({ message: 'Token is valid', email: user.email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CAR ROUTES ====================

app.get('/api/cars', checkMongoConnection, async (req, res) => {
  try {
    const { type, available, fuelType, gearType } = req.query;
    let filter = {};

    if (type) filter.type = type;
    if (available !== undefined) filter.available = available === 'true';
    if (fuelType) filter.fuelType = fuelType;
    if (gearType) filter.gearType = gearType;

    const cars = await Car.find(filter).sort({ createdAt: -1 });
    res.json({ cars });
  } catch (error) {
    console.error('Error fetching cars:', error);
    res.status(500).json({ error: error.message, cars: [] });
  }
});

app.get('/api/cars/:id', checkMongoConnection, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json({ car });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check car availability for a specific time range
app.post('/api/cars/:id/check-availability', checkMongoConnection, async (req, res) => {
  try {
    const { startTime, duration } = req.body;
    const carId = req.params.id;

    if (!startTime || !duration) {
      return res.status(400).json({ error: 'Start time and duration are required' });
    }

    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const requestedStart = new Date(startTime);
    const availabilityInfo = await getAvailabilityInfo(carId, requestedStart, parseInt(duration));

    res.json(availabilityInfo);
  } catch (error) {
    console.error('Availability check error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cars', authenticate, isAdmin, async (req, res) => {
  try {
    const { 
      carName, model, brand, year, type, gearType, fuelType, seatingCapacity,
      pricing, securityDeposit, advanceAmount, driverAvailable, driverChargesPerDay,
      description, features, imageUrl, images, registrationNumber
    } = req.body;

    if (!pricing || !pricing.price12hr || !pricing.price24hr || !pricing.price36hr || 
        !pricing.price48hr || !pricing.price60hr || !pricing.price72hr) {
      return res.status(400).json({ error: 'All pricing tiers (12hr, 24hr, 36hr, 48hr, 60hr, 72hr) are required' });
    }

    if (!advanceAmount || advanceAmount <= 0) {
      return res.status(400).json({ error: 'Advance amount is required and must be greater than 0' });
    }

    // Handle images: if images array is provided, use it; otherwise fall back to imageUrl
    let carImages = [];
    if (images && Array.isArray(images) && images.length > 0) {
      carImages = images;
    } else if (imageUrl) {
      // For backward compatibility, if imageUrl is provided, add it to images array
      carImages = [imageUrl];
    }

    const car = new Car({ 
      carName, model, brand, year, type, gearType, fuelType, seatingCapacity,
      pricing, securityDeposit, advanceAmount, driverAvailable, driverChargesPerDay,
      description, features, imageUrl: imageUrl || (carImages.length > 0 ? carImages[0] : ''), // Keep for backward compatibility
      images: carImages,
      registrationNumber
    });
    
    await car.save();
    res.status(201).json({ message: 'Car added successfully', car });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cars/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const updateData = { ...req.body };
    
    // Handle images: if images array is provided, use it
    if (updateData.images && Array.isArray(updateData.images)) {
      // If images array is provided, update it
      // Also update imageUrl to first image for backward compatibility
      if (updateData.images.length > 0) {
        updateData.imageUrl = updateData.images[0];
      }
    } else if (updateData.imageUrl && !updateData.images) {
      // If only imageUrl is provided, add it to images array
      const existingCar = await Car.findById(req.params.id);
      if (existingCar) {
        updateData.images = existingCar.images && existingCar.images.length > 0 
          ? existingCar.images 
          : [updateData.imageUrl];
        // Update first image in array if it exists
        if (updateData.images.length > 0) {
          updateData.images[0] = updateData.imageUrl;
        }
      } else {
        updateData.images = [updateData.imageUrl];
      }
    }
    
    const car = await Car.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json({ message: 'Car updated successfully', car });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cars/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const car = await Car.findByIdAndDelete(req.params.id);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }
    res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BOOKING ROUTES ====================

// Create booking after advance payment (this is called after payment succeeds)
app.post('/api/bookings', 
  authenticate,
  checkMongoConnection,
  async (req, res) => {
    try {
      if (!req.body || !req.body.carId) {
        return res.status(400).json({ error: 'Missing required booking data. Please ensure all fields are filled.' });
      }

      const {
        carId, startTime, duration, fullName, guardianName, guardianRelation,
        residentialAddress, email, mobile, occupation,
        drivingLicenseNumber, licenseExpiryDate,
        depositType, bikeDetails, withDriver, homeDelivery, deliveryAddress, deliveryDistance,
        paymentId, paymentStatus
      } = req.body;

      // Payment must be completed before creating booking
      if (paymentStatus !== 'completed' || !paymentId) {
        return res.status(400).json({ error: 'Advance payment must be completed before creating booking' });
      }

      if (duration % 12 !== 0) {
        return res.status(400).json({ error: 'Duration must be in multiples of 12 hours' });
      }

      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }
      if (!car.available) {
        return res.status(400).json({ error: 'Car is not available' });
      }

      // Handle boolean values
      const withDriverBool = withDriver === 'true' || withDriver === true;
      const homeDeliveryBool = homeDelivery === 'true' || homeDelivery === true;

      if (withDriverBool && !car.driverAvailable) {
        return res.status(400).json({ error: 'Driver service not available for this car' });
      }

      const start = new Date(startTime);
      const end = new Date(start.getTime() + (duration * 60 * 60 * 1000));
      
      // Check availability again before creating booking (double-check)
      const availabilityCheck = await getAvailabilityInfo(carId, start, parseInt(duration));
      if (!availabilityCheck.available) {
        return res.status(400).json({ 
          error: 'Car is no longer available for the selected time',
          nextAvailableStartTime: availabilityCheck.nextAvailableStartTime,
          maxDurationHours: availabilityCheck.maxDurationHours
        });
      }

      const depositAmount = car.securityDeposit;
      const deliveryFee = (homeDeliveryBool && parseFloat(deliveryDistance || 0) <= 5) ? 500 : 0;
      const totalPrice = calculateTotalPrice(car, parseInt(duration), withDriverBool, homeDeliveryBool, parseFloat(deliveryDistance || 0));
      const { basePrice, driverCharges } = calculatePriceByDuration(car, parseInt(duration), withDriverBool);

      const booking = new Booking({
        customerId: req.userId,
        carId,
        startTime: start,
        duration: parseInt(duration),
        endTime: end,
        fullName, guardianName, guardianRelation, residentialAddress, email, mobile, occupation,
        reference1Name: null,
        reference1Mobile: null,
        reference2Name: null,
        reference2Mobile: null,
        drivingLicenseNumber,
        licenseExpiryDate: new Date(licenseExpiryDate),
        drivingLicenseImage: null,
        aadharCardImage: null,
        livePhoto: null,
        depositType,
        bikeDetails: depositType === 'bike' ? bikeDetails : null,
        depositAmount,
        withDriver: withDriverBool,
        driverCharges,
        homeDelivery: homeDeliveryBool,
        deliveryAddress: homeDeliveryBool ? deliveryAddress : null,
        deliveryDistance: homeDeliveryBool ? parseFloat(deliveryDistance || 0) : 0,
        deliveryFee,
        basePrice,
        totalPrice,
        status: 'advance_paid',
        advanceAmount: car.advanceAmount,
        advancePaymentStatus: 'completed',
        advancePaymentDate: new Date()
      });

      await booking.save();

      // Generate PDF receipt
      // PDF will be generated on-demand when requested, no need to save it
      // This saves disk space and eliminates file management issues

      await createNotification(
        req.userId,
        `Advance payment received! Booking confirmed for ${car.carName}. Please arrive on time with required documents.`,
        booking._id,
        'booking_update'
      );

      res.status(201).json({
        message: 'Booking created successfully. Car is now blocked for your selected time.',
        booking
      });
    } catch (error) {
      console.error('Booking error:', error);
      res.status(500).json({ error: error.message });
    }
});

// Create Razorpay order for advance payment
app.post('/api/bookings/advance-payment/create-order', 
  authenticate,
  checkMongoConnection,
  async (req, res) => {
    try {
      // Check if Razorpay is initialized
      if (!razorpay) {
        return res.status(503).json({ 
          error: 'Payment gateway not configured',
          message: 'Razorpay keys are not set in the server configuration. Please contact administrator.'
        });
      }

      const { carId, startTime, duration, amount } = req.body;

      if (!carId || !startTime || !duration || !amount) {
        return res.status(400).json({ error: 'Missing required payment information' });
      }

      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      if (amount !== car.advanceAmount) {
        return res.status(400).json({ error: 'Advance amount mismatch' });
      }

      // Check availability before creating order
      const requestedStart = new Date(startTime);
      const availabilityCheck = await getAvailabilityInfo(carId, requestedStart, parseInt(duration));
      if (!availabilityCheck.available) {
        return res.status(400).json({ 
          error: 'Car is no longer available for the selected time',
          nextAvailableStartTime: availabilityCheck.nextAvailableStartTime,
          maxDurationHours: availabilityCheck.maxDurationHours
        });
      }

      // Create Razorpay order
      // Receipt must be max 40 characters - use short format
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
      const carIdShort = carId.toString().slice(-6); // Last 6 chars of carId
      const receipt = `adv_${carIdShort}_${timestamp}`; // Max 20 chars: "adv_" + 6 + "_" + 8
      
      const options = {
        amount: amount * 100, // Razorpay expects amount in paise (smallest currency unit)
        currency: 'INR',
        receipt: receipt, // Max 40 characters required
        notes: {
          carId: carId,
          startTime: startTime,
          duration: duration.toString(),
          type: 'advance_payment'
        }
      };

      const order = await razorpay.orders.create(options);

      res.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: RAZORPAY_KEY_ID
      });
    } catch (error) {
      console.error('Razorpay order creation error:', error);
      
      // Provide more helpful error messages
      if (error.statusCode === 401) {
        return res.status(401).json({ 
          error: 'Razorpay authentication failed',
          message: 'Invalid Razorpay API keys. Please check your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file.',
          details: 'Make sure you are using the correct keys from your Razorpay dashboard (Test Mode or Live Mode)'
        });
      }
      
      // Handle receipt length error specifically
      if (error.statusCode === 400 && error.error?.description?.includes('receipt')) {
        return res.status(400).json({ 
          error: 'Invalid receipt format',
          message: 'Receipt ID is too long. Please try again.',
          details: error.error.description
        });
      }
      
      res.status(500).json({ 
        error: error.message || 'Failed to create payment order',
        details: error.error?.description || 'Unknown error occurred'
      });
    }
});

// Verify Razorpay payment and process advance payment
app.post('/api/bookings/advance-payment/verify', 
  authenticate,
  checkMongoConnection,
  async (req, res) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, carId, startTime, duration, amount } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: 'Missing payment verification details' });
      }

      if (!carId || !startTime || !duration || !amount) {
        return res.status(400).json({ error: 'Missing booking information' });
      }

      const car = await Car.findById(carId);
      if (!car) {
        return res.status(404).json({ error: 'Car not found' });
      }

      if (amount !== car.advanceAmount) {
        return res.status(400).json({ error: 'Advance amount mismatch' });
      }

      // Check if Razorpay is initialized
      if (!RAZORPAY_KEY_SECRET) {
        return res.status(503).json({ 
          error: 'Payment gateway not configured',
          message: 'Razorpay keys are not set in the server configuration.'
        });
      }

      // Verify payment signature
      const crypto = require('crypto');
      const generated_signature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment verification failed' });
      }

      // Check availability again before confirming
      const requestedStart = new Date(startTime);
      const availabilityCheck = await getAvailabilityInfo(carId, requestedStart, parseInt(duration));
      if (!availabilityCheck.available) {
        return res.status(400).json({ 
          error: 'Car is no longer available for the selected time',
          nextAvailableStartTime: availabilityCheck.nextAvailableStartTime,
          maxDurationHours: availabilityCheck.maxDurationHours
        });
      }

      // Payment verified successfully
      res.json({
        success: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        paymentStatus: 'completed',
        message: 'Advance payment verified successfully'
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({ error: error.message || 'Failed to verify payment' });
    }
});

app.get('/api/bookings/my-bookings', authenticate, async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.userId })
      .populate('carId', 'carName model type imageUrl gearType fuelType')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bookings', authenticate, isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .populate('customerId', 'name email mobile')
      .populate('carId', 'carName model type gearType fuelType')
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bookings/:id', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email mobile')
      .populate('carId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.customerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download PDF receipt
app.get('/api/bookings/:id/receipt', authenticate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'name email mobile')
      .populate('carId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check access permissions
    if (req.user.role !== 'admin' && booking.customerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if advance payment is completed
    if (booking.advancePaymentStatus !== 'completed') {
      return res.status(400).json({ error: 'Receipt can only be generated after advance payment is completed' });
    }

    // Generate PDF on-demand (no file storage needed)
    const customer = await User.findById(booking.customerId._id);
    const pdfBuffer = await generateReceiptPDF(booking, booking.carId, customer);

    // Send the PDF directly from memory
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${booking._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error serving receipt PDF:', error);
    res.status(500).json({ error: error.message || 'Failed to generate receipt' });
  }
});

// Admin verification when customer arrives for pickup
app.put('/api/bookings/:id/verify', authenticate, isAdmin, async (req, res) => {
  try {
    const { action, rejectionReason, adminNotes } = req.body;

    const booking = await Booking.findById(req.params.id).populate('carId');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only verify bookings that have advance_paid status
    if (booking.status !== 'advance_paid') {
      return res.status(400).json({ 
        error: `Booking cannot be verified. Current status: ${booking.status}. Only bookings with advance_paid status can be verified.` 
      });
    }

    if (action === 'accept') {
      // Accept: Documents verified, car handed over
      booking.status = 'verified';
      booking.verificationDate = new Date();
      booking.adminNotes = adminNotes;

      await createNotification(
        booking.customerId,
        `Your documents have been verified! ${booking.carId.carName} is now active. Enjoy your ride!`,
        booking._id,
        'booking_update'
      );
    } else if (action === 'reject') {
      // Reject: Documents missing/expired, release slot, advance NOT refunded
      booking.status = 'rejected';
      booking.rejectionReason = rejectionReason || 'Documents missing or expired during verification';
      booking.verificationDate = new Date();
      booking.adminNotes = adminNotes;

      // Release the time slot (rejected bookings don't block availability)
      // The slot is automatically released since rejected status doesn't block

      await createNotification(
        booking.customerId,
        `Your booking for ${booking.carId.carName} has been rejected. Reason: ${booking.rejectionReason}. Note: Advance payment is non-refundable.`,
        booking._id,
        'booking_update'
      );
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "accept" or "reject"' });
    }

    await booking.save();
    res.json({ 
      message: `Booking ${action}ed successfully`, 
      booking,
      note: action === 'reject' ? 'Time slot has been released. Advance payment is non-refundable.' : 'Car is now active.'
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bookings/:id/start', authenticate, isAdmin, async (req, res) => {
  try {
    const { vehicleName, vehicleNumber, startOdometer } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Can start from verified status (after admin verification)
    if (booking.status !== 'verified') {
      return res.status(400).json({ error: 'Booking must be verified first before starting' });
    }

    booking.status = 'active';
    booking.vehicleName = vehicleName;
    booking.vehicleNumber = vehicleNumber;
    booking.startOdometer = startOdometer;
    booking.depositStatus = 'received';

    await booking.save();

    await createNotification(
      booking.customerId,
      `Your rental for ${vehicleName} has started. Enjoy your ride!`,
      booking._id,
      'booking_update'
    );

    res.json({ message: 'Booking marked as active', booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bookings/:id/complete', authenticate, isAdmin, async (req, res) => {
  try {
    const { endOdometer, actualReturnTime } = req.body;

    const booking = await Booking.findById(req.params.id).populate('carId');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({ error: 'Booking is not active' });
    }

    const returnTime = actualReturnTime ? new Date(actualReturnTime) : new Date();
    const lateFee = calculateLateReturnFee(booking.endTime, returnTime);
    const lateHours = lateFee > 0 ? Math.ceil((returnTime - booking.endTime) / (1000 * 60 * 60)) : 0;

    booking.status = 'completed';
    booking.endOdometer = endOdometer;
    booking.actualReturnTime = returnTime;
    booking.lateReturnFee = lateFee;
    booking.lateHours = lateHours;
    booking.totalPrice = booking.basePrice + booking.driverCharges + booking.deliveryFee + lateFee;
    booking.depositStatus = 'refunded';

    await Car.findByIdAndUpdate(booking.carId, { available: true });

    let message = `Your rental for ${booking.carId.carName} is completed.`;
    if (lateFee > 0) {
      message += ` Late return fee of ₹${lateFee} has been charged (${lateHours} hours late).`;
    }
    message += ` Your deposit will be refunded.`;

    await createNotification(booking.customerId, message, booking._id, 'booking_update');

    await booking.save();
    res.json({ message: 'Booking completed successfully', booking, lateFee, lateHours });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ==================== NOTIFICATION ROUTES ====================

app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== UPDATE ROUTES ====================

// Get all active updates for a user (with read status)
app.get('/api/updates', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const activeUpdates = await Update.find({
      active: true,
      $or: [
        { expiryDate: null },
        { expiryDate: { $gt: now } }
      ]
    })
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

    // Get read status for current user
    const readUpdateIds = await UpdateRead.find({ userId: req.userId })
      .distinct('updateId');

    const updatesWithReadStatus = activeUpdates.map(update => ({
      _id: update._id,
      title: update.title,
      message: update.message,
      createdAt: update.createdAt,
      expiryDate: update.expiryDate,
      createdBy: update.createdBy,
      read: readUpdateIds.includes(update._id.toString())
    }));

    res.json({ updates: updatesWithReadStatus });
  } catch (error) {
    console.error('Get updates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get unread count for current user
app.get('/api/updates/unread-count', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const activeUpdates = await Update.find({
      active: true,
      $or: [
        { expiryDate: null },
        { expiryDate: { $gt: now } }
      ]
    }).distinct('_id');

    const readUpdateIds = await UpdateRead.find({ 
      userId: req.userId,
      updateId: { $in: activeUpdates }
    }).distinct('updateId');

    const unreadCount = activeUpdates.length - readUpdateIds.length;

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark update as read
app.put('/api/updates/:id/read', authenticate, async (req, res) => {
  try {
    const update = await Update.findById(req.params.id);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    // Create or update read record
    await UpdateRead.findOneAndUpdate(
      { updateId: req.params.id, userId: req.userId },
      { readAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ message: 'Update marked as read' });
  } catch (error) {
    console.error('Mark update as read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark all updates as read
app.put('/api/updates/read-all', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const activeUpdates = await Update.find({
      active: true,
      $or: [
        { expiryDate: null },
        { expiryDate: { $gt: now } }
      ]
    }).distinct('_id');

    // Mark all as read
    const readRecords = activeUpdates.map(updateId => ({
      updateId,
      userId: req.userId,
      readAt: new Date()
    }));

    if (readRecords.length > 0) {
      await UpdateRead.insertMany(readRecords, { ordered: false });
    }

    res.json({ message: 'All updates marked as read' });
  } catch (error) {
    console.error('Mark all updates as read error:', error);
    // Ignore duplicate key errors (already read)
    if (error.code !== 11000) {
      res.status(500).json({ error: error.message });
    } else {
      res.json({ message: 'All updates marked as read' });
    }
  }
});

// Admin: Get all updates (for management)
app.get('/api/admin/updates', authenticate, isAdmin, async (req, res) => {
  try {
    const updates = await Update.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    const updatesWithFields = updates.map(update => ({
      _id: update._id,
      title: update.title,
      message: update.message,
      active: update.active,
      createdAt: update.createdAt,
      expiryDate: update.expiryDate,
      createdBy: update.createdBy,
      updatedAt: update.updatedAt
    }));
    
    res.json({ updates: updatesWithFields });
  } catch (error) {
    console.error('Get admin updates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Create update
app.post('/api/admin/updates', authenticate, isAdmin, async (req, res) => {
  try {
    const { title, message, active, expiryDate } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const update = new Update({
      title,
      message,
      active: active !== undefined ? active : true,
      createdBy: req.userId,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      updatedAt: new Date()
    });

    await update.save();
    await update.populate('createdBy', 'name email');

    res.status(201).json({ message: 'Update created successfully', update });
  } catch (error) {
    console.error('Create update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update existing update
app.put('/api/admin/updates/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { title, message, active, expiryDate } = req.body;

    const update = await Update.findById(req.params.id);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    if (title) update.title = title;
    if (message) update.message = message;
    if (active !== undefined) update.active = active;
    if (expiryDate !== undefined) update.expiryDate = expiryDate ? new Date(expiryDate) : null;
    update.updatedAt = new Date();

    await update.save();
    await update.populate('createdBy', 'name email');

    res.json({ message: 'Update updated successfully', update });
  } catch (error) {
    console.error('Update update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete update
app.delete('/api/admin/updates/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const update = await Update.findByIdAndDelete(req.params.id);
    if (!update) {
      return res.status(404).json({ error: 'Update not found' });
    }

    // Also delete all read records for this update
    await UpdateRead.deleteMany({ updateId: req.params.id });

    res.json({ message: 'Update deleted successfully' });
  } catch (error) {
    console.error('Delete update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== HERO VIDEO ROUTES ====================

// Get active hero video (public)
app.get('/api/hero-video', async (req, res) => {
  try {
    const heroVideo = await HeroVideo.findOne({ active: true }).sort({ updatedAt: -1 });
    if (!heroVideo) {
      return res.json({ videoUrl: null, active: false });
    }
    res.json({ videoUrl: heroVideo.videoUrl, active: heroVideo.active });
  } catch (error) {
    console.error('Get hero video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get hero video settings
app.get('/api/admin/hero-video', authenticate, isAdmin, async (req, res) => {
  try {
    const heroVideo = await HeroVideo.findOne().sort({ updatedAt: -1 });
    res.json({ heroVideo: heroVideo || null });
  } catch (error) {
    console.error('Get admin hero video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update hero video
app.put('/api/admin/hero-video', authenticate, isAdmin, async (req, res) => {
  try {
    const { videoUrl, active } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    // If setting to active, deactivate all other videos
    if (active !== false) {
      await HeroVideo.updateMany({}, { active: false });
    }

    // Create or update video
    const heroVideo = await HeroVideo.findOneAndUpdate(
      {},
      {
        videoUrl,
        active: active !== undefined ? active : true,
        updatedBy: req.userId,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Hero video updated successfully', heroVideo });
  } catch (error) {
    console.error('Update hero video error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== OFFER BANNER ROUTES ====================

// Get active offer banner (public)
app.get('/api/offer-banner', async (req, res) => {
  try {
    const banner = await OfferBanner.findOne({ active: true }).sort({ updatedAt: -1 });
    if (!banner) {
      return res.json({ banner: null });
    }
    res.json({ banner });
  } catch (error) {
    console.error('Get offer banner error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get offer banner settings
app.get('/api/admin/offer-banner', authenticate, isAdmin, async (req, res) => {
  try {
    const banner = await OfferBanner.findOne().sort({ updatedAt: -1 });
    res.json({ banner: banner || null });
  } catch (error) {
    console.error('Get admin offer banner error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update offer banner
app.put('/api/admin/offer-banner', authenticate, isAdmin, async (req, res) => {
  try {
    const { imageUrl, title, description, linkUrl, active } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Deactivate all existing banners
    if (active !== false) {
      await OfferBanner.updateMany({}, { active: false });
    }

    // Create or update banner
    const banner = await OfferBanner.findOneAndUpdate(
      {},
      {
        imageUrl,
        title: title || '',
        description: description || '',
        linkUrl: linkUrl || '',
        active: active !== undefined ? active : true,
        updatedBy: req.userId,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Offer banner updated successfully', banner });
  } catch (error) {
    console.error('Update offer banner error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN STATS ====================

app.get('/api/admin/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const totalCars = await Car.countDocuments();
    const availableCars = await Car.countDocuments({ available: true });
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({ status: 'active' });
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });

    const totalRevenue = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);

    res.json({
      stats: {
        totalCars,
        availableCars,
        totalBookings,
        activeBookings,
        pendingBookings,
        completedBookings,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const mongoStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    status: 'ok',
    server: 'running',
    mongodb: {
      status: mongoStates[mongoStatus] || 'unknown',
      connected: mongoStatus === 1
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== HOME ROUTE ====================

app.get('/', (req, res) => {
  res.json({
    message: '🚗 Car Rental System API',
    version: '2.0.0',
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login'
      ],
      cars: [
        'GET /api/cars',
        'GET /api/cars/:id',
        'POST /api/cars',
        'PUT /api/cars/:id',
        'DELETE /api/cars/:id'
      ],
      bookings: [
        'POST /api/bookings',
        'GET /api/bookings/my-bookings',
        'GET /api/bookings/:id',
        'GET /api/bookings',
        'PUT /api/bookings/:id/review',
        'PUT /api/bookings/:id/start',
        'PUT /api/bookings/:id/complete'
      ],
      notifications: [
        'GET /api/notifications',
        'PUT /api/notifications/:id/read',
        'PUT /api/notifications/read-all',
        'DELETE /api/notifications/:id'
      ],
      admin: [
        'GET /api/admin/stats'
      ]
    }
  });
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🚗 CAR RENTAL SYSTEM RUNNING ON PORT ${PORT}`);
  console.log(`MongoDB: ${MONGODB_URI}`);
});

module.exports = app;
