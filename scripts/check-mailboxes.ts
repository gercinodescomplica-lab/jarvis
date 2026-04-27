import 'dotenv/config';
import { supabase } from '../src/db';

async function main() {
    const { data, error, count } = await supabase
        .from('email_mailbox_configs')
        .select('*', { count: 'exact' });
    console.log('error:', error);
    console.log('count:', count);
    console.log('data:', JSON.stringify(data, null, 2));
}
main().catch(console.error);
