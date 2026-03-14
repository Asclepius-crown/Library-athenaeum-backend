import AuditLog from '../models/AuditLog.js';

export const logAudit = (action) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      res.json = originalJson;
      
      // Log after response is sent
      const auditEntry = new AuditLog({
        action,
        user: req.user ? req.user.email : 'Unknown',
        details: {
          method: req.method,
          url: req.originalUrl,
          body: req.body,
          params: req.params,
          statusCode: res.statusCode
        }
      });
      auditEntry.save().catch(err => console.error('Audit log failed', err));
      
      return res.json(data);
    };
    next();
  };
};
