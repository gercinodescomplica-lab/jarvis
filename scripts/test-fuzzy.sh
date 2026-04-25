#!/bin/bash

# Test Fuzzy Search
# Looking for "Power Automate" which we assume doesn't exist exactly, but has a match.
echo "--- Testing Fuzzy Search 'Power Automate' ---"
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Tem algum projeto de Power Automate?",
    "messages": []
  }'
echo "\n"
