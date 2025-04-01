#!/usr/bin/env python3
import json
import sys

# Output in JSON format for Electron to parse
result = {
    "success": True,
    "message": "Python is working!",
    "version": sys.version
}

print(json.dumps(result))