CREATE TABLE IF NOT EXISTS parroquias (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(180) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS espacios (
  id BIGSERIAL PRIMARY KEY,
  parroquia_id BIGINT NOT NULL REFERENCES parroquias(id),
  nombre VARCHAR(120) NOT NULL,
  capacidad INTEGER NOT NULL CHECK (capacidad > 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (parroquia_id,nombre),
  UNIQUE (id,parroquia_id)
);
CREATE TABLE IF NOT EXISTS reservas (
  id BIGSERIAL PRIMARY KEY,
  parroquia_id BIGINT NOT NULL REFERENCES parroquias(id),
  espacio_id BIGINT NOT NULL,
  solicitante VARCHAR(150) NOT NULL,
  correo VARCHAR(200) NOT NULL,
  motivo VARCHAR(300) NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','APROBADA','RECHAZADA','CANCELADA')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (inicio < fin),
  FOREIGN KEY (espacio_id,parroquia_id) REFERENCES espacios(id,parroquia_id)
);
CREATE INDEX IF NOT EXISTS ix_reservas_agenda ON reservas(parroquia_id,espacio_id,inicio,fin);
INSERT INTO parroquias (id,nombre) VALUES (1,'Nuestra Señora de la Candelaria') ON CONFLICT DO NOTHING;
INSERT INTO espacios (parroquia_id,nombre,capacidad) VALUES
  (1,'Templo Principal',250), (1,'Salón Parroquial',80)
ON CONFLICT (parroquia_id,nombre) DO NOTHING;
-- Nota: para una solución nacional, evaluar exclusion constraints por rango y políticas RLS.
