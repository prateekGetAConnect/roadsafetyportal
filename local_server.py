#!/usr/bin/env python3
import os
from api.index import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print()
    print("╔══════════════════════════════════════════════════╗")
    print("║  India Transport Analytics POC - LOCAL SERVER    ║")
    print(f"║  Server running at http://localhost:{port}         ║")
    print("║  Press Ctrl+C to stop                            ║")
    print("╚══════════════════════════════════════════════════╝")
    print()
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False)
