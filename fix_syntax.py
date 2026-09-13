with open("tools/http_api.py", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if "yield f\"data: {json.dumps(item)}" in line:
        new_lines.append("                yield f\"data: {json.dumps(item)}\\n\\n\"\n")
        skip = True
    elif skip and line.strip() == "\"":
        skip = False
    elif not skip:
        new_lines.append(line)

with open("tools/http_api.py", "w") as f:
    f.writelines(new_lines)
