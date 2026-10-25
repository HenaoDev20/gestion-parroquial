import crypto from 'node:crypto';
import { AppError } from '../errors/AppError.js';
const COOKIE = 'parroquia_session';
function secret() {
 const value=process.env.SESSION_SECRET;
 if (!value || value.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres aleatorios');
 return value;
}
function sign(part) {return crypto.createHmac('sha256',secret()).update(part).digest('base64url');}
export function createSession(user) {
 const data={id:Number(user.id),parroquiaId:Number(user.parroquia_id),role:user.rol,exp:Math.floor(Date.now()/1000)+8*3600};
 const part=Buffer.from(JSON.stringify(data)).toString('base64url');
 return part+'.'+sign(part);
}
function decode(token) {
 const [part,sig,...extra]=(token||'').split('.');
 if (!part || !sig || extra.length) return null;
 const expected=sign(part);
 const a=Buffer.from(sig),b=Buffer.from(expected);
 if (a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
 try { const value=JSON.parse(Buffer.from(part,'base64url').toString());
  if (!Number.isSafeInteger(value.id)||!Number.isSafeInteger(value.parroquiaId)||value.exp<=Math.floor(Date.now()/1000)) return null;
  return value;
 } catch{return null;}
}
export function sessionCookie(token) {
 const secure=process.env.NODE_ENV==='production'?'; Secure':'';
 return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`;
}
export function clearCookie() {return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV==='production'?'; Secure':''}`;}
export async function requireAuth(req,_res,next){
 try {
  const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  const session=decode(token);
  if (!session) throw new AppError('Inicia sesión',401,'UNAUTHORIZED');
  // Revalidar usuario activo y su rol actual contra BD en cada petición.
  const {pool}=await import('../../database/pool.js');
  const result=await pool.query('SELECT id,parroquia_id,rol FROM usuarios WHERE id=$1 AND parroquia_id=$2 AND activo=TRUE',[session.id,session.parroquiaId]);
  if (!result.rowCount) throw new AppError('Sesión no válida',401,'UNAUTHORIZED');
  req.user={id:result.rows[0].id,parroquiaId:result.rows[0].parroquia_id,role:result.rows[0].rol};
  next();
 }catch(e){next(e);}
}
export const requireRole=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():next(new AppError('Acceso denegado',403,'FORBIDDEN'));
export function sameOrigin(req,res,next){
 if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
 const origin=req.get('origin');
 const allowed=new URL(process.env.PUBLIC_ORIGIN||'http://localhost:3000').origin;
 if (origin !== allowed) return next(new AppError('Origen no autorizado',403,'INVALID_ORIGIN'));
 next();
}
