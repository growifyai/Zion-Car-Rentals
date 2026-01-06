# 📧 Email Notification Setup Guide

This guide will help you set up email notifications for new bookings from the customer portal.

## 🎯 Overview

When a customer creates a new booking through the customer portal (after completing advance payment), an automated email notification will be sent to the admin's email address with all booking details.

## 🆓 Free Email Service

We're using **Nodemailer with Gmail SMTP** - completely free and reliable!

---

## 📋 Step-by-Step Setup

### Step 1: Enable 2-Factor Authentication on Gmail

1. Go to your Google Account: https://myaccount.google.com/
2. Click on **Security** in the left sidebar
3. Under "How you sign in to Google", click on **2-Step Verification**
4. Follow the steps to enable 2-Step Verification

### Step 2: Generate App Password

1. After enabling 2-Step Verification, go back to **Security**
2. Under "How you sign in to Google", click on **App passwords**
   - If you don't see this option, make sure 2-Step Verification is enabled
3. In the "Select app" dropdown, choose **Mail**
4. In the "Select device" dropdown, choose **Other (Custom name)**
5. Enter a name like "Car Rental Booking System"
6. Click **Generate**
7. Google will show you a 16-character password (like: `abcd efgh ijkl mnop`)
8. **Copy this password** - you'll need it for the .env file
9. Click **Done**

### Step 3: Update .env File

Open your `.env` file in the `Zion-Car-Rentals` folder and add these three lines:

```env
# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
ADMIN_EMAIL=admin-email@gmail.com
```

**Replace with your actual values:**
- `EMAIL_USER`: Your Gmail address (the one you generated the app password for)
- `EMAIL_APP_PASSWORD`: The 16-character app password (remove spaces)
- `ADMIN_EMAIL`: The email address where you want to receive booking notifications (can be same as EMAIL_USER or different)

**Example:**
```env
EMAIL_USER=zioncarrentals@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
ADMIN_EMAIL=admin@zioncarrentals.com
```

### Step 4: Restart Your Server

After updating the .env file, restart your Node.js server:

```bash
# Stop the current server (Ctrl+C)
# Then start it again:
npm start
# or
npm run dev
```

You should see this message in the console:
```
✅ Email service initialized successfully
```

---

## ✅ Testing the Email Notifications

1. Go to the customer portal
2. Select a car and create a booking
3. Complete the advance payment
4. Check the admin email inbox - you should receive an email with:
   - Booking ID
   - Customer details (name, mobile, email)
   - Car details
   - Start and end time
   - Total price

---

## 📧 Email Template Preview

The admin will receive a professionally formatted HTML email with:

- **Subject:** 🚗 New Booking Alert - [Car Name]
- **Green header** with booking alert
- **Organized sections** with customer info, car details, and pricing
- **Action reminder** for admin to review the booking

---

## 🔧 Troubleshooting

### Issue: "Email service not configured" message

**Solution:** Make sure all three environment variables are set in .env:
- EMAIL_USER
- EMAIL_APP_PASSWORD
- ADMIN_EMAIL

### Issue: Email not sending

**Possible causes:**
1. **Incorrect app password** - Make sure you copied it correctly (remove spaces)
2. **2-Step Verification not enabled** - You must enable this first
3. **Using regular password** - You MUST use the app password, not your Gmail password
4. **Gmail security blocked** - Check your Gmail security settings

### Issue: "Invalid login" error

**Solution:** 
1. Make sure you're using the **app password**, not your regular Gmail password
2. Verify that 2-Step Verification is enabled
3. Generate a new app password and try again

### Issue: Email goes to spam

**Solution:**
1. Check your spam/junk folder
2. Mark the email as "Not Spam"
3. Add the sender email to your contacts

---

## 🎨 Customizing the Email Template

To customize the email template, edit the `sendNewBookingEmail` function in `server.js`:

```javascript
// Find this function around line 80-120
const sendNewBookingEmail = async (bookingDetails) => {
  // Modify the HTML template here
  const mailOptions = {
    subject: `🚗 New Booking Alert - ${carName}`, // Change subject
    html: `...` // Modify HTML content
  };
};
```

---

## 🔐 Security Best Practices

1. ✅ **Never commit .env file** to version control
2. ✅ **Use app passwords**, not regular passwords
3. ✅ **Keep app passwords secure**
4. ✅ **Revoke unused app passwords** from Google Account settings
5. ✅ **Use different emails** for sending (EMAIL_USER) and receiving (ADMIN_EMAIL) if possible

---

## 📊 Email Sending Status

The email sending process is **non-blocking**, meaning:
- If email fails, the booking will still be created successfully
- Errors are logged to the console but don't break the booking flow
- This ensures customer experience is not affected by email issues

---

## 🆘 Need Help?

If you encounter issues:
1. Check the server console for error messages
2. Verify all environment variables are set correctly
3. Test with a simple email first
4. Check Gmail security settings and app passwords

---

## 📝 Additional Notes

- **Free tier limit:** Gmail allows ~500 emails per day
- **No cost:** Completely free for small to medium operations
- **Reliable:** Gmail SMTP is highly reliable
- **Professional:** HTML-formatted emails look professional
- **Automatic:** No manual intervention needed

---

## 🎉 Success Checklist

- [ ] 2-Step Verification enabled on Gmail
- [ ] App password generated
- [ ] .env file updated with all three variables
- [ ] Server restarted
- [ ] Test booking created
- [ ] Email received in admin inbox
- [ ] Email looks professional and contains all details

---

## 📧 Sample .env Configuration

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/car-rental?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxx

# Email Configuration (ADD THESE LINES)
EMAIL_USER=zioncarrentals@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
ADMIN_EMAIL=admin@zioncarrentals.com
```

---

That's it! Your email notification system is now set up and ready to alert you of new bookings! 🎉
