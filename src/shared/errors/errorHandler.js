import { AppError } from './AppError.js';
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (!(err instanceof AppError)) console.error(err);
  const status = err instanceof AppError ? err.status : 500;
  res.status(status).json({ success: false, data: null,
    message: err instanceof AppError ? err.message : 'Error interno del servidor',
    errors: [{ code: err instanceof AppError ? err.code : 'INTERNAL_ERROR' }] });
}
