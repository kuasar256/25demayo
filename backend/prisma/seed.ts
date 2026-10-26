import { PrismaClient } from '@prisma/client';
import { Role, LocationType } from '../src/common/enums';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // --- Usuarios (contraseña demo: admin123) ---
  const password = await bcrypt.hash('admin123', 10);

  const branch1 = await prisma.branch.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Sucursal Centro', address: 'Av. Arce 123, La Paz', phone: '2222222' },
  });
  const branch2 = await prisma.branch.upsert({
    where: { id: 2 },
    update: {},
    create: { name: 'Sucursal Sur', address: 'Calle Comercio 456, El Alto', phone: '3333333' },
  });

  const warehouse1 = await prisma.warehouse.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Bodega Principal' },
  });
  await prisma.warehouse.upsert({
    where: { id: 2 },
    update: {},
    create: { name: 'Bodega Secundaria' },
  });

  const users = [
    { email: 'duenio@colchones.bo', fullName: 'Dueño General', role: Role.ADMIN_GENERAL, branchId: null },
    { email: 'admin@colchones.bo', fullName: 'Administrador', role: Role.ADMIN, branchId: null },
    { email: 'fabrica@colchones.bo', fullName: 'Encargado Fábrica', role: Role.ENCARGADO_FABRICA, branchId: null },
    { email: 'sucursal1@colchones.bo', fullName: 'Encargado Sucursal Centro', role: Role.ENCARGADO_SUCURSAL, branchId: branch1.id },
    { email: 'vendedor1@colchones.bo', fullName: 'Vendedor Centro', role: Role.VENDEDOR, branchId: branch1.id },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
  }

  // --- Catálogo ---
  const catColchon = await prisma.category.upsert({
    where: { name: 'Colchones' },
    update: {},
    create: { name: 'Colchones' },
  });
  const catCatre = await prisma.category.upsert({
    where: { name: 'Catres' },
    update: {},
    create: { name: 'Catres' },
  });

  const products = [
    { categoryId: catColchon.id, name: 'Colchón Royal', sku: 'COL-ROYAL', warrantySeal: 'Sello 5 años' },
    { categoryId: catColchon.id, name: 'Colchón Imperial', sku: 'COL-IMP', warrantySeal: 'Sello 3 años' },
    { categoryId: catCatre.id, name: 'Catre Plegable', sku: 'CAT-PLEG', warrantySeal: 'Sello 1 año' },
  ];
  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
  }

  const royal = await prisma.product.findUnique({ where: { sku: 'COL-ROYAL' } });
  const imperial = await prisma.product.findUnique({ where: { sku: 'COL-IMP' } });
  const catre = await prisma.product.findUnique({ where: { sku: 'CAT-PLEG' } });

  const variants = [
    { productId: royal!.id, size: 'Plaza y media', color: 'Gris', price: 1450, costPrice: 850, warrantyYears: 5, minStock: 5, sku: 'COL-ROYAL-15' },
    { productId: royal!.id, size: 'Dos plazas', color: 'Gris', price: 1850, costPrice: 1050, warrantyYears: 5, minStock: 5, sku: 'COL-ROYAL-20' },
    { productId: imperial!.id, size: 'Dos plazas', color: 'Beige', price: 2250, costPrice: 1300, warrantyYears: 3, minStock: 3, sku: 'COL-IMP-20' },
    { productId: catre!.id, size: 'Plaza y media', color: 'Negro', price: 650, costPrice: 380, warrantyYears: 1, minStock: 10, sku: 'CAT-PLEG-15' },
  ];
  for (const v of variants) {
    await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: { costPrice: v.costPrice, warrantyYears: v.warrantyYears },
      create: v,
    });
  }

  // --- Stock inicial en bodega principal ---
  const allVariants = await prisma.productVariant.findMany();
  const fabrica = await prisma.user.findUnique({ where: { email: 'fabrica@colchones.bo' } });
  for (const v of allVariants) {
    const existing = await prisma.stock.findUnique({
      where: {
        variantId_locationType_locationId: {
          variantId: v.id, locationType: LocationType.BODEGA, locationId: warehouse1.id,
        },
      },
    });
    if (!existing) {
      await prisma.stock.create({
        data: { variantId: v.id, locationType: LocationType.BODEGA, locationId: warehouse1.id, quantity: 50 },
      });
      await prisma.stockMovement.create({
        data: {
          variantId: v.id,
          locationType: LocationType.BODEGA,
          locationId: warehouse1.id,
          type: 'INGRESO',
          quantity: 50,
          reason: 'Stock inicial',
          userId: fabrica!.id,
        },
      });
    }
  }

  // --- Tercero demo ---
  await prisma.thirdParty.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Distribuidora El Descanso', contact: 'María López', phone: '7777777', nit: '123456789' },
  });

  console.log('Seed completado. Usuarios demo (password: admin123):');
  users.forEach((u) => console.log(`  ${u.role.padEnd(20)} -> ${u.email}`));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
