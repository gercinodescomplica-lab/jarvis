#!/bin/bash
set -e

DB_URL=$(grep '^DATABASE_URL=' "$(dirname "$0")/../.env" | cut -d'=' -f2-)

supabase db push --db-url "$DB_URL"
