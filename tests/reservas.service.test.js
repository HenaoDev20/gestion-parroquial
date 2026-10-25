import test from 'node:test';
import assert from 'node:assert/strict';
import {ReservasService} from '../src/modules/reservas/reservas.service.js';
const user={id:10,parroquiaId:1,role:'feligrés'};
const repo={crear:async (_u,data)=>({type:'OK',data:{id:5,...data}}),cambiarEstado:async()=>({type:'CONFLICT'})};
test('crea solicitud válida delegando en repositorio',async()=>{
 const s=new ReservasService(repo,async()=>{});
 const year=new Date().getUTCFullYear()+2;
 const r=await s.solicitar(user,{espacioId:1,solicitante:'Ana',correo:'ana@test.co',motivo:'Reunión',inicio:`${year}-05-01T10:00:00-05:00`,fin:`${year}-05-01T11:00:00-05:00`});
 assert.equal(r.id,5);
});
test('rechaza fecha invertida',async()=>{
 const s=new ReservasService(repo,async()=>{});
 await assert.rejects(s.solicitar(user,{espacioId:1,solicitante:'Ana',correo:'ana@test.co',motivo:'Reunión',inicio:'2035-01-02T12:00:00Z',fin:'2035-01-02T11:00:00Z'}),/Rango de fechas inválido/);
});
test('no aprueba reserva con conflicto',async()=>{
 await assert.rejects(new ReservasService(repo,async()=>{}).cambiarEstado(user,2,'APROBADA'),/ya está reservado/);
});
