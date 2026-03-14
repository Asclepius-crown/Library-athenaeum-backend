import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import config from '../config.js';

dotenv.config();

const promoteToAdmin = async () => {
  const email = process.argv[2]; // Get email from command line arg

  if (!email) {
    console.log("Usage: node scripts/setAdmin.js <email>");
    process.exit(1);
  }

  try {
    await mongoose.connect(config.MONGO_URI);
    console.log("Connected to MongoDB...");

    // 1. Fix missing roles for ALL users (set to 'student')
    const updateResult = await User.updateMany(
      { role: { $exists: false } },
      { $set: { role: 'student' } }
    );
    console.log(`Updated ${updateResult.modifiedCount} users with missing roles to 'student'.`);

    // 2. Promote specific user to 'admin'
    const user = await User.findOneAndUpdate(
      { email: email },
      { $set: { role: 'admin' } },
      { new: true }
    );

    if (user) {
      console.log(`✅ SUCCESS: User '${user.name}' (${user.email}) is now an ADMIN.`);
    } else {
      console.log(`❌ ERROR: User with email '${email}' not found.`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};

promoteToAdmin();
