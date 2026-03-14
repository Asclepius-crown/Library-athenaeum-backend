import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const auditLogSchema = new Schema({
  action: { type: String, required: true }, // e.g., 'CREATE_BOOK', 'DELETE_STUDENT', 'UPDATE_FINE'
  user: { type: String, required: true }, // Name or ID of the admin/user
  details: { type: Schema.Types.Mixed }, // Any additional info
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

export default model('AuditLog', auditLogSchema);
