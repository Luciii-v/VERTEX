import os
import re
from pathlib import Path

def test_no_external_urls_in_codebase():
    """
    Fails the build if any source file contains a non-local URL literal.
    Allows localhost, 127.0.0.1, and host.docker.internal.
    """
    project_root = Path(__file__).parent.parent
    
    # Regex to catch http:// and https:// followed by anything until a quote or space
    url_pattern = re.compile(r'https?://([^/\"\'\s]+)')
    
    allowed_hosts = {
        "localhost",
        "127.0.0.1",
        "host.docker.internal",
        "0.0.0.0",
        "github.com",
        "google.com",
        "..."
    }
    
    violations = []
    
    for root, dirs, files in os.walk(project_root):
        # Skip virtual env, git, cache, and workspace data
        dirs[:] = [d for d in dirs if d not in {".venv", ".git", "__pycache__", ".pytest_cache", "workspace_data", "tests"}]
        
        for file in files:
            if not file.endswith((".py", ".sh", ".json", ".md")):
                continue
                
            file_path = Path(root) / file
            
            try:
                content = file_path.read_text(encoding="utf-8")
                matches = url_pattern.finditer(content)
                
                for match in matches:
                    host = match.group(1).split(':')[0]  # Strip port if present
                    if host not in allowed_hosts:
                        violations.append(f"{file_path.relative_to(project_root)}: {match.group(0)}")
            except UnicodeDecodeError:
                pass
                
    assert not violations, "🚨 SOVEREIGNTY VIOLATION: External URLs found in source code:\n" + "\n".join(violations)
