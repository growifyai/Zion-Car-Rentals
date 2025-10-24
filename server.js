const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/car-rental';

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_ID',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_KEY_SECRET'
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads', { recursive: true });
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

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
  driverAvailable: { type: Boolean, default: false },
  driverChargesPerDay: { type: Number, default: 0 },
  
  description: String,
  features: [String],
  imageUrl: String,
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

  reference1Name: { type: String, required: true },
  reference1Mobile: { type: String, required: true },
  reference2Name: { type: String, required: true },
  reference2Mobile: { type: String, required: true },

  drivingLicenseNumber: { type: String, required: true },
  licenseExpiryDate: { type: Date, required: true },

  drivingLicenseImage: { type: String, required: true },
  aadharCardImage: { type: String, required: true },
  livePhoto: { type: String, required: true },

  depositType: { type: String, enum: ['bike', 'cash', 'online'], required: true },
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
    enum: ['pending', 'accepted', 'declined', 'payment_pending', 'paid', 'active', 'completed', 'cancelled'],
    default: 'pending'
  },
  adminNotes: String,

  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  paymentDate: Date,

  actualReturnTime: Date,
  lateHours: { type: Number, default: 0 },

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

const User = mongoose.model('User', userSchema);
const Car = mongoose.model('Car', carSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const Notification = mongoose.model('Notification', notificationSchema);

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

app.get('/api/cars', async (req, res) => {
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
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cars/:id', async (req, res) => {
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

app.post('/api/cars', authenticate, isAdmin, async (req, res) => {
  try {
    const { 
      carName, model, brand, year, type, gearType, fuelType, seatingCapacity,
      pricing, securityDeposit, driverAvailable, driverChargesPerDay,
      description, features, imageUrl, registrationNumber
    } = req.body;

    if (!pricing || !pricing.price12hr || !pricing.price24hr || !pricing.price36hr || 
        !pricing.price48hr || !pricing.price60hr || !pricing.price72hr) {
      return res.status(400).json({ error: 'All pricing tiers (12hr, 24hr, 36hr, 48hr, 60hr, 72hr) are required' });
    }

    const car = new Car({ 
      carName, model, brand, year, type, gearType, fuelType, seatingCapacity,
      pricing, securityDeposit, driverAvailable, driverChargesPerDay,
      description, features, imageUrl, registrationNumber
    });
    
    await car.save();
    res.status(201).json({ message: 'Car added successfully', car });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cars/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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

app.post('/api/bookings', 
  authenticate,
  upload.fields([
    { name: 'drivingLicense', maxCount: 1 },
    { name: 'aadharCard', maxCount: 1 },
    { name: 'livePhoto', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        carId, startTime, duration, fullName, guardianName, guardianRelation,
        residentialAddress, email, mobile, occupation,
        reference1Name, reference1Mobile, reference2Name, reference2Mobile,
        drivingLicenseNumber, licenseExpiryDate,
        depositType, bikeDetails, withDriver, homeDelivery, deliveryAddress, deliveryDistance
      } = req.body;

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

      if (withDriver === 'true' && !car.driverAvailable) {
        return res.status(400).json({ error: 'Driver service not available for this car' });
      }

      if (!req.files.drivingLicense || !req.files.aadharCard || !req.files.livePhoto) {
        return res.status(400).json({ error: 'All documents (Driving License, Aadhar, Live Photo) are required' });
      }

      const start = new Date(startTime);
      const end = new Date(start.getTime() + (duration * 60 * 60 * 1000));
      const depositAmount = car.securityDeposit;
      
      const deliveryFee = (homeDelivery === 'true' && deliveryDistance <= 5) ? 500 : 0;
      const totalPrice = calculateTotalPrice(car, parseInt(duration), withDriver === 'true', homeDelivery === 'true', parseFloat(deliveryDistance || 0));
      
      const { basePrice, driverCharges } = calculatePriceByDuration(car, parseInt(duration), withDriver === 'true');

      const booking = new Booking({
        customerId: req.userId,
        carId,
        startTime: start,
        duration: parseInt(duration),
        endTime: end,
        fullName, guardianName, guardianRelation, residentialAddress, email, mobile, occupation,
        reference1Name, reference1Mobile, reference2Name, reference2Mobile,
        drivingLicenseNumber,
        licenseExpiryDate: new Date(licenseExpiryDate),
        drivingLicenseImage: req.files.drivingLicense[0].path,
        aadharCardImage: req.files.aadharCard[0].path,
        livePhoto: req.files.livePhoto[0].path,
        depositType,
        bikeDetails: depositType === 'bike' ? bikeDetails : null,
        depositAmount,
        withDriver: withDriver === 'true',
        driverCharges,
        homeDelivery: homeDelivery === 'true',
        deliveryAddress: homeDelivery === 'true' ? deliveryAddress : null,
        deliveryDistance: homeDelivery === 'true' ? parseFloat(deliveryDistance) : 0,
        deliveryFee,
        basePrice,
        totalPrice,
        status: 'pending'
      });

      await booking.save();

      await createNotification(
        req.userId,
        `New booking request submitted for ${car.carName}`,
        booking._id,
        'booking_update'
      );

      res.status(201).json({
        message: 'Booking submitted successfully. Waiting for admin approval.',
        booking
      });
    } catch (error) {
      console.error('Booking error:', error);
      res.status(500).json({ error: error.message });
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

app.put('/api/bookings/:id/review', authenticate, isAdmin, async (req, res) => {
  try {
    const { action, adminNotes } = req.body;

    const booking = await Booking.findById(req.params.id).populate('carId');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ error: 'Booking has already been reviewed' });
    }

    if (action === 'accept') {
      booking.status = 'payment_pending';
      booking.adminNotes = adminNotes;

      await createNotification(
        booking.customerId,
        `Your booking for ${booking.carId.carName} has been accepted! Please proceed with payment.`,
        booking._id,
        'booking_update'
      );

      await booking.save();
      res.json({ message: 'Booking accepted. Customer can now proceed with payment.', booking });

    } else if (action === 'decline') {
      booking.status = 'declined';
      booking.adminNotes = adminNotes;

      await Car.findByIdAndUpdate(booking.carId, { available: true });

      await createNotification(
        booking.customerId,
        `Your booking for ${booking.carId.carName} has been declined. Reason: ${adminNotes}`,
        booking._id,
        'booking_update'
      );

      await booking.save();
      res.json({ message: 'Booking declined', booking });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "accept" or "decline"' });
    }
  } catch (error) {
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

    if (booking.status !== 'paid') {
      return res.status(400).json({ error: 'Payment must be completed first' });
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

app.post('/api/payment/create-order', authenticate, async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId).populate('carId');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.customerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (booking.status !== 'payment_pending') {
      return res.status(400).json({ error: 'Booking must be accepted by admin before payment' });
    }

    const options = {
      amount: booking.totalPrice * 100,
      currency: 'INR',
      receipt: `booking_${bookingId}`,
      notes: {
        bookingId: bookingId.toString(),
        customerId: req.userId.toString(),
        carName: booking.carId.carName,
        duration: booking.duration,
        depositAmount: booking.depositAmount
      }
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    booking.razorpayOrderId = razorpayOrder.id;
    booking.updatedAt = Date.now();
    await booking.save();

    res.json({
      success: true,
      order: razorpayOrder,
      bookingDetails: {
        amount: booking.totalPrice,
        carName: booking.carId.carName,
        duration: booking.duration,
        depositAmount: booking.depositAmount
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment/verify', authenticate, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({ success: false, error: 'Payment verification failed - Invalid signature' });
    }

    const booking = await Booking.findById(bookingId).populate('carId');
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    booking.status = 'paid';
    booking.paymentStatus = 'completed';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpayOrderId = razorpay_order_id;
    booking.razorpaySignature = razorpay_signature;
    booking.paymentDate = new Date();
    booking.updatedAt = Date.now();

    await booking.save();
    await Car.findByIdAndUpdate(booking.carId, { available: false });

    await createNotification(
      booking.customerId,
      `Payment successful! ₹${booking.totalPrice} paid for ${booking.carId.carName}. Booking confirmed!`,
      booking._id,
      'payment'
    );

    res.json({ success: true, message: 'Payment verified successfully!', booking });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;

    console.log('Webhook Event:', event);

    switch (event) {
      case 'payment.authorized':
        const bookingId = paymentEntity.notes.bookingId;
        const booking = await Booking.findById(bookingId).populate('carId');
        if (booking) {
          booking.status = 'paid';
          booking.paymentStatus = 'completed';
          booking.razorpayPaymentId = paymentEntity.id;
          booking.paymentDate = new Date();
          await booking.save();
          await Car.findByIdAndUpdate(booking.carId, { available: false });
          await createNotification(
            booking.customerId,
            `Payment of ₹${paymentEntity.amount / 100} confirmed for ${booking.carId.carName}!`,
            booking._id,
            'payment'
          );
        }
        break;

      case 'payment.failed':
        const failedBookingId = paymentEntity.notes.bookingId;
        const failedBooking = await Booking.findById(failedBookingId).populate('carId');
        if (failedBooking) {
          failedBooking.paymentStatus = 'failed';
          await failedBooking.save();
          await createNotification(
            failedBooking.customerId,
            `Payment failed for ${failedBooking.carId.carName}. Please try again.`,
            failedBooking._id,
            'payment'
          );
        }
        break;

      default:
        console.log('Unhandled webhook event:', event);
    }

    res.json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payment/:paymentId', authenticate, async (req, res) => {
  try {
    const payment = await razorpayInstance.payments.fetch(req.params.paymentId);
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payment/refund', authenticate, isAdmin, async (req, res) => {
  try {
    const { paymentId, amount } = req.body;

    const refund = await razorpayInstance.payments.refund(paymentId, {
      amount: amount * 100,
      speed: 'normal'
    });

    res.json({ success: true, message: 'Refund initiated successfully', refund });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get('/', (req, res) => {
  res.json({
    message: '🚗 Car Rental System API with Razorpay',
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
      payment: [
        'POST /api/payment/create-order',
        'POST /api/payment/verify',
        'POST /api/payment/webhook',
        'GET /api/payment/:paymentId',
        'POST /api/payment/refund'
      ],
      notifications: [
        'GET /api/notifications',
        'PUT /api/notifications/:id/read'
      ],
      admin: [
        'GET /api/admin/stats'
      ]
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚗 CAR RENTAL SYSTEM RUNNING ON PORT ${PORT}`);
  console.log(`MongoDB: ${MONGODB_URI}`);
  console.log(`Razorpay: ${process.env.RAZORPAY_KEY_ID ? '✅ Configured' : '❌ Not Configured'}`);
});

module.exports = app;
