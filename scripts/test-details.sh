#!/bin/bash

# Test 1: Details for SIMBA
# Expecting to extract "simba", find 1 project, and fetch details (body content).
curl -s -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "text": "me de os detalhes do projeto simba",
    "messages": []
  }' 
