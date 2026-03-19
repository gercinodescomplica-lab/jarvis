import { NextResponse } from 'next/server';

export async function GET() {
    const users = [
        { id: '1', name: 'Alice Corp', email: 'contact@alice.com', role: 'Client', status: 'Active', usage: 120 },
        { id: '2', name: 'Bob Inc', email: 'info@bob.com', role: 'Client', status: 'Inactive', usage: 45 },
        { id: '3', name: 'Charlie Ltd', email: 'support@charlie.com', role: 'Partner', status: 'Active', usage: 890 },
        { id: '4', name: 'Delta Group', email: 'admin@delta.edu', role: 'Client', status: 'Active', usage: 230 },
        { id: '5', name: 'Echo Systems', email: 'echo@systems.io', role: 'Vendor', status: 'Pending', usage: 0 },
    ];

    return NextResponse.json(users);
}
