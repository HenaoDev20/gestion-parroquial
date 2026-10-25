import { AppError } from '../errors/AppError.js';
// SOLO DEMO LOCAL: sustituir por autenticación verificable antes de publicar.
export function demoAuth(req, res, next) {
  if (process.env.NODE_ENV === 'production') return next(new AppError('Autenticación de producción no implementada', 503, 'AUTH_NOT_CONFIGURED'));
  const role = req.get('x-demo-role') ?? 'feligrés';
  if (!['feligrés','secretaria','parroco'].includes(role)) return next(new AppError('Rol de prueba inválido', 401));
  req.user = { role, parroquiaId: 1 };
  next();
}
export function requireRole(...roles) {
  return (req,res,next) => roles.includes(req.user?.role) ? next() : next(new AppError('Acceso denegado',403,'FORBIDDEN'));
}
