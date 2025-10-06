// ============================================
// ZION CAR RENTALS - PRODUCTION BACKEND
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult, param, query } = require('express-validator');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ============================================
// SECURITY & MIDDLEWARE CONFIGURATION
// ============================================

// Security Headers
app.use(helmet()); // Sets security HTTP headers

// CORS Configuration
app.use(cors());

// Rate Limiting (Anti-DDoS)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined')); // Detailed logs
} else {
  app.use(morgan('dev')); // Concise logs
}

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
  process.exit(1);
});

// ============================================
// DATABASE MODELS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true, trim: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Car Schema
const carSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price12hrs: { type: Number, required: true, min: 0 },
  price24hrs: { type: Number, required: true, min: 0 },
  transmission: { type: String, enum: ['Manual', 'Automatic'], required: true },
  fuel: { type: String, enum: ['Petrol', 'Diesel'], required: true },
  images: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

// Indexes for performance
carSchema.index({ name: 1 });

const Car = mongoose.model('Car', carSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  startTime: { type: String, required: true }, // Format: "HH:MM" e.g., "00:00"
  endTime: { type: String, required: true },   // Format: "HH:MM" e.g., "12:00"
  duration: { type: Number, required: true, enum: [12, 24] }, // hours
  totalAmount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  paymentId: { type: String },
  paymentMethod: { type: String },
  razorpayOrderId: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Compound indexes for availability queries
bookingSchema.index({ carId: 1, startDate: 1, endDate: 1, status: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

// Cart Schema
const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  duration: { type: Number, required: true, enum: [12, 24] },
  calculatedPrice: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

cartSchema.index({ userId: 1 });

const Cart = mongoose.model('Cart', cartSchema);

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Create DateTime from date and time strings
const createDateTime = (dateStr, timeStr) => {
  const date = new Date(dateStr);
  const [hours, minutes] = timeStr.split(':');
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  return date;
};

// Check if two time ranges overlap
const hasTimeOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && end1 > start2;
};

// Check car availability for a time slot
const checkAvailability = async (carId, startDateTime, endDateTime, excludeBookingId = null) => {
  const query = {
    carId: carId,
    status: { $in: ['pending', 'confirmed'] }
  };
  
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  const existingBookings = await Booking.find(query);
  
  for (let booking of existingBookings) {
    const bookingStart = createDateTime(booking.startDate, booking.startTime);
    const bookingEnd = createDateTime(booking.endDate, booking.endTime);
    
    if (hasTimeOverlap(startDateTime, endDateTime, bookingStart, bookingEnd)) {
      return false; // Overlap found
    }
  }
  
  return true; // Available
};

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const protect = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Admin Middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
  }
};

// Validation Error Handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// Register User
app.post('/api/auth/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').trim().notEmpty().withMessage('Phone is required')
], validate, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    // Create user
    const user = await User.create({ name, email, password, phone });
    
    // Generate token
    const token = generateToken(user._id);
    
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login User
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Profile
app.get('/api/auth/profile', protect, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role
      }
    });
  } catch (error) {
    console.error('Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Profile
app.put('/api/auth/profile', protect, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty()
], validate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password');
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// CAR ROUTES
// ============================================

// Get All Cars
app.get('/api/cars', async (req, res) => {
  try {
    const { transmission, fuel, minPrice, maxPrice } = req.query;
    
    const filter = {};
    if (transmission) filter.transmission = transmission;
    if (fuel) filter.fuel = fuel;
    if (minPrice || maxPrice) {
      filter.price12hrs = {};
      if (minPrice) filter.price12hrs.$gte = Number(minPrice);
      if (maxPrice) filter.price12hrs.$lte = Number(maxPrice);
    }
    
    const cars = await Car.find(filter).sort({ createdAt: -1 });
    
    res.json({ success: true, count: cars.length, data: cars });
  } catch (error) {
    console.error('Get Cars Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Single Car
app.get('/api/cars/:id', param('id').isMongoId(), validate, async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    res.json({ success: true, data: car });
  } catch (error) {
    console.error('Get Car Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add Car (Admin Only)
app.post('/api/cars', protect, adminOnly, [
  body('name').trim().notEmpty().withMessage('Car name is required'),
  body('price12hrs').isNumeric().withMessage('12-hour price is required'),
  body('price24hrs').isNumeric().withMessage('24-hour price is required'),
  body('transmission').isIn(['Manual', 'Automatic']).withMessage('Invalid transmission type'),
  body('fuel').isIn(['Petrol', 'Diesel']).withMessage('Invalid fuel type'),
  body('images').optional().isArray()
], validate, async (req, res) => {
  try {
    const { name, price12hrs, price24hrs, transmission, fuel, images } = req.body;
    
    const car = await Car.create({ name, price12hrs, price24hrs, transmission, fuel, images: images || [] });
    
    res.status(201).json({ success: true, data: car });
  } catch (error) {
    console.error('Add Car Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Car (Admin Only)
app.put('/api/cars/:id', protect, adminOnly, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const { name, price12hrs, price24hrs, transmission, fuel, images } = req.body;
    
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { name, price12hrs, price24hrs, transmission, fuel, images },
      { new: true, runValidators: true }
    );
    
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    res.json({ success: true, data: car });
  } catch (error) {
    console.error('Update Car Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Car (Admin Only)
app.delete('/api/cars/:id', protect, adminOnly, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const car = await Car.findByIdAndDelete(req.params.id);
    
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    res.json({ success: true, message: 'Car deleted successfully' });
  } catch (error) {
    console.error('Delete Car Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// AVAILABILITY ROUTES
// ============================================

// Check Availability
app.post('/api/availability/check', [
  body('carId').isMongoId().withMessage('Valid car ID is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required (HH:MM)'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required (HH:MM)')
], validate, async (req, res) => {
  try {
    const { carId, startDate, startTime, endDate, endTime } = req.body;
    
    // Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    // Create DateTime objects
    const startDateTime = createDateTime(startDate, startTime);
    const endDateTime = createDateTime(endDate, endTime);
    
    // Validate time range
    if (startDateTime >= endDateTime) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }
    
    // Check availability
    const isAvailable = await checkAvailability(carId, startDateTime, endDateTime);
    
    // Get blocked slots if not available
    let blockedSlots = [];
    if (!isAvailable) {
      const bookings = await Booking.find({
        carId: carId,
        status: { $in: ['pending', 'confirmed'] }
      }).select('startDate startTime endDate endTime');
      
      blockedSlots = bookings.map(b => ({
        start: `${b.startDate.toISOString().split('T')[0]} ${b.startTime}`,
        end: `${b.endDate.toISOString().split('T')[0]} ${b.endTime}`
      }));
    }
    
    res.json({
      success: true,
      available: isAvailable,
      message: isAvailable ? 'Car is available for booking' : 'Car is not available for the selected time slot',
      blockedSlots
    });
  } catch (error) {
    console.error('Check Availability Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Available Slots for a Car on a Date
app.post('/api/availability/available-slots', [
  body('carId').isMongoId().withMessage('Valid car ID is required'),
  body('date').isISO8601().withMessage('Valid date is required')
], validate, async (req, res) => {
  try {
    const { carId, date } = req.body;
    
    // Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    // Get all bookings for this car on this date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const bookings = await Booking.find({
      carId: carId,
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { startDate: { $lte: endOfDay }, endDate: { $gte: startOfDay } }
      ]
    }).sort({ startTime: 1 });
    
    // Calculate available slots
    const blockedSlots = bookings.map(b => ({
      start: b.startTime,
      end: b.endTime
    }));
    
    res.json({
      success: true,
      date: date,
      car: car.name,
      blockedSlots,
      message: blockedSlots.length > 0 ? 'Some time slots are booked' : 'All time slots are available'
    });
  } catch (error) {
    console.error('Get Available Slots Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Calendar View for a Car
app.get('/api/availability/calendar/:carId', protect, adminOnly, param('carId').isMongoId(), validate, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    
    const bookings = await Booking.find({
      carId: req.params.carId,
      status: { $in: ['pending', 'confirmed'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    }).populate('userId', 'name email phone').sort({ startDate: 1, startTime: 1 });
    
    const car = await Car.findById(req.params.carId);
    
    res.json({
      success: true,
      car: car ? car.name : 'Unknown',
      month: targetMonth + 1,
      year: targetYear,
      bookings
    });
  } catch (error) {
    console.error('Get Calendar Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// RENTAL/PRICING ROUTES
// ============================================

// Calculate Rental Price
app.post('/api/rentals/calculate', [
  body('carId').isMongoId().withMessage('Valid car ID is required'),
  body('duration').isIn([12, 24]).withMessage('Duration must be 12 or 24 hours')
], validate, async (req, res) => {
  try {
    const { carId, duration } = req.body;
    
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    const price = duration === 12 ? car.price12hrs : car.price24hrs;
    
    res.json({
      success: true,
      carId: car._id,
      carName: car.name,
      duration,
      price
    });
  } catch (error) {
    console.error('Calculate Price Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// CART ROUTES
// ============================================

// Add to Cart
app.post('/api/cart', protect, [
  body('carId').isMongoId().withMessage('Valid car ID is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid start time is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  body('endTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid end time is required'),
  body('duration').isIn([12, 24]).withMessage('Duration must be 12 or 24 hours')
], validate, async (req, res) => {
  try {
    const { carId, startDate, startTime, endDate, endTime, duration } = req.body;
    
    // Check if car exists
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    
    // Create DateTime objects
    const startDateTime = createDateTime(startDate, startTime);
    const endDateTime = createDateTime(endDate, endTime);
    
    // Check availability
    const isAvailable = await checkAvailability(carId, startDateTime, endDateTime);
    if (!isAvailable) {
      return res.status(400).json({ success: false, message: 'Car is not available for the selected time slot' });
    }
    
    // Calculate price
    const price = duration === 12 ? car.price12hrs : car.price24hrs;
    
    // Check if already in cart
    const existingCartItem = await Cart.findOne({ userId: req.user._id, carId });
    if (existingCartItem) {
      return res.status(400).json({ success: false, message: 'Car already in cart' });
    }
    
    // Add to cart
    const cartItem = await Cart.create({
      userId: req.user._id,
      carId,
      startDate,
      startTime,
      endDate,
      endTime,
      duration,
      calculatedPrice: price
    });
    
    const populatedItem = await Cart.findById(cartItem._id).populate('carId');
    
    res.status(201).json({ success: true, data: populatedItem });
  } catch (error) {
    console.error('Add to Cart Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Cart
app.get('/api/cart', protect, async (req, res) => {
  try {
    const cartItems = await Cart.find({ userId: req.user._id }).populate('carId').sort({ createdAt: -1 });
    
    const totalAmount = cartItems.reduce((sum, item) => sum + item.calculatedPrice, 0);
    
    res.json({ success: true, count: cartItems.length, totalAmount, data: cartItems });
  } catch (error) {
    console.error('Get Cart Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Cart Item
app.put('/api/cart/:itemId', protect, param('itemId').isMongoId(), [
  body('startDate').optional().isISO8601(),
  body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('endDate').optional().isISO8601(),
  body('endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('duration').optional().isIn([12, 24])
], validate, async (req, res) => {
  try {
    const cartItem = await Cart.findOne({ _id: req.params.itemId, userId: req.user._id });
    
    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    
    const { startDate, startTime, endDate, endTime, duration } = req.body;
    
    // Update fields if provided
    if (startDate) cartItem.startDate = startDate;
    if (startTime) cartItem.startTime = startTime;
    if (endDate) cartItem.endDate = endDate;
    if (endTime) cartItem.endTime = endTime;
    if (duration) cartItem.duration = duration;
    
    // Recalculate price if duration changed
    if (duration) {
      const car = await Car.findById(cartItem.carId);
      cartItem.calculatedPrice = duration === 12 ? car.price12hrs : car.price24hrs;
    }
    
    // Check availability with new times
    const startDateTime = createDateTime(cartItem.startDate, cartItem.startTime);
    const endDateTime = createDateTime(cartItem.endDate, cartItem.endTime);
    
    const isAvailable = await checkAvailability(cartItem.carId, startDateTime, endDateTime);
    if (!isAvailable) {
      return res.status(400).json({ success: false, message: 'Car is not available for the selected time slot' });
    }
    
    await cartItem.save();
    
    const updatedItem = await Cart.findById(cartItem._id).populate('carId');
    
    res.json({ success: true, data: updatedItem });
  } catch (error) {
    console.error('Update Cart Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove from Cart
app.delete('/api/cart/:itemId', protect, param('itemId').isMongoId(), validate, async (req, res) => {
  try {
    const cartItem = await Cart.findOneAndDelete({ _id: req.params.itemId, userId: req.user._id });
    
    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from Cart Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Clear Cart
app.delete('/api/cart', protect, async (req, res) => {
  try {
    await Cart.deleteMany({ userId: req.user._id });
    
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear Cart Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// CHECKOUT & BOOKING ROUTES
// ============================================

// Create Booking from Cart
app.post('/api/checkout', protect, async (req, res) => {
  try {
    // Get cart items
    const cartItems = await Cart.find({ userId: req.user._id }).populate('carId');
    
    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }
    
    // Revalidate availability for all items
    for (let item of cartItems) {
      const startDateTime = createDateTime(item.startDate, item.startTime);
      const endDateTime = createDateTime(item.endDate, item.endTime);
      
      const isAvailable = await checkAvailability(item.carId._id, startDateTime, endDateTime);
      if (!isAvailable) {
        return res.status(400).json({ 
          success: false, 
          message: `${item.carId.name} is no longer available for the selected time slot` 
        });
      }
    }
    
    // Create bookings
    const bookings = [];
    for (let item of cartItems) {
      const booking = await Booking.create({
        userId: req.user._id,
        carId: item.carId._id,
        startDate: item.startDate,
        endDate: item.endDate,
        startTime: item.startTime,
        endTime: item.endTime,
        duration: item.duration,
        totalAmount: item.calculatedPrice,
        status: 'pending'
      });
      
      bookings.push(booking);
    }
    
    // Clear cart
    await Cart.deleteMany({ userId: req.user._id });
    
    // Calculate total
    const totalAmount = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    
    res.status(201).json({
      success: true,
      message: 'Bookings created successfully',
      bookings,
      totalAmount,
      // In production, you'd create Razorpay order here and return order_id
      razorpayOrderId: 'order_' + Date.now() // Placeholder
    });
  } catch (error) {
    console.error('Checkout Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// PAYMENT ROUTES
// ============================================

// Initiate Payment
app.post('/api/payment/initiate', protect, [
  body('bookingIds').isArray().withMessage('Booking IDs must be an array'),
  body('bookingIds.*').isMongoId().withMessage('Invalid booking ID')
], validate, async (req, res) => {
  try {
    const { bookingIds } = req.body;
    
    // Verify bookings belong to user
    const bookings = await Booking.find({ _id: { $in: bookingIds }, userId: req.user._id });
    
    if (bookings.length !== bookingIds.length) {
      return res.status(400).json({ success: false, message: 'Invalid booking IDs' });
    }
    
    const totalAmount = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    
    // In production: Create Razorpay order
    // const razorpay = require('razorpay');
    // const instance = new razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    // const order = await instance.orders.create({ amount: totalAmount * 100, currency: 'INR' });
    
    res.json({
      success: true,
      orderId: 'order_' + Date.now(), // Placeholder - replace with actual Razorpay order_id
      amount: totalAmount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Initiate Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify Payment
app.post('/api/payment/verify', protect, [
  body('razorpayOrderId').notEmpty(),
  body('razorpayPaymentId').notEmpty(),
  body('razorpaySignature').notEmpty(),
  body('bookingIds').isArray()
], validate, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingIds } = req.body;
    
    // In production: Verify Razorpay signature
    // const crypto = require('crypto');
    // const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
    // hmac.update(razorpayOrderId + '|' + razorpayPaymentId);
    // const generatedSignature = hmac.digest('hex');
    // if (generatedSignature !== razorpaySignature) {
    //   return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    // }
    
    // Update bookings
    await Booking.updateMany(
      { _id: { $in: bookingIds }, userId: req.user._id },
      {
        status: 'confirmed',
        paymentId: razorpayPaymentId,
        razorpayOrderId: razorpayOrderId,
        paymentMethod: 'Razorpay'
      }
    );
    
    res.json({ success: true, message: 'Payment verified and bookings confirmed' });
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ORDER/BOOKING ROUTES
// ============================================

// Get User's Bookings
app.get('/api/orders', protect, async (req, res) => {
  try {
    const { status } = req.query;
    
    const filter = { userId: req.user._id };
    if (status) filter.status = status;
    
    const bookings = await Booking.find(filter).populate('carId').sort({ createdAt: -1 });
    
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Get Orders Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Single Booking
app.get('/api/orders/:id', protect, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id }).populate('carId');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get Order Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Cancel Booking
app.put('/api/orders/:id/cancel', protect, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this booking' });
    }
    
    booking.status = 'cancelled';
    await booking.save();
    
    res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (error) {
    console.error('Cancel Booking Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get All Bookings (Admin)
app.get('/api/admin/bookings', protect, adminOnly, async (req, res) => {
  try {
    const { status, carId, startDate, endDate } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (carId) filter.carId = carId;
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }
    
    const bookings = await Booking.find(filter)
      .populate('userId', 'name email phone')
      .populate('carId')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Admin Get Bookings Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Single Booking (Admin)
app.get('/api/admin/bookings/:id', protect, adminOnly, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name email phone')
      .populate('carId');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Admin Get Booking Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update Booking Status (Admin)
app.put('/api/admin/bookings/:id/status', protect, adminOnly, [
  param('id').isMongoId(),
  body('status').isIn(['pending', 'confirmed', 'completed', 'cancelled'])
], validate, async (req, res) => {
  try {
    const { status } = req.body;
    
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('carId');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking status updated', data: booking });
  } catch (error) {
    console.error('Update Booking Status Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete Booking (Admin)
app.delete('/api/admin/bookings/:id', protect, adminOnly, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, message: 'Booking deleted' });
  } catch (error) {
    console.error('Delete Booking Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get All Users (Admin)
app.get('/api/admin/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({ success: true, count: users.length, data: users });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Single User (Admin)
app.get('/api/admin/users/:id', protect, adminOnly, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get user's bookings
    const bookings = await Booking.find({ userId: user._id }).populate('carId');
    
    res.json({ success: true, data: { user, bookings } });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update User Role (Admin)
app.put('/api/admin/users/:id/role', protect, adminOnly, [
  param('id').isMongoId(),
  body('role').isIn(['user', 'admin'])
], validate, async (req, res) => {
  try {
    const { role } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, message: 'User role updated', data: user });
  } catch (error) {
    console.error('Update User Role Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete User (Admin)
app.delete('/api/admin/users/:id', protect, adminOnly, param('id').isMongoId(), validate, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Also delete user's bookings and cart
    await Booking.deleteMany({ userId: user._id });
    await Cart.deleteMany({ userId: user._id });
    
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Dashboard Stats (Admin)
app.get('/api/admin/dashboard/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalCars = await Car.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({ status: { $in: ['pending', 'confirmed'] } });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    
    // Calculate total revenue
    const revenueResult = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
    ]);
    
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    
    res.json({
      success: true,
      data: {
        totalCars,
        totalUsers,
        totalBookings,
        activeBookings,
        completedBookings,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Revenue by Date Range (Admin)
app.get('/api/admin/dashboard/revenue', protect, adminOnly, [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], validate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const filter = { status: { $in: ['confirmed', 'completed'] } };
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const revenueResult = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({ success: true, data: revenueResult });
  } catch (error) {
    console.error('Revenue Report Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Popular Cars (Admin)
app.get('/api/admin/dashboard/popular-cars', protect, adminOnly, async (req, res) => {
  try {
    const popularCars = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: '$carId', bookingCount: { $sum: 1 }, totalRevenue: { $sum: '$totalAmount' } } },
      { $sort: { bookingCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'cars',
          localField: '_id',
          foreignField: '_id',
          as: 'carDetails'
        }
      },
      { $unwind: '$carDetails' },
      {
        $project: {
          carName: '$carDetails.name',
          bookingCount: 1,
          totalRevenue: 1
        }
      }
    ]);
    
    res.json({ success: true, data: popularCars });
  } catch (error) {
    console.error('Popular Cars Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get Calendar View (Admin)
app.get('/api/admin/calendar', protect, adminOnly, [
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt()
], validate, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();
    
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
    
    const bookings = await Booking.find({
      status: { $in: ['pending', 'confirmed'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    })
    .populate('userId', 'name email phone')
    .populate('carId')
    .sort({ startDate: 1, startTime: 1 });
    
    res.json({
      success: true,
      month: targetMonth + 1,
      year: targetYear,
      count: bookings.length,
      bookings
    });
  } catch (error) {
    console.error('Calendar Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// SEEDER ROUTE (Dev Only - Remove in Production)
// ============================================

app.post('/api/seed/cars', async (req, res) => {
  try {
    // Clear existing cars
    await Car.deleteMany({});
    
    const cars = [
      { name: "Baleno", price12hrs: 1300, price24hrs: 2300, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "i10", price12hrs: 1150, price24hrs: 1799, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Amaze", price12hrs: 1499, price24hrs: 2499, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Fronx", price12hrs: 1599, price24hrs: 2599, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Venue", price12hrs: 1699, price24hrs: 2699, transmission: "Automatic", fuel: "Petrol", images: [] },
      { name: "City", price12hrs: 1799, price24hrs: 2899, transmission: "Automatic", fuel: "Petrol", images: [] },
      { name: "Verna", price12hrs: 1699, price24hrs: 2699, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Creta", price12hrs: 2299, price24hrs: 3499, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Thar", price12hrs: 2499, price24hrs: 4500, transmission: "Automatic", fuel: "Petrol", images: [] },
      { name: "X16", price12hrs: 1899, price24hrs: 3199, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Ertiga", price12hrs: 1799, price24hrs: 3199, transmission: "Manual", fuel: "Petrol", images: [] },
      { name: "Innova High Cross", price12hrs: 3799, price24hrs: 5999, transmission: "Automatic", fuel: "Petrol", images: [] }
    ];
    
    await Car.insertMany(cars);
    
    res.json({ success: true, message: '12 cars seeded successfully', count: cars.length });
  } catch (error) {
    console.error('Seed Cars Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});
