#!/bin/bash

echo "🔍 MongoDB DNS Troubleshooting Script"
echo "======================================"
echo ""

# Test internet connectivity
echo "1️⃣  Testing internet connectivity..."
if ping -c 2 8.8.8.8 > /dev/null 2>&1; then
    echo "   ✅ Internet connection is working"
else
    echo "   ❌ No internet connection detected"
    echo "   💡 Please check your network connection"
    exit 1
fi

# Test DNS resolution
echo ""
echo "2️⃣  Testing DNS resolution for MongoDB Atlas..."
if nslookup cluster0.szfsqa9.mongodb.net > /dev/null 2>&1; then
    echo "   ✅ DNS resolution is working"
else
    echo "   ❌ DNS resolution failed"
    echo "   💡 Trying alternative DNS servers..."
    
    # Show current DNS
    echo ""
    echo "   Current DNS configuration:"
    cat /etc/resolv.conf | grep nameserver
    
    echo ""
    echo "   📝 Suggested fixes:"
    echo ""
    echo "   Option 1: Temporarily use Google DNS"
    echo "   ---------------------------------"
    echo "   sudo bash -c 'echo \"nameserver 8.8.8.8\" > /etc/resolv.conf'"
    echo "   sudo bash -c 'echo \"nameserver 8.8.4.4\" >> /etc/resolv.conf'"
    echo ""
    echo "   Option 2: Use Cloudflare DNS"
    echo "   ---------------------------"
    echo "   sudo bash -c 'echo \"nameserver 1.1.1.1\" > /etc/resolv.conf'"
    echo "   sudo bash -c 'echo \"nameserver 1.0.0.1\" >> /etc/resolv.conf'"
    echo ""
    echo "   Option 3: Restart network service"
    echo "   -------------------------------"
    echo "   sudo systemctl restart NetworkManager"
    echo ""
fi

# Check if connected to VPN
echo ""
echo "3️⃣  Checking VPN connection..."
if ip addr | grep -q "tun\|tap"; then
    echo "   ⚠️  VPN connection detected"
    echo "   💡 Try disconnecting VPN if MongoDB connection fails"
else
    echo "   ✅ No VPN detected"
fi

# Check firewall
echo ""
echo "4️⃣  Checking firewall status..."
if command -v ufw > /dev/null 2>&1; then
    if sudo ufw status | grep -q "Status: active"; then
        echo "   ⚠️  UFW firewall is active"
        echo "   💡 Make sure outbound connections to MongoDB are allowed"
    else
        echo "   ✅ UFW firewall is inactive"
    fi
else
    echo "   ℹ️  UFW not installed"
fi

echo ""
echo "5️⃣  Testing MongoDB Atlas connectivity..."
if nc -zv cluster0.szfsqa9.mongodb.net 27017 2>&1 | grep -q "succeeded\|open"; then
    echo "   ✅ MongoDB Atlas is reachable"
else
    echo "   ❌ Cannot reach MongoDB Atlas"
    echo "   💡 This could be due to:"
    echo "      - Firewall blocking port 27017"
    echo "      - Network restrictions"
    echo "      - MongoDB Atlas network settings"
fi

echo ""
echo "======================================"
echo "🎯 Quick Fixes (run these commands):"
echo "======================================"
echo ""
echo "1. Change DNS to Google DNS:"
echo "   sudo bash -c 'echo \"nameserver 8.8.8.8\" > /etc/resolv.conf'"
echo ""
echo "2. Restart your application:"
echo "   npm start"
echo ""
echo "3. If still not working, whitelist your IP in MongoDB Atlas:"
echo "   - Go to: https://cloud.mongodb.com"
echo "   - Navigate to: Network Access"
echo "   - Add your current IP or use 0.0.0.0/0 (allow all)"
echo ""

