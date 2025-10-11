# 🚗 Car Rental System - API Documentation

**Version:** 2.0.0  
**Base URL:** `http://localhost:5000`  
**Protocol:** REST  
**Date:** October 11, 2025

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Status Codes](#status-codes)
4. [Error Handling](#error-handling)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Cars](#car-endpoints)
   - [Bookings](#booking-endpoints)
   - [Payments](#payment-endpoints)
   - [Notifications](#notification-endpoints)
   - [Admin](#admin-endpoints)
6. [Postman Collection](#postman-collection)

---

## 📖 Overview

The Car Rental System API provides endpoints for managing car rentals, bookings, payments, and user notifications. This REST API supports both customer and admin operations with JWT-based authentication.

### Key Features
- ✅ User registration & authentication
- ✅ Browse and filter available cars
- ✅ Create bookings with document uploads
- ✅ Razorpay payment integration
- ✅ Admin booking management
- ✅ Real-time notifications
- ✅ Analytics dashboard

---

## 🔐 Authentication

Most endpoints require authentication using JWT (JSON Web Token).

### How to Authenticate

1. **Login or Register** to get a JWT token
2. **Include the token** in the `Authorization` header for all protected endpoints

```
Authorization: Bearer <your-jwt-token>
```

### Token Expiry
- Tokens expire after **30 days**
- After expiry, login again to get a new token

---

## 📊 Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request - Invalid input |
| `401` | Unauthorized - Missing or invalid token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource doesn't exist |
| `500` | Internal Server Error |

---

## ❌ Error Handling

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Example:**
```json
{
  "error": "User already exists"
}
```

---

## 🔌 API Endpoints

---

## Authentication Endpoints

### 1. Register User

**POST** `/api/auth/register`

Register a new user account.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "mobile": "9876543210",
  "role": "customer"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | User's full name |
| email | string | Yes | Valid email address |
| password | string | Yes | Password (min 6 characters) |
| mobile | string | Yes | 10-digit mobile number |
| role | string | No | "customer" or "admin" (default: customer) |

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6507f1234567890abcdef123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  }
}
```

**Possible Errors:**
- `400` - User already exists
- `400` - Missing required fields

---

### 2. Login User

**POST** `/api/auth/login`

Login to get authentication token.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6507f1234567890abcdef123",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  }
}
```

**Possible Errors:**
- `401` - Invalid credentials

---

## Car Endpoints

### 3. Get All Cars

**GET** `/api/cars`

Retrieve list of all cars with optional filters.

**Headers:**
```
(No authentication required)
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | No | Filter by car type: "normal" or "premium" |
| available | boolean | No | Filter by availability: "true" or "false" |

**Example Requests:**
```
GET /api/cars
GET /api/cars?type=premium
GET /api/cars?available=true
GET /api/cars?type=normal&available=true
```

**Response:** `200 OK`
```json
{
  "cars": [
    {
      "_id": "6507f1234567890abcdef456",
      "name": "Toyota Innova",
      "model": "Crysta 2024",
      "type": "normal",
      "pricePerHour": 250,
      "description": "Spacious 7-seater SUV",
      "features": ["AC", "GPS", "Music System"],
      "imageUrl": "https://example.com/innova.jpg",
      "available": true,
      "createdAt": "2025-10-01T10:00:00.000Z"
    },
    {
      "_id": "6507f1234567890abcdef789",
      "name": "BMW 5 Series",
      "model": "2024",
      "type": "premium",
      "pricePerHour": 800,
      "description": "Luxury sedan with driver",
      "features": ["AC", "Leather Seats", "Sunroof", "Driver Included"],
      "imageUrl": "https://example.com/bmw.jpg",
      "available": true,
      "createdAt": "2025-10-02T12:00:00.000Z"
    }
  ]
}
```

---

### 4. Get Single Car

**GET** `/api/cars/:id`

Get details of a specific car.

**Headers:**
```
(No authentication required)
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Car ID |

**Example Request:**
```
GET /api/cars/6507f1234567890abcdef456
```

**Response:** `200 OK`
```json
{
  "car": {
    "_id": "6507f1234567890abcdef456",
    "name": "Toyota Innova",
    "model": "Crysta 2024",
    "type": "normal",
    "pricePerHour": 250,
    "description": "Spacious 7-seater SUV",
    "features": ["AC", "GPS", "Music System"],
    "imageUrl": "https://example.com/innova.jpg",
    "available": true,
    "createdAt": "2025-10-01T10:00:00.000Z"
  }
}
```

**Possible Errors:**
- `404` - Car not found

---

### 5. Add Car (Admin Only)

**POST** `/api/cars`

Add a new car to the system.

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Toyota Innova",
  "model": "Crysta 2024",
  "type": "normal",
  "pricePerHour": 250,
  "description": "Spacious 7-seater SUV",
  "features": ["AC", "GPS", "Music System"],
  "imageUrl": "https://example.com/innova.jpg"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Car name |
| model | string | Yes | Car model |
| type | string | Yes | "normal" or "premium" |
| pricePerHour | number | Yes | Hourly rental price |
| description | string | No | Car description |
| features | array | No | Array of features |
| imageUrl | string | No | Car image URL |

**Response:** `201 Created`
```json
{
  "message": "Car added successfully",
  "car": {
    "_id": "6507f1234567890abcdef456",
    "name": "Toyota Innova",
    "model": "Crysta 2024",
    "type": "normal",
    "pricePerHour": 250,
    "available": true
  }
}
```

**Possible Errors:**
- `401` - Unauthorized
- `403` - Admin access required

---

### 6. Update Car (Admin Only)

**PUT** `/api/cars/:id`

Update car details.

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:** (All fields optional, send only what needs to be updated)
```json
{
  "pricePerHour": 300,
  "available": false
}
```

**Response:** `200 OK`
```json
{
  "message": "Car updated successfully",
  "car": { ... }
}
```

---

### 7. Delete Car (Admin Only)

**DELETE** `/api/cars/:id`

Delete a car from the system.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:** `200 OK`
```json
{
  "message": "Car deleted successfully"
}
```

---

## Booking Endpoints

### 8. Create Booking

**POST** `/api/bookings`

Create a new booking with document uploads.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
```
carId: 6507f1234567890abcdef456
startTime: 2025-10-15T10:00:00.000Z
duration: 24
fullName: John Doe
guardianName: Robert Doe
guardianRelation: S/o
residentialAddress: 123 Main St, Bangalore
email: john@example.com
mobile: 9876543210
occupation: Software Engineer
reference1Name: Jane Smith
reference1Mobile: 9876543211
reference2Name: Mike Johnson
reference2Mobile: 9876543212
drivingLicenseNumber: KA01234567890
licenseExpiryDate: 2028-12-31
depositType: online
homeDelivery: true
deliveryAddress: 123 Main St, Bangalore
deliveryDistance: 3
drivingLicense: <file>
aadharCard: <file>
livePhoto: <file>
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| carId | string | Yes | Car ID |
| startTime | datetime | Yes | ISO 8601 format |
| duration | number | Yes | Hours (must be multiple of 12) |
| fullName | string | Yes | Customer's full name |
| guardianName | string | Yes | Father/Spouse/Guardian name |
| guardianRelation | string | Yes | "S/o", "W/o", or "D/o" |
| residentialAddress | string | Yes | Full address |
| email | string | Yes | Email address |
| mobile | string | Yes | 10-digit mobile |
| occupation | string | Yes | Occupation |
| reference1Name | string | Yes | First reference name |
| reference1Mobile | string | Yes | First reference mobile |
| reference2Name | string | Yes | Second reference name |
| reference2Mobile | string | Yes | Second reference mobile |
| drivingLicenseNumber | string | Yes | DL number |
| licenseExpiryDate | date | Yes | DL expiry date |
| depositType | string | Yes | "bike", "cash", or "online" |
| bikeDetails | string | No | Required if depositType is "bike" |
| homeDelivery | boolean | No | true or false |
| deliveryAddress | string | No | Required if homeDelivery is true |
| deliveryDistance | number | No | Distance in km |
| drivingLicense | file | Yes | DL image (jpg/png/pdf, max 5MB) |
| aadharCard | file | Yes | Aadhar image (jpg/png/pdf, max 5MB) |
| livePhoto | file | Yes | Selfie (jpg/png, max 5MB) |

**Response:** `201 Created`
```json
{
  "message": "Booking submitted successfully. Waiting for admin approval.",
  "booking": {
    "_id": "6507f1234567890abcdef999",
    "customerId": "6507f1234567890abcdef123",
    "carId": "6507f1234567890abcdef456",
    "startTime": "2025-10-15T10:00:00.000Z",
    "endTime": "2025-10-16T10:00:00.000Z",
    "duration": 24,
    "fullName": "John Doe",
    "depositAmount": 25000,
    "basePrice": 6000,
    "totalPrice": 6500,
    "status": "pending",
    "createdAt": "2025-10-11T11:00:00.000Z"
  }
}
```

**Possible Errors:**
- `400` - Duration must be multiple of 12 hours
- `400` - Car not available
- `400` - Missing required documents
- `404` - Car not found

---

### 9. Get My Bookings

**GET** `/api/bookings/my-bookings`

Get all bookings for the logged-in customer.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "bookings": [
    {
      "_id": "6507f1234567890abcdef999",
      "customerId": "6507f1234567890abcdef123",
      "carId": {
        "_id": "6507f1234567890abcdef456",
        "name": "Toyota Innova",
        "model": "Crysta 2024",
        "type": "normal",
        "imageUrl": "https://example.com/innova.jpg"
      },
      "startTime": "2025-10-15T10:00:00.000Z",
      "endTime": "2025-10-16T10:00:00.000Z",
      "duration": 24,
      "status": "pending",
      "totalPrice": 6500,
      "createdAt": "2025-10-11T11:00:00.000Z"
    }
  ]
}
```

---

### 10. Get Single Booking

**GET** `/api/bookings/:id`

Get details of a specific booking.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "booking": {
    "_id": "6507f1234567890abcdef999",
    "customerId": {
      "_id": "6507f1234567890abcdef123",
      "name": "John Doe",
      "email": "john@example.com",
      "mobile": "9876543210"
    },
    "carId": {
      "_id": "6507f1234567890abcdef456",
      "name": "Toyota Innova",
      "model": "Crysta 2024",
      "type": "normal"
    },
    "startTime": "2025-10-15T10:00:00.000Z",
    "endTime": "2025-10-16T10:00:00.000Z",
    "duration": 24,
    "fullName": "John Doe",
    "mobile": "9876543210",
    "drivingLicenseImage": "uploads/drivingLicense-1234567890.jpg",
    "status": "pending",
    "totalPrice": 6500
  }
}
```

**Possible Errors:**
- `403` - Access denied (not your booking)
- `404` - Booking not found

---

### 11. Get All Bookings (Admin Only)

**GET** `/api/bookings`

Get all bookings with optional status filter.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: "pending", "accepted", "declined", "payment_pending", "paid", "active", "completed" |

**Example:**
```
GET /api/bookings?status=pending
```

**Response:** `200 OK`
```json
{
  "bookings": [
    {
      "_id": "6507f1234567890abcdef999",
      "customerId": {
        "name": "John Doe",
        "email": "john@example.com",
        "mobile": "9876543210"
      },
      "carId": {
        "name": "Toyota Innova",
        "model": "Crysta 2024",
        "type": "normal"
      },
      "startTime": "2025-10-15T10:00:00.000Z",
      "status": "pending",
      "totalPrice": 6500
    }
  ]
}
```

---

### 12. Accept/Decline Booking (Admin Only)

**PUT** `/api/bookings/:id/review`

Accept or decline a pending booking.

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "accept",
  "adminNotes": "All documents verified"
}
```

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| action | string | Yes | "accept" or "decline" |
| adminNotes | string | No | Admin comments |

**Response:** `200 OK`
```json
{
  "message": "Booking accepted. Customer can now proceed with payment.",
  "booking": {
    "_id": "6507f1234567890abcdef999",
    "status": "payment_pending"
  }
}
```

**Possible Errors:**
- `400` - Booking already reviewed
- `403` - Admin access required
- `404` - Booking not found

---

### 13. Start Rental (Admin Only)

**PUT** `/api/bookings/:id/start`

Mark booking as active when car is handed over.

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicleName": "Toyota Innova KA01AB1234",
  "vehicleNumber": "KA01AB1234",
  "startOdometer": 45000
}
```

**Response:** `200 OK`
```json
{
  "message": "Booking marked as active",
  "booking": {
    "_id": "6507f1234567890abcdef999",
    "status": "active",
    "depositStatus": "received"
  }
}
```

---

### 14. Complete Rental (Admin Only)

**PUT** `/api/bookings/:id/complete`

Complete booking and calculate late fees if applicable.

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "endOdometer": 45500,
  "actualReturnTime": "2025-10-16T12:00:00.000Z"
}
```

**Response:** `200 OK`
```json
{
  "message": "Booking completed successfully",
  "booking": {
    "_id": "6507f1234567890abcdef999",
    "status": "completed",
    "depositStatus": "refunded",
    "totalPrice": 6700
  },
  "lateFee": 200,
  "lateHours": 2
}
```

---

## Payment Endpoints

### 15. Create Razorpay Order

**POST** `/api/payment/create-order`

Create a Razorpay order for payment.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "bookingId": "6507f1234567890abcdef999"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "order": {
    "id": "order_MXj8YZ1234567890",
    "entity": "order",
    "amount": 650000,
    "currency": "INR",
    "receipt": "booking_6507f1234567890abcdef999",
    "status": "created"
  },
  "bookingDetails": {
    "amount": 6500,
    "carName": "Toyota Innova",
    "duration": 24,
    "depositAmount": 25000
  },
  "razorpayKeyId": "rzp_test_xxxxxxxxxxxxx"
}
```

**Frontend Integration:**
```javascript
// Use this order data to open Razorpay checkout
const options = {
  key: response.razorpayKeyId,
  amount: response.order.amount,
  currency: response.order.currency,
  order_id: response.order.id,
  handler: function(paymentResponse) {
    // Verify payment with backend
    verifyPayment(paymentResponse);
  }
};
const rzp = new Razorpay(options);
rzp.open();
```

**Possible Errors:**
- `400` - Booking not in payment_pending status
- `403` - Access denied
- `404` - Booking not found

---

### 16. Verify Payment

**POST** `/api/payment/verify`

Verify Razorpay payment signature.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "razorpay_order_id": "order_MXj8YZ1234567890",
  "razorpay_payment_id": "pay_MXj8YZ1234567890",
  "razorpay_signature": "abc123def456...",
  "bookingId": "6507f1234567890abcdef999"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Payment verified successfully!",
  "booking": {
    "_id": "6507f1234567890abcdef999",
    "status": "paid",
    "paymentStatus": "completed",
    "razorpayPaymentId": "pay_MXj8YZ1234567890"
  }
}
```

**Possible Errors:**
- `400` - Invalid signature (payment verification failed)
- `404` - Booking not found

---

### 17. Get Payment Details

**GET** `/api/payment/:paymentId`

Get details of a specific payment.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "success": true,
  "payment": {
    "id": "pay_MXj8YZ1234567890",
    "amount": 650000,
    "currency": "INR",
    "status": "captured",
    "method": "card",
    "created_at": 1696924800
  }
}
```

---

### 18. Refund Payment (Admin Only)

**POST** `/api/payment/refund`

Initiate a refund for cancelled bookings.

**Headers:**
```
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "paymentId": "pay_MXj8YZ1234567890",
  "amount": 6500
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Refund initiated successfully",
  "refund": {
    "id": "rfnd_MXj8YZ1234567890",
    "amount": 650000,
    "status": "processed"
  }
}
```

---

## Notification Endpoints

### 19. Get Notifications

**GET** `/api/notifications`

Get all notifications for logged-in user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "_id": "6507f1234567890abcdef111",
      "userId": "6507f1234567890abcdef123",
      "bookingId": "6507f1234567890abcdef999",
      "message": "Your booking for Toyota Innova has been accepted!",
      "type": "booking_update",
      "read": false,
      "createdAt": "2025-10-11T12:00:00.000Z"
    }
  ]
}
```

---

### 20. Mark Notification as Read

**PUT** `/api/notifications/:id/read`

Mark a notification as read.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Notification marked as read",
  "notification": {
    "_id": "6507f1234567890abcdef111",
    "read": true
  }
}
```

---

## Admin Endpoints

### 21. Get Dashboard Stats

**GET** `/api/admin/stats`

Get overall system statistics.

**Headers:**
```
Authorization: Bearer <admin-token>
```

**Response:** `200 OK`
```json
{
  "stats": {
    "totalCars": 25,
    "availableCars": 18,
    "totalBookings": 150,
    "activeBookings": 12,
    "pendingBookings": 5,
    "completedBookings": 120,
    "totalRevenue": 450000
  }
}
```

---

## 📮 Postman Collection

### Import this JSON into Postman:

```json
{
  "info": {
    "name": "Car Rental System API",
    "description": "Complete API collection for Car Rental System",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "url": "{{baseUrl}}/api/auth/register",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"John Doe\",\n  \"email\": \"john@example.com\",\n  \"password\": \"password123\",\n  \"mobile\": \"9876543210\"\n}"
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "url": "{{baseUrl}}/api/auth/login",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"john@example.com\",\n  \"password\": \"password123\"\n}"
            }
          }
        }
      ]
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5000"
    },
    {
      "key": "token",
      "value": ""
    }
  ]
}
```

### Environment Variables:
```
baseUrl = http://localhost:5000
token = <paste-your-jwt-token-after-login>
```

---

## 🔄 Booking Status Flow

```
PENDING → ACCEPTED → PAYMENT_PENDING → PAID → ACTIVE → COMPLETED
                ↓
            DECLINED
```

---

## 💳 Deposit Rules

| Car Type | Deposit Amount |
|----------|----------------|
| Normal | ₹25,000 |
| Premium | ₹35,000 |

**Deposit Options:** Bike, Cash, or Online

---

## 📦 Additional Charges

| Service | Condition | Charge |
|---------|-----------|--------|
| Home Delivery | Within 5km | ₹500 |
| Late Return | Per hour | ₹100 (configurable) |
| Premium Driver | Included | Free with premium cars |

---

## 🧪 Testing Guide

### 1. Register & Login
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123",
    "mobile": "9876543210"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

### 2. Browse Cars
```bash
curl http://localhost:5000/api/cars
```

### 3. Create Booking (Use Postman for file uploads)
```bash
# Use Postman with multipart/form-data
```

### 4. Test Payment (Use Razorpay test credentials)
- Card: 4111 1111 1111 1111
- UPI: success@razorpay

---

## 📝 Notes

- All dates should be in **ISO 8601 format** (e.g., `2025-10-15T10:00:00.000Z`)
- Duration must be in **multiples of 12 hours** (12, 24, 36, 48...)
- File uploads limited to **5MB**
- Supported file types: **jpg, jpeg, png, pdf**
- Token expires in **30 days**

---

**Last Updated:** October 11, 2025
