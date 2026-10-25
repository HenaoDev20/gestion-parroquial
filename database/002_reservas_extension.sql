-- Ejecutar una única vez después de 001_schema.sql.
CREATE TABLE IF NOT EXISTS usuarios (
 id BIGSERIAL PRIMARY KEY,
 parroquia_id BIGINT NOT NULL REFERENCES parroquias(id),
 nombre VARCHAR(150) NOT NULL,
 correo VARCHAR(200) NOT NULL,
 password_hash TEXT NOT NULL,
 rol VARCHAR(20) NOT NULL CHECK(rol IN ('feligrés','secretaria','parroco')),
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(parroquia_id,correo)
);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS usuario_id BIGINT REFERENCES usuarios(id);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS observacion TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS ix_reservas_usuario ON reservas(parroquia_id,usuario_id);
CREATE TABLE IF NOT EXISTS auditoria_reservas (
 id BIGSERIAL PRIMARY KEY, parroquia_id BIGINT NOT NULL REFERENCES parroquias(id),
 reserva_id BIGINT NOT NULL REFERENCES reservas(id), usuario_id BIGINT REFERENCES usuarios(id),
 accion VARCHAR(32) NOT NULL, detalle TEXT, creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Evita la doble aprobación incluso si otro proceso no utiliza el bloqueo en la aplicación.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE reservas ADD CONSTRAINT reservas_no_solapadas
 EXCLUDE USING gist (parroquia_id WITH =, espacio_id WITH =,
 tstzrange(inicio,fin,'[)') WITH &&)
 WHERE (estado = 'APROBADA');
