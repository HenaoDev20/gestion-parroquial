import {Router} from 'express';
import crypto from 'node:crypto';
import {pool} from '../../database/pool.js';
import {createSession,sessionCookie,clearCookie,requireAuth} from '../../shared/auth/session.js';
import {asyncHandler} from '../../shared/http/asyncHandler.js';
import {AppError} from '../../shared/errors/AppError.js';
export function verifyPassword(password,stored) {
 const [saltHex,hashHex]=String(stored).split(':');
 if (!saltHex||!hashHex) return false;
 const hash=crypto.scryptSync(password,Buffer.from(saltHex,'hex'),64);
 const saved=Buffer.from(hashHex,'hex');
 return hash.length===saved.length&&crypto.timingSafeEqual(hash,saved);
}
const router=Router();
router.post('/login',asyncHandler(async(req,res)=>{
 const {correo,password,parroquiaId=1}=req.body??{};
 if(typeof correo!=='string'||correo.length>200||typeof password!=='string'||password.length>1024||!Number.isSafeInteger(Number(parroquiaId)))throw new AppError('Datos de acceso inválidos');
 const {rows}=await pool.query('SELECT id,parroquia_id,rol,nombre,password_hash FROM usuarios WHERE parroquia_id=$1 AND lower(correo)=lower($2) AND activo=TRUE',[Number(parroquiaId),correo.trim()]);
 if (!rows.length||!verifyPassword(password,rows[0].password_hash)) throw new AppError('Credenciales inválidas',401,'BAD_CREDENTIALS');
 const user=rows[0];res.setHeader('Set-Cookie',sessionCookie(createSession(user)));
 res.json({success:true,data:{id:user.id,role:user.rol,nombre:user.nombre,parroquiaId:user.parroquia_id},message:'Sesión iniciada',errors:[]});
}));
router.post('/logout',(_req,res)=>{res.setHeader('Set-Cookie',clearCookie());res.json({success:true,data:null,message:'Sesión finalizada',errors:[]});});
router.get('/me',requireAuth,(req,res)=>res.json({success:true,data:req.user,message:'Sesión activa',errors:[]}));
export default router;
