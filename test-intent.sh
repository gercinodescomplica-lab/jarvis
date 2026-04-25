#!/bin/bash

BASE_URL="http://localhost:3000/api/chat"

echo "--- TEST 1: 'Preciso assinar contratos dia 20' ---"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Preciso assinar contratos dia 20"
  }'
echo -e "\n--------------------------------------------------"

echo "--- TEST 2: 'Me lembre de pagar boleto amanhã' (Should Ask Importance) ---"
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Me lembre de pagar boleto amanhã"
  }'
echo -e "\n--------------------------------------------------"

echo "--- TEST 3: Follow-up Context Fusion 'Alta' ---"
# Simulating history where Jarvis just asked for importance
curl -s -X POST $BASE_URL \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Alta",
    "messages": [
      {"role": "user", "content": "Me lembre de pagar boleto amanhã"},
      {"role": "assistant", "content": "Entendido. Para criar, preciso de: importância."}
    ]
  }'
echo -e "\n--------------------------------------------------"
