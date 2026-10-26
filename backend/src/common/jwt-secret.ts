/** Evita publicar tokens firmados con claves conocidas o demasiado cortas. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const insecure = !secret || secret.trim().length < 32 || ['dev-secret', 'cambia-esto-en-produccion'].includes(secret);
  if (process.env.NODE_ENV === 'production' && insecure) {
    throw new Error('Configure JWT_SECRET con una clave aleatoria de al menos 32 caracteres antes de iniciar en producción.');
  }
  return secret || 'dev-secret';
}
