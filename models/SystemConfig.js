import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main_config' },
  examPeriods: [{
    name: String,
    startDate: Date,
    endDate: Date
  }],
  // We can add other global settings here later
}, { timestamps: true });

export default mongoose.model('SystemConfig', systemConfigSchema);
