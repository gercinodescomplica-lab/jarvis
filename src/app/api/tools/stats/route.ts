import { NextResponse } from 'next/server';
import { getAllStats } from '@/lib/tool-middleware';

export async function GET() {
    return NextResponse.json(getAllStats());
}
