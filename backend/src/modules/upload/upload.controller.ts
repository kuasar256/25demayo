import {
  Controller, Post, Req, UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { mkdirSync, readFileSync, unlinkSync } from 'fs';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Firmas de bytes mágicos (magic bytes / file signatures) para validar
 * que el contenido binario real del archivo corresponda a una imagen legítima.
 * Esto previene ataques donde se falsifica el Content-Type pero el contenido
 * es un ejecutable, script PHP, HTML malicioso, etc.
 */
const MAGIC_BYTES: { mime: string; offset: number; bytes: number[] }[] = [
  // JPEG: empieza con FF D8 FF
  { mime: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/jpg',  offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // PNG: empieza con 89 50 4E 47 0D 0A 1A 0A
  { mime: 'image/png',  offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // WebP: empieza con 52 49 46 46 ('RIFF') + 4 bytes tamaño + 57 45 42 50 ('WEBP')
  { mime: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
];

/** Bytes adicionales de WebP: en offset 8 debe aparecer 'WEBP' */
const WEBP_SIGNATURE_OFFSET8 = [0x57, 0x45, 0x42, 0x50];

/**
 * Valida que los primeros bytes del archivo coincidan con la firma
 * esperada según su tipo MIME declarado.
 */
function validateMagicBytes(filePath: string, declaredMime: string): boolean {
  try {
    // Leer solo los primeros 12 bytes (suficiente para todas las firmas)
    const fd = readFileSync(filePath);
    const header = fd.subarray(0, 12);

    const mime = declaredMime.toLowerCase();
    const signature = MAGIC_BYTES.find((s) => s.mime === mime);
    if (!signature) return false;

    // Verificar bytes principales
    for (let i = 0; i < signature.bytes.length; i++) {
      if (header[signature.offset + i] !== signature.bytes[i]) return false;
    }

    // Verificación adicional para WebP: offset 8 debe ser 'WEBP'
    if (mime === 'image/webp') {
      for (let i = 0; i < WEBP_SIGNATURE_OFFSET8.length; i++) {
        if (header[8 + i] !== WEBP_SIGNATURE_OFFSET8[i]) return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

@ApiTags('Upload')
@ApiBearerAuth('JWT')
@Controller('upload')
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDirectory = join(__dirname, '..', '..', '..', 'public', 'uploads');
          mkdirSync(uploadDirectory, { recursive: true });
          cb(null, uploadDirectory);
        },
        filename: (_req, file, cb) => {
          // Generar extensión segura a partir del tipo MIME validado, descartando la extensión arbitraria del cliente
          const safeExt = ALLOWED_MIME_TYPES[file.mimetype?.toLowerCase()] || '.jpg';
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + safeExt);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const mime = file.mimetype?.toLowerCase();
        const ext = extname(file.originalname || '').toLowerCase();

        // Validar tanto el tipo MIME como la extensión física para prevenir spoofing y contenido ejecutable (HTML/SVG/JS)
        if (!ALLOWED_MIME_TYPES[mime] || !ALLOWED_EXTENSIONS.has(ext)) {
          return cb(
            new BadRequestException('Solo se permiten imágenes válidas (JPG, PNG, WebP). No se aceptan archivos ejecutables o SVG.'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
    }),
  )
  @Roles(Role.ADMIN_GENERAL, Role.ADMIN)
  uploadImage(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('No se recibió ninguna imagen.');

    // Validación de magic bytes: verificar que el contenido binario real sea una imagen legítima
    if (!validateMagicBytes(file.path, file.mimetype)) {
      // Eliminar el archivo sospechoso del disco inmediatamente
      try { unlinkSync(file.path); } catch { /* ignorar si ya no existe */ }
      throw new BadRequestException(
        'El archivo no es una imagen válida. El contenido no coincide con el tipo declarado.',
      );
    }

    const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0];
    const origin = `${forwardedProto || req.protocol}://${req.get('host')}`;
    const url = `${origin}/uploads/${file.filename}`;
    return { url, filename: file.filename };
  }
}
