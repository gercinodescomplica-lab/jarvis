#!/bin/bash

echo "--- Test 1: Initial Query (Important Projects) ---"
# We expect this to work and return 11 projects
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "text": "quais os projetos importantes?",
    "messages": []
  }'

echo -e "\n\n--- Test 2: Follow-up (List first 3) ---"
# We expect this to understand context and list the top 3 from the previous result
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "text": "liste os três primeiros",
    "messages": [
      { "role": "user", "content": "quais os projetos importantes?" },
      { "role": "assistant", "content": "Encontrei 11 projetos de alta prioridade." }
    ]
  }'
