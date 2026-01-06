// ==================== IMPORTS & CONFIGURATION ====================
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const nodemailer = require('nodemailer');
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

// ==================== EMAIL CONFIGURATION ====================
// Initialize Nodemailer transporter
let emailTransporter = null;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;

if (EMAIL_USER && EMAIL_APP_PASSWORD && ADMIN_EMAIL) {
  try {
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD,
      },
    });
    console.log('✅ Email service initialized successfully');
  } catch (error) {
    console.error('❌ Email service initialization error:', error.message);
    console.log('⚠️  Email notifications will not be sent.');
  }
} else {
  console.log('⚠️  Email credentials not configured. Please add EMAIL_USER, EMAIL_APP_PASSWORD, and ADMIN_EMAIL to .env');
  console.log('   Email notifications will not be sent until configured.');
}

// Email utility function
const sendNewBookingEmail = async (bookingDetails) => {
  if (!emailTransporter || !ADMIN_EMAIL) {
    console.log('⚠️  Email service not configured. Skipping email notification.');
    return;
  }

  try {
    const { customerName, mobile, email, carName, startTime, endTime, totalPrice, bookingId } = bookingDetails;
    
    const mailOptions = {
      from: EMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `🚗 New Booking Alert - ${carName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .info-row { margin: 15px 0; padding: 10px; background-color: #f5f5f5; border-left: 4px solid #4CAF50; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; }
            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
            .highlight { color: #4CAF50; font-weight: bold; font-size: 18px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚗 New Booking Received!</h1>
            </div>
            <div class="content">
              <p>Hello Admin,</p>
              <p>A new booking has been created from the customer portal. Here are the details:</p>
              
              <div class="info-row">
                <span class="label">Booking ID:</span> <span class="value">${bookingId}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Customer Name:</span> <span class="value">${customerName}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Mobile:</span> <span class="value">${mobile}</span>
              </div>
              
              ${email ? `<div class="info-row"><span class="label">Email:</span> <span class="value">${email}</span></div>` : ''}
              
              <div class="info-row">
                <span class="label">Car:</span> <span class="value">${carName}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Start Time:</span> <span class="value">${new Date(startTime).toLocaleString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
              
              <div class="info-row">
                <span class="label">End Time:</span> <span class="value">${new Date(endTime).toLocaleString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
              
              <div class="info-row">
                <span class="label">Total Price:</span> <span class="highlight">₹${totalPrice.toLocaleString()}</span>
              </div>
              
              <p style="margin-top: 25px; padding: 15px; background-color: #e8f5e9; border-radius: 5px;">
                <strong>⚡ Action Required:</strong> Please review this booking in your admin dashboard and ensure all arrangements are in place.
              </p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your Car Rental System.</p>
              <p>Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ New booking email sent to admin for booking ID: ${bookingId}`);
  } catch (error) {
    console.error('❌ Failed to send new booking email:', error.message);
    // Don't throw error - we don't want email failure to break the booking process
  }
};

// ==================== EXPRESS MIDDLEWARE ====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads', { recursive: true });
}

// ==================== MONGODB CONNECTION ====================
// MongoDB connection with retry logic and better options
const connectMongoDB = async () => {
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000, // Increase timeout to 10 seconds
    socketTimeoutMS: 45000,
    family: 4, // Force IPv4 (helps with DNS issues)
    retryWrites: true,
    retryReads: true,
  };

  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('MongoDB:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password in logs
    
    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ MongoDB Connected Successfully');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('\n⚠️  Server will continue running but database operations will fail.');
    console.log('\n🔧 Possible solutions:');
    console.log('   1. Check your internet connection');
    console.log('   2. Verify MongoDB Atlas credentials in .env file');
    console.log('   3. Check if your IP is whitelisted in MongoDB Atlas');
    console.log('   4. Try using Google DNS (8.8.8.8) or Cloudflare DNS (1.1.1.1)');
    console.log('   5. If using VPN, try disconnecting it');
    console.log('   6. Check firewall settings\n');
    
    // Retry connection after 5 seconds
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectMongoDB, 5000);
  }
};

// Connect to MongoDB
connectMongoDB();

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectMongoDB, 3000);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Error:', err.message);
  if (err.message.includes('EREFUSED') || err.message.includes('querySrv')) {
    console.log('💡 DNS resolution error detected. This usually means:');
    console.log('   - Network connectivity issues');
    console.log('   - DNS server not responding');
    console.log('   - Firewall blocking MongoDB Atlas');
  }
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected successfully');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connection established');
});

// ==================== SCHEMAS ====================

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
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

const carsBannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  title: { type: String },
  description: { type: String },
  active: { type: Boolean, default: true },
  linkUrl: { type: String },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});

// Schema for admin-created offline bookings (walk-in customers)
const adminBookingSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: false },
  customerName: { type: String, required: true },
  guardianName: { type: String, required: false },
  guardianRelation: { type: String, required: false },
  mobile: { type: String, required: true },
  email: { type: String, required: false },
  occupation: { type: String, required: false },
  residentialAddress: { type: String, required: false },
  drivingLicenseNumber: { type: String, required: false },
  licenseExpiryDate: { type: Date, required: false },
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  totalAmount: { type: Number, required: true, default: 0 },
  advancedAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  additionalFee1Name: { type: String, required: false },
  additionalFee1Amount: { type: Number, required: false },
  additionalFee2Name: { type: String, required: false },
  additionalFee2Amount: { type: Number, required: false },
  additionalFee3Name: { type: String, required: false },
  additionalFee3Amount: { type: Number, required: false },
  paymentStatus: { type: String, enum: ['unpaid', 'advanced', 'full'], default: 'unpaid' },
  paidAmount: { type: Number, default: 0 },
  paymentMode: { type: String, enum: ['cash', 'upi', 'bank_transfer'], default: 'cash' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Schema for customer database management (admin only)
const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  guardianName: { type: String, required: true },
  guardianRelation: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, required: true },
  occupation: { type: String, required: true },
  residentialAddress: { type: String, required: true },
  drivingLicenseNumber: { type: String, required: true },
  licenseExpiryDate: { type: Date, required: true },
  drivingLicenseImage: { type: String },
  aadharCardImage: { type: String },
  livePhoto: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
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
const CarsBanner = mongoose.model('CarsBanner', carsBannerSchema);
const AdminBooking = mongoose.model('AdminBooking', adminBookingSchema);
const Customer = mongoose.model('Customer', customerSchema);

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

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 50;

      // Header - Company Name
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#000000');
      doc.text('ZION CAR RENTAL SERVICE', margin, 50);
      
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text('8.5.199 mallika arjuna colony old bowenpally telangana', margin, 70);
      doc.text('Phone no - 9100664083', margin, 82);
      doc.text('Email: zioncarrentals90@gmail.com', margin, 94);
      doc.text('State: 36-Telangana', margin, 106);

      // Logo on right side
      const possibleLogoPaths = [
        path.join(__dirname, 'uploads', 'logo.png'),
        path.join(__dirname, 'uploads', 'logo.jpg'),
        path.join(__dirname, 'uploads', 'logo.jpeg'),
      ];

      let logoPath = null;
      for (const testPath of possibleLogoPaths) {
        if (fs.existsSync(testPath)) {
          logoPath = testPath;
          break;
        }
      }

      if (logoPath) {
        try {
          doc.image(logoPath, pageWidth - margin - 60, 50, { width: 60, height: 60 });
        } catch (error) {
          console.error('Error adding logo:', error);
        }
      }

      // Horizontal line below header
      doc.strokeColor('#000000').lineWidth(1);
      doc.moveTo(margin, 125).lineTo(pageWidth - margin, 125).stroke();

      // Invoice title (centered, blue)
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066cc');
      doc.text('Invoice', margin, 135, { align: 'center', width: pageWidth - 2 * margin });

      // Bill To section (left) and Invoice Details (right)
      const billToY = 158;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Bill To', margin, billToY);

      const customerName = customer.name || booking.fullName || booking.customerName || 'N/A';
      const guardianRelation = customer.guardianRelation || booking.guardianRelation || 'S/o';
      const guardianName = customer.guardianName || booking.guardianName;
      const guardianInfo = guardianName ? `${guardianRelation} ${guardianName}` : '';
      const fullCustomerName = guardianInfo ? `${customerName} ${guardianInfo}` : customerName;

      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text(fullCustomerName, margin, billToY + 15);
      doc.text(`Contact No.: ${customer.mobile || booking.mobile || 'N/A'}`, margin, billToY + 28);
      doc.text(`Email: ${customer.email || booking.email || 'N/A'}`, margin, billToY + 41);
      doc.text(`Address: ${customer.residentialAddress || booking.residentialAddress || 'N/A'}`, margin, billToY + 54, { width: 280 });

      // Invoice Details (right side)
      const rightColX = pageWidth - margin - 150;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Invoice Details', rightColX, billToY - 5);

      const invoiceNo = booking._id.toString().slice(-3).toUpperCase();
      const invoiceDate = new Date(booking.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const invoiceTime = new Date(booking.createdAt).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      doc.text(`Invoice No.: ${invoiceNo}`, rightColX, billToY + 10);
      doc.text(`Date: ${invoiceDate}`, rightColX, billToY + 23);
      doc.text(`Time: ${invoiceTime}`, rightColX, billToY + 36);

      // Items Table
      const tableTop = 240;
      const tableHeaders = ['#', 'Item Name', 'Quantity', 'Price/ Unit', 'Discount', 'Amount'];
      const colWidths = [30, 180, 60, 80, 80, 85];
      let colX = margin;

      // Table header background
      doc.fillColor('#0099cc').rect(margin, tableTop, pageWidth - 2 * margin, 20).fill();

      // Table headers
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
      colX = margin;
      for (let i = 0; i < tableHeaders.length; i++) {
        doc.text(tableHeaders[i], colX + 5, tableTop + 6, { width: colWidths[i] - 10, align: i === 0 ? 'center' : 'left' });
        colX += colWidths[i];
      }

      // Vertical lines for table header
      doc.strokeColor('#ffffff').lineWidth(0.5);
      colX = margin;
      for (let i = 0; i < colWidths.length; i++) {
        colX += colWidths[i];
        if (i < colWidths.length - 1) {
          doc.moveTo(colX, tableTop).lineTo(colX, tableTop + 20).stroke();
        }
      }

      // Table row
      const rowY = tableTop + 28;
      doc.fontSize(9).font('Helvetica').fillColor('#000000');
      
      const carName = car.carName || car.name || 'Car Rental';
      const totalPrice = booking.totalPrice || 0;
      const discount = booking.discount || 0;
      const discountPercent = totalPrice > 0 ? ((discount / totalPrice) * 100).toFixed(2) : 0;
      const netAmount = totalPrice - discount;

      colX = margin;
      doc.text('1', colX + 5, rowY, { width: colWidths[0] - 10, align: 'center' });
      colX += colWidths[0];
      doc.text(carName, colX + 5, rowY, { width: colWidths[1] - 10 });
      colX += colWidths[1];
      doc.text('1', colX + 5, rowY, { width: colWidths[2] - 10, align: 'center' });
      colX += colWidths[2];
      doc.text(`Rs. ${totalPrice.toLocaleString('en-IN')}`, colX + 5, rowY, { width: colWidths[3] - 10 });
      colX += colWidths[3];
      doc.text(`Rs. ${discount.toLocaleString('en-IN')}\n(${discountPercent}%)`, colX + 5, rowY - 2, { width: colWidths[4] - 10 });
      colX += colWidths[4];
      doc.text(`Rs. ${netAmount.toLocaleString('en-IN')}`, colX + 5, rowY, { width: colWidths[5] - 10 });

      // Horizontal line after item row
      const lineY = rowY + 25;
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.moveTo(margin, lineY).lineTo(pageWidth - margin, lineY).stroke();

      // Total row
      const totalRowY = lineY + 8;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Total', margin + colWidths[0] + 5, totalRowY);
      const discountX = margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5;
      doc.text(`Rs. ${discount.toLocaleString('en-IN')}`, discountX, totalRowY);
      const amountX = margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5;
      doc.text(`Rs. ${netAmount.toLocaleString('en-IN')}`, amountX, totalRowY);

      // Horizontal line after total
      const totalLineY = totalRowY + 18;
      doc.strokeColor('#000000').lineWidth(0.5);
      doc.moveTo(margin, totalLineY).lineTo(pageWidth - margin, totalLineY).stroke();

      // Invoice Amount in Words
      const amountInWordsY = totalLineY + 12;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Invoice Amount In Words', margin, amountInWordsY);
      doc.font('Helvetica').fillColor('#333333');
      
      // Convert number to words (simplified)
      const numberToWords = (num) => {
        if (num === 0) return 'Zero';
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
        
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
        if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
        if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
        return 'Amount exceeds limit';
      };
      
      const amountWords = numberToWords(Math.floor(totalPrice - discount)) + ' Rupees only';
      doc.text(amountWords, margin, amountInWordsY + 15);

      // Payment Summary Box (right side)
      const summaryX = pageWidth - margin - 180;
      const summaryY = amountInWordsY;
      const summaryWidth = 180;
      
      const advanceAmount = booking.advanceAmount || 0;
      
      // Get additional fees from booking if available
      const additionalFee1 = (booking.additionalFee1Name && booking.additionalFee1Amount) ? 
        { name: booking.additionalFee1Name, amount: booking.additionalFee1Amount } : null;
      const additionalFee2 = (booking.additionalFee2Name && booking.additionalFee2Amount) ? 
        { name: booking.additionalFee2Name, amount: booking.additionalFee2Amount } : null;
      const additionalFee3 = (booking.additionalFee3Name && booking.additionalFee3Amount) ? 
        { name: booking.additionalFee3Name, amount: booking.additionalFee3Amount } : null;
      
      // Calculate total additional fees
      const totalAdditionalFees = (additionalFee1?.amount || 0) + (additionalFee2?.amount || 0) + (additionalFee3?.amount || 0);
      const finalTotal = netAmount + totalAdditionalFees;
      const balance = finalTotal - advanceAmount;

      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      
      let currentY = summaryY;
      
      // Sub Total
      doc.text('Sub Total', summaryX, currentY);
      doc.text(`Rs. ${totalPrice.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
      currentY += 15;

      // Discount
      doc.text('Discount', summaryX, currentY);
      doc.text(`Rs. ${discount.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
      currentY += 17;

      // Additional Fees (if any)
      if (additionalFee1) {
        doc.text(additionalFee1.name, summaryX, currentY, { width: 85 });
        doc.text(`Rs. ${additionalFee1.amount.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
        currentY += 15;
      }
      if (additionalFee2) {
        doc.text(additionalFee2.name, summaryX, currentY, { width: 85 });
        doc.text(`Rs. ${additionalFee2.amount.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
        currentY += 15;
      }
      if (additionalFee3) {
        doc.text(additionalFee3.name, summaryX, currentY, { width: 85 });
        doc.text(`Rs. ${additionalFee3.amount.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
        currentY += 15;
      }

      // Total row with blue background
      doc.fillColor('#0099cc').rect(summaryX, currentY, summaryWidth, 18).fill();
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Total', summaryX + 5, currentY + 5);
      doc.text(`Rs. ${finalTotal.toLocaleString('en-IN')}`, summaryX + 90, currentY + 5, { width: 85, align: 'right' });
      currentY += 23;

      // Continue with other summary items
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      
      // Received
      doc.text('Received', summaryX, currentY);
      doc.text(`Rs. ${advanceAmount.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
      currentY += 15;

      // Balance
      doc.text('Balance', summaryX, currentY);
      doc.text(`Rs. ${balance.toLocaleString('en-IN')}`, summaryX + 90, currentY, { width: 85, align: 'right' });
      currentY += 15;

      // Payment Mode
      const paymentModeText = booking.paymentMode === 'cash' ? 'Cash' : 
                              booking.paymentMode === 'upi' ? 'UPI' : 
                              booking.paymentMode === 'bank_transfer' ? 'Bank Transfer' : 'Cash';
      doc.text('Payment Mode', summaryX, currentY);
      doc.text(paymentModeText, summaryX + 70, currentY, { width: 105, align: 'right' });

      // Bank Details and Signature (side by side, bottom)
      const bottomSectionY = currentY + 35;
      
      // Bank Details (left side)
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Pay To:', margin, bottomSectionY);
      
      doc.fontSize(8).font('Helvetica').fillColor('#333333');
      doc.text('Bank Name: Tirumulgerry', margin, bottomSectionY + 15);
      doc.text('Bank Account No.: 50200095949960', margin, bottomSectionY + 28);
      doc.text('Bank IFSC code: HDFC0006957', margin, bottomSectionY + 41);
      doc.text('Account Holder\'s Name: Zion Car Rental Service.', margin, bottomSectionY + 54);

      // Authorized Signatory (right side, aligned with bank details)
      doc.fontSize(8).font('Helvetica').fillColor('#333333');
      doc.text('For: ZION CAR RENTAL SERVICE', summaryX, bottomSectionY, { width: 180, align: 'right' });
      
      // Signature image
      const possibleSignaturePaths = [
        path.join(__dirname, 'uploads', 'signature.png'),
        path.join(__dirname, 'uploads', 'signature.jpg'),
        path.join(__dirname, 'uploads', 'signature.jpeg'),
      ];

      let signaturePath = null;
      for (const testPath of possibleSignaturePaths) {
        if (fs.existsSync(testPath)) {
          signaturePath = testPath;
          break;
        }
      }

      if (signaturePath) {
        try {
          doc.image(signaturePath, summaryX + 80, bottomSectionY + 15, { width: 80, height: 70, align: 'right' });
        } catch (error) {
          console.error('Error adding signature:', error);
          // Fallback to text if image fails
          doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666');
          doc.text('Signature', summaryX + 90, bottomSectionY + 45, { width: 85, align: 'right' });
        }
      } else {
        // Signature placeholder text if no image
        doc.fontSize(10).font('Helvetica-Oblique').fillColor('#666666');
        doc.text('Signature', summaryX + 90, bottomSectionY + 45, { width: 85, align: 'right' });
      }
      
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#000000');
      doc.text('Authorized Signatory', summaryX + 55, bottomSectionY + 90, { width: 120, align: 'center' });

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

  // Get all regular bookings that block availability (advance_paid, verified, active)
  const blockingStatuses = ['advance_paid', 'verified', 'active'];
  const existingBookings = await Booking.find({
    carId,
    status: { $in: blockingStatuses }
  }).sort({ startTime: 1 });

  // Also get admin bookings (offline walk-in customers) for this car
  const adminBookings = await AdminBooking.find({ carId }).sort({ startTime: 1 });

  // Combine all bookings into one array for checking
  const allBlockingBookings = [
    ...existingBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime, type: 'regular' })),
    ...adminBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime, type: 'admin' }))
  ].sort((a, b) => a.startTime - b.startTime);

  // Check for overlaps
  for (const booking of allBlockingBookings) {
    if (checkTimeOverlap(requestedStart, requestedEnd, booking.startTime, booking.endTime)) {
      // Find next available time (after this booking ends)
      const nextAvailableStart = new Date(booking.endTime);

      // Find max duration until next booking
      let maxDurationHours = null;
      const nextBooking = allBlockingBookings.find(b =>
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

      // Send email notification to admin about new booking
      await sendNewBookingEmail({
        bookingId: booking._id,
        customerName: fullName,
        mobile,
        email,
        carName: car.carName,
        startTime: start,
        endTime: end,
        totalPrice
      });

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

// ==================== CARS PAGE BANNER ROUTES ====================

// Get active cars banner (public)
app.get('/api/cars-banner', async (req, res) => {
  try {
    const banner = await CarsBanner.findOne({ active: true }).sort({ updatedAt: -1 });
    if (!banner) {
      return res.json({ banner: null });
    }
    res.json({ banner });
  } catch (error) {
    console.error('Get cars banner error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get cars banner settings
app.get('/api/admin/cars-banner', authenticate, isAdmin, async (req, res) => {
  try {
    const banner = await CarsBanner.findOne().sort({ updatedAt: -1 });
    res.json({ banner: banner || null });
  } catch (error) {
    console.error('Get admin cars banner error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update cars banner
app.put('/api/admin/cars-banner', authenticate, isAdmin, async (req, res) => {
  try {
    const { imageUrl, title, description, linkUrl, active } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    // Deactivate all existing banners
    if (active !== false) {
      await CarsBanner.updateMany({}, { active: false });
    }

    // Create or update banner
    const banner = await CarsBanner.findOneAndUpdate(
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

    res.json({ message: 'Cars banner updated successfully', banner });
  } catch (error) {
    console.error('Update cars banner error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ADMIN BOOKING ROUTES (Offline Walk-in Customers) ====================

// Create admin booking (offline walk-in customer)
app.post('/api/admin/bookings', authenticate, isAdmin, async (req, res) => {
  try {
    const { 
      customerId,
      customerName,
      guardianName,
      guardianRelation,
      mobile,
      email,
      occupation,
      residentialAddress,
      drivingLicenseNumber,
      licenseExpiryDate,
      carId,
      startTime,
      endTime,
      totalAmount,
      advancedAmount,
      discount,
      notes,
      additionalFee1Name,
      additionalFee1Amount,
      additionalFee2Name,
      additionalFee2Amount,
      additionalFee3Name,
      additionalFee3Amount
    } = req.body;

    // Check if this is a car block (customerName === "BLOCKED")
    const isBlock = customerName === "BLOCKED";

    // Validate required fields
    if (!isBlock && (!customerId || !customerName || !mobile || !carId || !startTime || !endTime)) {
      return res.status(400).json({ error: 'Customer, car, start time and end time are required' });
    }

    // For blocks, only validate car, start time, and end time
    if (isBlock && (!carId || !startTime || !endTime)) {
      return res.status(400).json({ error: 'Car, start time and end time are required' });
    }

    // Verify customer exists (skip for blocks)
    if (!isBlock) {
      const customer = await Customer.findById(customerId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }

    // Verify car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Calculate duration in hours for availability check
    const durationHours = Math.ceil((end - start) / (60 * 60 * 1000));

    // Check availability before creating booking
    const availabilityCheck = await getAvailabilityInfo(carId, start, durationHours);
    if (!availabilityCheck.available) {
      return res.status(400).json({
        error: 'Car is not available for the selected time',
        nextAvailableStartTime: availabilityCheck.nextAvailableStartTime,
        maxDurationHours: availabilityCheck.maxDurationHours
      });
    }

    const adminBooking = new AdminBooking({
      customerId: isBlock ? null : customerId,
      customerName,
      guardianName: isBlock ? null : guardianName,
      guardianRelation: isBlock ? null : guardianRelation,
      mobile: isBlock ? "0000000000" : mobile,
      email: isBlock ? null : email,
      occupation: isBlock ? null : occupation,
      residentialAddress: isBlock ? null : residentialAddress,
      drivingLicenseNumber: isBlock ? null : drivingLicenseNumber,
      licenseExpiryDate: isBlock ? null : (licenseExpiryDate ? new Date(licenseExpiryDate) : null),
      carId,
      startTime: start,
      endTime: end,
      totalAmount: totalAmount || 0,
      advancedAmount: advancedAmount || 0,
      discount: discount || 0,
      additionalFee1Name: additionalFee1Name || undefined,
      additionalFee1Amount: additionalFee1Amount || undefined,
      additionalFee2Name: additionalFee2Name || undefined,
      additionalFee2Amount: additionalFee2Amount || undefined,
      additionalFee3Name: additionalFee3Name || undefined,
      additionalFee3Amount: additionalFee3Amount || undefined,
      notes: notes || '',
      createdBy: req.userId
    });

    await adminBooking.save();

    // Populate car and customer details for response
    await adminBooking.populate('carId', 'carName model brand');
    await adminBooking.populate('customerId', 'fullName mobile email');
    await adminBooking.populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Admin booking created successfully. Car is now blocked for the selected time.',
      booking: adminBooking
    });
  } catch (error) {
    console.error('Create admin booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all admin bookings
app.get('/api/admin/bookings/offline', authenticate, isAdmin, async (req, res) => {
  try {
    const adminBookings = await AdminBooking.find()
      .populate('carId', 'carName model brand type imageUrl')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ bookings: adminBookings });
  } catch (error) {
    console.error('Get admin bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get admin bookings by carId (for fetching blocks)
app.get('/api/admin/bookings', authenticate, isAdmin, async (req, res) => {
  try {
    const { carId } = req.query;
    
    const query = carId ? { carId } : {};
    const adminBookings = await AdminBooking.find(query)
      .populate('carId', 'carName model brand type imageUrl')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(adminBookings);
  } catch (error) {
    console.error('Get admin bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update admin booking (for editing blocks)
app.put('/api/admin/bookings/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { customerName, customerMobile, carId, startTime, endTime, amount, notes } = req.body;
    const bookingId = req.params.id;

    // Find existing booking
    const existingBooking = await AdminBooking.findById(bookingId);
    if (!existingBooking) {
      return res.status(404).json({ error: 'Admin booking not found' });
    }

    // Validate required fields
    if (!customerName || !customerMobile || !carId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Customer name, mobile, car, start time and end time are required' });
    }

    // Verify car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Calculate duration in hours for availability check
    const durationHours = Math.ceil((end - start) / (60 * 60 * 1000));

    // Check availability before updating (exclude the current booking being edited)
    const blockingStatuses = ['advance_paid', 'verified', 'active'];
    const existingBookings = await Booking.find({
      carId,
      status: { $in: blockingStatuses }
    }).sort({ startTime: 1 });

    // Get other admin bookings (excluding the one being edited)
    const adminBookings = await AdminBooking.find({ 
      carId,
      _id: { $ne: bookingId } // Exclude current booking
    }).sort({ startTime: 1 });

    // Combine all bookings
    const allBlockingBookings = [
      ...existingBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime, type: 'regular' })),
      ...adminBookings.map(b => ({ startTime: b.startTime, endTime: b.endTime, type: 'admin' }))
    ].sort((a, b) => a.startTime - b.startTime);

    // Check for overlaps
    for (const booking of allBlockingBookings) {
      if (checkTimeOverlap(start, end, booking.startTime, booking.endTime)) {
        return res.status(400).json({
          error: 'Car is not available for the selected time. There is a conflict with an existing booking.'
        });
      }
    }

    // Update the booking
    existingBooking.customerName = customerName;
    existingBooking.customerMobile = customerMobile;
    existingBooking.carId = carId;
    existingBooking.startTime = start;
    existingBooking.endTime = end;
    existingBooking.amount = amount || 0;
    existingBooking.notes = notes || '';

    await existingBooking.save();

    // Populate car details for response
    await existingBooking.populate('carId', 'carName model brand');
    await existingBooking.populate('createdBy', 'name email');

    res.json({
      message: 'Admin booking updated successfully',
      booking: existingBooking
    });
  } catch (error) {
    console.error('Update admin booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update payment status for admin booking
app.patch('/api/admin/bookings/:id/payment', authenticate, isAdmin, async (req, res) => {
  try {
    const { paymentType, customAmount } = req.body; // 'advanced', 'full', 'custom', or 'reset'
    const bookingId = req.params.id;

    const booking = await AdminBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Admin booking not found' });
    }

    const totalAmount = booking.totalAmount || 0;
    const discount = booking.discount || 0;
    const additionalFees = (booking.additionalFee1Amount || 0) + (booking.additionalFee2Amount || 0) + (booking.additionalFee3Amount || 0);
    const expectedAdvanced = booking.advancedAmount || 0; // Originally entered amount
    const balanceAmount = totalAmount - discount + additionalFees;

    if (paymentType === 'advanced') {
      // Use the originally entered advanced amount
      booking.paidAmount = expectedAdvanced;
      booking.paymentStatus = 'advanced';
    } else if (paymentType === 'full') {
      // Set paid amount to full balance
      booking.paidAmount = balanceAmount;
      booking.paymentStatus = 'full';
    } else if (paymentType === 'custom') {
      // Use custom amount provided
      if (typeof customAmount !== 'number' || customAmount <= 0) {
        return res.status(400).json({ error: 'Invalid custom amount' });
      }
      booking.paidAmount = customAmount;
      // Determine status based on amount
      if (customAmount >= balanceAmount) {
        booking.paymentStatus = 'full';
      } else if (customAmount > 0) {
        booking.paymentStatus = 'advanced';
      } else {
        booking.paymentStatus = 'unpaid';
      }
    } else if (paymentType === 'reset') {
      // Reset payment
      booking.paidAmount = 0;
      booking.paymentStatus = 'unpaid';
    } else {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    await booking.save();

    // Populate for response
    await booking.populate('carId', 'carName model brand type imageUrl');
    await booking.populate('createdBy', 'name email');

    res.json({
      message: 'Payment status updated successfully',
      booking
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update admin booking (additional fees, notes, etc.)
app.patch('/api/admin/bookings/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const {
      additionalFee1Name,
      additionalFee1Amount,
      additionalFee2Name,
      additionalFee2Amount,
      additionalFee3Name,
      additionalFee3Amount,
      notes
    } = req.body;

    const booking = await AdminBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Admin booking not found' });
    }

    // Update fields if provided
    if (additionalFee1Name !== undefined) booking.additionalFee1Name = additionalFee1Name;
    if (additionalFee1Amount !== undefined) booking.additionalFee1Amount = additionalFee1Amount;
    if (additionalFee2Name !== undefined) booking.additionalFee2Name = additionalFee2Name;
    if (additionalFee2Amount !== undefined) booking.additionalFee2Amount = additionalFee2Amount;
    if (additionalFee3Name !== undefined) booking.additionalFee3Name = additionalFee3Name;
    if (additionalFee3Amount !== undefined) booking.additionalFee3Amount = additionalFee3Amount;
    if (notes !== undefined) booking.notes = notes;

    await booking.save();

    // Populate for response
    await booking.populate('carId', 'carName model brand type imageUrl');
    await booking.populate('createdBy', 'name email');

    res.json({
      message: 'Booking updated successfully',
      booking
    });
  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete admin booking (supports both routes)
app.delete('/api/admin/bookings/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const booking = await AdminBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Admin booking not found' });
    }

    await AdminBooking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin booking deleted successfully. Time slot is now available.' });
  } catch (error) {
    console.error('Delete admin booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete admin booking (legacy route for backward compatibility)
app.delete('/api/admin/bookings/offline/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const booking = await AdminBooking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: 'Admin booking not found' });
    }

    await AdminBooking.findByIdAndDelete(req.params.id);
    res.json({ message: 'Admin booking deleted successfully. Time slot is now available.' });
  } catch (error) {
    console.error('Delete admin booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate receipt for admin booking
app.get('/api/admin/bookings/:id/receipt', authenticate, isAdmin, async (req, res) => {
  try {
    const booking = await AdminBooking.findById(req.params.id)
      .populate('carId')
      .populate('customerId');

    if (!booking) {
      return res.status(404).json({ error: 'Admin booking not found' });
    }

    // Check if any payment has been made
    if (!booking.paidAmount || booking.paidAmount === 0) {
      return res.status(400).json({ error: 'Receipt can only be generated after payment is recorded' });
    }

    // Create a customer object compatible with generateReceiptPDF
    const customerData = {
      name: booking.customerName,
      email: booking.email,
      mobile: booking.mobile,
      guardianName: booking.guardianName,
      guardianRelation: booking.guardianRelation,
      occupation: booking.occupation,
      residentialAddress: booking.residentialAddress,
      drivingLicenseNumber: booking.drivingLicenseNumber,
      licenseExpiryDate: booking.licenseExpiryDate
    };

    // Create a booking object compatible with generateReceiptPDF
    const bookingData = {
      _id: booking._id,
      startTime: booking.startTime,
      endTime: booking.endTime,
      totalPrice: booking.totalAmount,
      advanceAmount: booking.paidAmount,
      discount: booking.discount || 0,
      additionalFee1Name: booking.additionalFee1Name,
      additionalFee1Amount: booking.additionalFee1Amount,
      additionalFee2Name: booking.additionalFee2Name,
      additionalFee2Amount: booking.additionalFee2Amount,
      additionalFee3Name: booking.additionalFee3Name,
      additionalFee3Amount: booking.additionalFee3Amount,
      createdAt: booking.createdAt,
      notes: booking.notes || ''
    };

    // Generate PDF on-demand
    const pdfBuffer = await generateReceiptPDF(bookingData, booking.carId, customerData);

    // Send the PDF directly from memory
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="admin-booking-receipt-${booking._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error serving admin booking receipt PDF:', error);
    res.status(500).json({ error: error.message || 'Failed to generate receipt' });
  }
});

// ==================== CUSTOMER MANAGEMENT (ADMIN ONLY) ====================

// Get all customers
app.get('/api/admin/customers', authenticate, isAdmin, async (req, res) => {
  try {
    const customers = await Customer.find()
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ customers });
  } catch (error) {
    console.error('Fetch customers error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single customer by ID
app.get('/api/admin/customers/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    res.json({ customer });
  } catch (error) {
    console.error('Fetch customer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new customer
app.post('/api/admin/customers', authenticate, isAdmin, async (req, res) => {
  try {
    const {
      fullName,
      guardianName,
      guardianRelation,
      mobile,
      email,
      occupation,
      residentialAddress,
      drivingLicenseNumber,
      licenseExpiryDate,
      drivingLicenseImage,
      aadharCardImage,
      livePhoto
    } = req.body;

    // Validation
    if (!fullName || !guardianName || !guardianRelation || !mobile || !email || 
        !occupation || !residentialAddress || !drivingLicenseNumber || !licenseExpiryDate) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Check if customer with same mobile or email already exists
    const existingCustomer = await Customer.findOne({
      $or: [{ mobile }, { email }]
    });

    if (existingCustomer) {
      return res.status(400).json({ 
        error: 'Customer with this mobile number or email already exists' 
      });
    }

    const customer = new Customer({
      fullName,
      guardianName,
      guardianRelation,
      mobile,
      email,
      occupation,
      residentialAddress,
      drivingLicenseNumber,
      licenseExpiryDate,
      drivingLicenseImage,
      aadharCardImage,
      livePhoto,
      createdBy: req.userId
    });

    await customer.save();

    const populatedCustomer = await Customer.findById(customer._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      message: 'Customer created successfully',
      customer: populatedCustomer
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update customer
app.put('/api/admin/customers/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const {
      fullName,
      guardianName,
      guardianRelation,
      mobile,
      email,
      occupation,
      residentialAddress,
      drivingLicenseNumber,
      licenseExpiryDate,
      drivingLicenseImage,
      aadharCardImage,
      livePhoto
    } = req.body;

    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if mobile or email is being changed to an existing one
    if (mobile && mobile !== customer.mobile) {
      const existingMobile = await Customer.findOne({ mobile, _id: { $ne: req.params.id } });
      if (existingMobile) {
        return res.status(400).json({ error: 'This mobile number is already in use' });
      }
    }

    if (email && email !== customer.email) {
      const existingEmail = await Customer.findOne({ email, _id: { $ne: req.params.id } });
      if (existingEmail) {
        return res.status(400).json({ error: 'This email is already in use' });
      }
    }

    // Update fields
    if (fullName) customer.fullName = fullName;
    if (guardianName) customer.guardianName = guardianName;
    if (guardianRelation) customer.guardianRelation = guardianRelation;
    if (mobile) customer.mobile = mobile;
    if (email) customer.email = email;
    if (occupation) customer.occupation = occupation;
    if (residentialAddress) customer.residentialAddress = residentialAddress;
    if (drivingLicenseNumber) customer.drivingLicenseNumber = drivingLicenseNumber;
    if (licenseExpiryDate) customer.licenseExpiryDate = licenseExpiryDate;
    if (drivingLicenseImage !== undefined) customer.drivingLicenseImage = drivingLicenseImage;
    if (aadharCardImage !== undefined) customer.aadharCardImage = aadharCardImage;
    if (livePhoto !== undefined) customer.livePhoto = livePhoto;

    customer.updatedAt = Date.now();

    await customer.save();

    const populatedCustomer = await Customer.findById(customer._id)
      .populate('createdBy', 'name email');

    res.json({
      message: 'Customer updated successfully',
      customer: populatedCustomer
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete customer
app.delete('/api/admin/customers/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await Customer.findByIdAndDelete(req.params.id);

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
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
        'GET /api/admin/stats',
        'GET /api/admin/customers',
        'GET /api/admin/customers/:id',
        'POST /api/admin/customers',
        'PUT /api/admin/customers/:id',
        'DELETE /api/admin/customers/:id',
        'GET /api/admin/bookings/offline',
        'POST /api/admin/bookings',
        'DELETE /api/admin/bookings/offline/:id'
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
