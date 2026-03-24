import { NextResponse } from 'next/server';
import { getAllStats } from '@/lib/tool-middleware';
import { validateAdminRequest } from '@/lib/admin-auth';

export async function GET(req: Request) {
    const err = validateAdminRequest(req);
    if (err) return err;
    return NextResponse.json(getAllStats());
}
