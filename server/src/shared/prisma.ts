import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

const envFiles = [
	path.resolve(process.cwd(), '.env'),
	path.resolve(process.cwd(), '.env.local'),
	path.resolve(process.cwd(), 'server/.env'),
	path.resolve(process.cwd(), 'server/.env.local'),
	path.resolve(process.cwd(), '../.env'),
	path.resolve(process.cwd(), '../.env.local'),
	path.resolve(process.cwd(), '../server/.env'),
	path.resolve(process.cwd(), '../server/.env.local'),
];

for (const envFile of envFiles) {
	dotenv.config({ path: envFile });
}

const prisma = new PrismaClient();

export default prisma;
export { prisma };
