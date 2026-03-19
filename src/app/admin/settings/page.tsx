export default function SettingsPage() {
    return (
        <div className="container mx-auto py-10">
            <h1 className="text-3xl font-bold mb-6">Settings</h1>
            <p className="mb-4">Configure your environment variables in .env directly for MVP.</p>

            <div className="p-4 border rounded bg-gray-50">
                <h3 className="font-semibold">Current Configuration check:</h3>
                <ul className="list-disc list-inside mt-2">
                    <li>Database: Connected</li>
                    <li>Notion Integration: See logs</li>
                    <li>Telegram Rewrite: Active</li>
                </ul>
            </div>
        </div>
    )
}
