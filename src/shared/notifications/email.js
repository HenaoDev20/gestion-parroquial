let transporter;
export async function sendReservationNotice(reserva,event){
 if (!process.env.SMTP_HOST) {console.warn('SMTP no configurado: aviso no enviado');return {sent:false};}
 const {default:nodemailer}=await import('nodemailer');
 transporter ||= nodemailer.createTransport({
  host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),
  secure:process.env.SMTP_SECURE==='true',
  auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}
 });
 const names={PENDIENTE:'Solicitud recibida',APROBADA:'Reserva aprobada',RECHAZADA:'Reserva rechazada',CANCELADA:'Reserva cancelada'};
 const title=names[event]||'Estado de reserva';
 await transporter.sendMail({from:process.env.SMTP_FROM,to:reserva.correo,subject:`Parroquia · ${title} #${reserva.id}`,
  text:`${title}.\nReserva: ${reserva.id}\nInicio: ${new Date(reserva.inicio).toISOString()}\nFin: ${new Date(reserva.fin).toISOString()}\n${reserva.observacion||''}`});
 return {sent:true};
}
