import test from 'node:test';import assert from 'node:assert/strict';
import {ReservasService} from '../src/modules/reservas/reservas.service.js';
const admin={id:3,parroquiaId:1,role:'secretaria'};
test('rechazo exige justificación',async()=>{const s=new ReservasService({},async()=>{});await assert.rejects(s.cambiarEstado(admin,1,'RECHAZADA',''),/motivo de rechazo/);});
test('aprobación delega estado al repositorio y envía aviso',async()=>{let state,notice;const repository={cambiarEstado:async(_u,_id,s)=>{state=s;return {type:'OK',data:{id:1,correo:'a@example.com'}};}};const s=new ReservasService(repository,async(_data,event)=>{notice=event});await s.cambiarEstado(admin,1,'APROBADA');assert.equal(state,'APROBADA');assert.equal(notice,'APROBADA');});
test('disponibilidad valida plazo máximo',async()=>{const s=new ReservasService({},async()=>{});await assert.rejects(s.disponibilidad(1,{espacioId:2,desde:'2030-01-01T00:00:00Z',hasta:'2030-04-01T00:00:00Z'}),/máximo 31 días/);});
